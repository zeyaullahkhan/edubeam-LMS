// Flips the Prisma datasource provider from SQLite to PostgreSQL for cloud
// deploys. Run ONLY in the deployment build (e.g. Render) — local development
// stays on SQLite (the committed schema), so this is never run on a dev machine.
//
//   node packages/db/scripts/use-postgres.mjs
//
// Idempotent: running it again when already on postgresql is a no-op. The schema
// was authored without enums/arrays specifically so it is provider-portable.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'prisma', 'schema.prisma');

const original = readFileSync(schemaPath, 'utf8');
const swapped = original.replace(
  /provider\s*=\s*"sqlite"/,
  'provider = "postgresql"',
);

if (swapped === original) {
  console.log('[use-postgres] provider already postgresql (or sqlite line not found) — no change');
} else {
  writeFileSync(schemaPath, swapped);
  console.log('[use-postgres] Prisma datasource provider set to postgresql');
}
