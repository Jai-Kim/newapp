import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SUPABASE_URL } from './env';

/**
 * Privileged database access for test setup and teardown, via the Supabase CLI
 * — against the local stack or the linked project, whichever this run targets.
 *
 * Why this exists at all: the project has email confirmation ON, which is the
 * right setting for production and means a programmatic sign-up gets a user but
 * no session. The standard fix is a service-role client creating pre-confirmed
 * users — but the service role key deliberately does not live on this machine
 * (ARCHITECTURE §5), so the harness borrows the already-authenticated CLI
 * instead. Nothing here needs a new secret, and no project setting is changed.
 *
 * Requires: a running `supabase start` locally, or `supabase login` and
 * `supabase link` for the hosted project (already done for this repo).
 */

/**
 * Which database `supabase db query` should talk to.
 *
 * CI runs the stubbed suite against a local stack that was never `link`ed, so
 * a hardcoded `--linked` fails there with "Cannot find project ref" — which is
 * how teardown came to throw on every CI run the moment it stopped swallowing
 * errors. The app's own URL already says which database this run is about, so
 * ask it rather than adding a flag someone has to remember to set.
 */
const TARGET = /\/\/(?:localhost|127\.0\.0\.1|\[::1\])[:/]/.test(SUPABASE_URL)
  ? '--local'
  : '--linked';

export function sql(statement: string): Record<string, unknown>[] {
  // Passed via a temp file rather than an argument: the CLI parses a leading
  // `--` in a statement as a flag, and a file sidesteps shell quoting entirely.
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-sql-')), 'q.sql');
  fs.writeFileSync(file, statement);
  let out: string;
  try {
    out = execFileSync(
      'npx',
      ['supabase', 'db', 'query', TARGET, '-f', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }
  finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
  return parseRows(out, statement);
}

/**
 * Confirmed against real CI output (see the `print_orders` insert log at
 * run 33230374369): `supabase db query` does not emit JSON at all. A query
 * that returns rows prints a box-drawing table —
 *
 *   ┌──────────────────────────┬──────────────────────────┐
 *   │ id                       │ created_at               │
 *   ├──────────────────────────┼──────────────────────────┤
 *   │ 6418c832-...             │ 2026-08-29 03:05:18 UTC  │
 *   └──────────────────────────┴──────────────────────────┘
 *
 * — and a write with no `returning` clause prints a bare command tag
 * (`DELETE 1`, `UPDATE 1`, `INSERT 0 1`, `DELETE 0`, ...), which is a
 * genuine zero-row result, not a broken read. Every earlier version of this
 * parser guessed at a JSON shape (an envelope, then NDJSON) that the CLI has
 * never actually produced; the previous "it must be JSON" assumption is why
 * `insertPrintOrder`'s own `returning id, created_at` read failed on its
 * very first (non-conflicting) call. Only output that is neither a table
 * nor a recognised command tag should throw — that's the case a read
 * silently returning `[]` actually needs to be loud about.
 */
const COMMAND_TAG
  = /^(INSERT \d+ \d+|UPDATE \d+|DELETE \d+|MERGE \d+|SELECT \d+|COPY \d+|TRUNCATE(?: TABLE)?|CREATE [A-Z ]+|DROP [A-Z ]+|ALTER [A-Z ]+)$/i;

/** Accepts both the unicode box style observed in CI and a plain-ASCII fallback. */
const TOP_BORDER = /^[┌╭+][─═-]/;
const BOTTOM_BORDER = /^[└╰+][─═-]/;
const CONTENT_LINE = /^[│║|]/;

function splitCells(line: string): string[] {
  const trimmed = line.replace(/^[│║|]/, '').replace(/[│║|]$/, '');
  return trimmed.split(/[│║|]/).map(cell => cell.trim());
}

/** `null` means "this isn't a table at all" — distinct from a table with zero data rows. */
function parseTable(lines: string[]): Record<string, unknown>[] | null {
  const top = lines.findIndex(line => TOP_BORDER.test(line));
  if (top === -1) {
    return null;
  }
  const bottom = lines.findIndex((line, i) => i > top && BOTTOM_BORDER.test(line));
  if (bottom === -1) {
    return null;
  }

  const contentLines = lines.slice(top + 1, bottom).filter(line => CONTENT_LINE.test(line));
  if (contentLines.length === 0) {
    return [];
  }
  const [headerLine, ...dataLines] = contentLines;
  const headers = splitCells(headerLine);
  return dataLines.map((line) => {
    const cells = splitCells(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? null;
    });
    return row;
  });
}

function parseRows(out: string, statement: string): Record<string, unknown>[] {
  if (out.trim() === '') {
    return [];
  }

  const lines = out.split('\n').map(line => line.trim()).filter(Boolean);

  const table = parseTable(lines);
  if (table !== null) {
    return table;
  }

  // Kept as a fallback, not the primary path: nothing observed from the real
  // CLI has produced this shape, but a shape this doesn't understand should
  // still get one more honest attempt before throwing.
  const jsonStart = lines.findIndex(line => /^[[{]/.test(line));
  if (jsonStart !== -1) {
    const jsonLines = lines.slice(jsonStart);
    const rows = asRows(tryParseJson(jsonLines.join('\n'))) ?? parseNdjsonRows(jsonLines);
    if (rows !== null) {
      return rows;
    }
  }

  if (COMMAND_TAG.test(lines[lines.length - 1])) {
    return [];
  }

  throw new Error(
    `could not parse "supabase db query" output for:\n${statement}\n\ngot:\n${out}`,
  );
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  }
  catch {
    return undefined;
  }
}

/** A JSON array is already rows; a bare object is one row; anything else isn't rows. */
function asRows(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }
  if (value !== null && typeof value === 'object') {
    const withRows = (value as { rows?: unknown }).rows;
    return Array.isArray(withRows) ? withRows as Record<string, unknown>[] : [value as Record<string, unknown>];
  }
  return null;
}

function parseNdjsonRows(jsonLines: string[]): Record<string, unknown>[] | null {
  const rows: Record<string, unknown>[] = [];
  for (const line of jsonLines) {
    const parsed = asRows(tryParseJson(line));
    if (parsed === null) {
      return null;
    }
    rows.push(...parsed);
  }
  return rows;
}

/** Values interpolated into SQL are synthetic, but never trust that by accident. */
export function literal(value: string): string {
  if (!/^[\w@.\-:+]*$/.test(value)) {
    throw new Error(`refusing to interpolate an unexpected value: ${value}`);
  }
  return `'${value}'`;
}
