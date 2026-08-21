import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Privileged database access for test setup and teardown, via the Supabase CLI
 * against the linked project.
 *
 * Why this exists at all: the project has email confirmation ON, which is the
 * right setting for production and means a programmatic sign-up gets a user but
 * no session. The standard fix is a service-role client creating pre-confirmed
 * users — but the service role key deliberately does not live on this machine
 * (ARCHITECTURE §5), so the harness borrows the already-authenticated CLI
 * instead. Nothing here needs a new secret, and no project setting is changed.
 *
 * Requires: `supabase login` and `supabase link` (already done for this repo).
 */

export function sql(statement: string): Record<string, unknown>[] {
  // Passed via a temp file rather than an argument: the CLI parses a leading
  // `--` in a statement as a flag, and a file sidesteps shell quoting entirely.
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-sql-')), 'q.sql');
  fs.writeFileSync(file, statement);
  try {
    const out = execFileSync(
      'npx',
      ['supabase', 'db', 'query', '--linked', '-f', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const start = out.indexOf('{');
    if (start === -1) {
      return [];
    }
    return (JSON.parse(out.slice(start)) as { rows?: Record<string, unknown>[] })
      .rows ?? [];
  }
  finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

/** Values interpolated into SQL are synthetic, but never trust that by accident. */
export function literal(value: string): string {
  if (!/^[\w@.\-:+]*$/.test(value)) {
    throw new Error(`refusing to interpolate an unexpected value: ${value}`);
  }
  return `'${value}'`;
}
