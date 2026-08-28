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
 * The CLI does not wrap results in a single `{"rows": [...]}` envelope — a
 * multi-row result prints one JSON value per line (NDJSON), and a single-row
 * result (every read this harness has actually done until now — the rest
 * were skipped or unexercised in CI) prints that one row object with nothing
 * around it. The old parser only understood a `{...}` wrapper with a `.rows`
 * key, which neither shape produces: for a one-row result it found the row
 * itself, parsed fine, found no `.rows` key on it, and silently fell back to
 * `[]` — a live row read back as zero, every time. This throws instead of
 * guessing, so a shape this doesn't understand fails loudly rather than
 * looking like "no rows".
 *
 * Still tolerates a non-JSON preamble (the CLI may log a connection banner
 * before the result), the same as the old `indexOf('{')` did — just applied
 * per-line, so it doesn't also swallow a genuine parse failure inside the
 * JSON itself.
 */
function parseRows(out: string, statement: string): Record<string, unknown>[] {
  if (out.trim() === '') {
    return [];
  }

  const lines = out.split('\n');
  const start = lines.findIndex(line => /^[[{]/.test(line.trim()));
  if (start === -1) {
    throw new Error(
      `"supabase db query" produced no JSON output for:\n${statement}\n\ngot:\n${out}`,
    );
  }
  const jsonLines = lines.slice(start).map(l => l.trim()).filter(Boolean);

  const rows = asRows(tryParseJson(jsonLines.join('\n'))) ?? parseNdjsonRows(jsonLines);
  if (rows === null) {
    throw new Error(
      `could not parse "supabase db query" output as JSON rows for:\n${statement}\n\ngot:\n${out}`,
    );
  }
  return rows;
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
