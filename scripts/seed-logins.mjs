/**
 * Bulk login seed — creates one login per district (13), block (95), and school (500).
 * Idempotent: uses ON CONFLICT (email) DO UPDATE to refresh passwords on re-run.
 * Password = username (part before @) for every account.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-logins.mjs
 *
 * Output: login-credentials.csv in the repo root.
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const pg      = require('pg');
const bcrypt  = require('bcryptjs');
const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌  DATABASE_URL env var not set.');
  console.error('   Example: DATABASE_URL="postgresql://..." node scripts/seed-logins.mjs');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('render.com') || DB_URL.includes('neon') ? { rejectUnauthorized: false } : undefined,
  max: 3,
});

/** Lowercase, spaces → dots, strip non-alphanumeric-dot. */
function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').replace(/\.+/g, '.');
}

/** Bcrypt hash with cost 10. */
async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function upsertUser(client, { id, email, name, role, tenantId, districtId, blockId, schoolId, passwordHash }) {
  await client.query(
    `INSERT INTO "User" (id, email, "passwordHash", name, role, "tenantId", "districtId", "blockId", "schoolId", active, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW())
     ON CONFLICT (email) DO UPDATE SET
       "passwordHash" = EXCLUDED."passwordHash",
       role           = EXCLUDED.role,
       "tenantId"     = EXCLUDED."tenantId",
       "districtId"   = EXCLUDED."districtId",
       "blockId"      = EXCLUDED."blockId",
       "schoolId"     = EXCLUDED."schoolId"`,
    [id, email, passwordHash, name, role, tenantId, districtId ?? null, blockId ?? null, schoolId ?? null],
  );
}

async function main() {
  const client = await pool.connect();
  try {
    // ── 1. Load reference data ──────────────────────────────────────────────
    const { rows: tenants }   = await client.query('SELECT id FROM "Tenant" LIMIT 1');
    const tenantId = tenants[0]?.id;
    if (!tenantId) { console.error('❌  No tenant found — run the seed first.'); process.exit(1); }

    const { rows: districts } = await client.query(
      'SELECT id, name FROM "District" WHERE "tenantId" = $1 ORDER BY name', [tenantId]);
    const { rows: blocks }    = await client.query(
      'SELECT b.id, b.name, b."districtId", d.name AS district_name FROM "Block" b JOIN "District" d ON d.id = b."districtId" ORDER BY d.name, b.name');
    const { rows: schools }   = await client.query(
      'SELECT s.id, s.name, s."udiseCode", s."siteCode", s."blockId", b."districtId" FROM "School" s JOIN "Block" b ON b.id = s."blockId" ORDER BY s.name');

    const credentials = [];
    let created = 0;

    // ── 2. District officials ───────────────────────────────────────────────
    console.log(`\nCreating ${districts.length} district officials…`);
    for (const d of districts) {
      const username = slugify(d.name);
      const email    = `${username}@edubeam.in`;
      const pw       = username;
      await upsertUser(client, {
        id: `ud_${username}`,
        email, name: `${d.name} District Official`,
        role: 'DISTRICT_OFFICIAL', tenantId,
        districtId: d.id,
        passwordHash: await hash(pw),
      });
      credentials.push({ role: 'DISTRICT_OFFICIAL', email, password: pw, scope: d.name });
      created++;
      process.stdout.write('.');
    }
    console.log();

    // ── 3. Block officials ──────────────────────────────────────────────────
    console.log(`Creating ${blocks.length} block officials…`);
    for (const b of blocks) {
      const blockSlug = slugify(b.name);
      const distSlug  = slugify(b.district_name);
      const email     = `${blockSlug}@${distSlug}.edubeam.in`;
      const pw        = blockSlug;
      await upsertUser(client, {
        id: `ub_${distSlug}_${blockSlug}`,
        email, name: `${b.name} Block Official`,
        role: 'BLOCK_OFFICIAL', tenantId,
        districtId: b.districtId, blockId: b.id,
        passwordHash: await hash(pw),
      });
      credentials.push({ role: 'BLOCK_OFFICIAL', email, password: pw, scope: `${b.name} (${b.district_name})` });
      created++;
      process.stdout.write('.');
    }
    console.log();

    // ── 4. School principals ────────────────────────────────────────────────
    console.log(`Creating ${schools.length} school principals…`);
    for (const s of schools) {
      // Prefer siteCode (e.g. WVEAMO376 → wveamo376), fall back to s + udiseCode
      const localPart = s.siteCode ? s.siteCode.toLowerCase() : `s${s.udiseCode}`;
      const email     = `${localPart}@edubeam.in`;
      const pw        = localPart;
      await upsertUser(client, {
        id: `us_${localPart}`,
        email, name: `Principal — ${s.name}`,
        role: 'PRINCIPAL', tenantId,
        districtId: s.districtId, schoolId: s.id,
        passwordHash: await hash(pw),
      });
      credentials.push({ role: 'PRINCIPAL', email, password: pw, scope: s.name });
      created++;
      process.stdout.write('.');
    }
    console.log();

    // ── 5. Write CSV ────────────────────────────────────────────────────────
    const header = 'role,email,password,scope';
    const rows   = credentials.map(c =>
      [c.role, c.email, c.password, `"${c.scope.replace(/"/g, '""')}"`].join(',')
    );
    writeFileSync('login-credentials.csv', [header, ...rows].join('\n'), 'utf8');

    console.log(`\n✅  Done — ${created} logins created/updated.`);
    console.log(`📄  Credentials written to login-credentials.csv`);
    console.log(`\nSummary:`);
    console.log(`   District officials : ${districts.length}`);
    console.log(`   Block officials    : ${blocks.length}`);
    console.log(`   School principals  : ${schools.length}`);
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
