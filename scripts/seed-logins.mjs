/**
 * Bulk login seed — idempotent, safe to re-run on every Render deploy.
 *
 * Creates:
 *   13  district officials   ({district}@edubeam.com)
 *   95  block officials      ({block}@{district}.edubeam.com)
 *  500  school principals    ({siteCode}@edubeam.com)
 * 61120 students             st{siteCode}{admNo}@edubeam.com
 * 61120 parents              pr{siteCode}{admNo}@edubeam.com
 *
 * Password = username (part before @) for every account.
 * Admin/state logins already created by the main seed.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-logins.mjs
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const pg      = require('pg');
const bcrypt  = require('bcryptjs');
const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERROR: DATABASE_URL env var not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('render.com') || DB_URL.includes('neon')
    ? { rejectUnauthorized: false } : undefined,
  max: 8,
});

const COST_HIGH = 10;   // for admin/district/block/principal (few hundred)
const COST_BULK = 6;    // for student/parent (122 k rows, ~3 ms each)
const BATCH     = 500;  // rows per bulk insert

const BAD_ADMNOS = new Set(['#','##','###','####','#####','na','n/a','nil','none','0','']);

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').replace(/\.+/g, '.');
}

// Parallel bcrypt — bcrypt releases the GIL in the libuv thread pool
async function hashMany(passwords, cost) {
  return Promise.all(passwords.map(p => bcrypt.hash(p, cost)));
}

/** Single-row upsert for admin-level roles (few hundred). */
async function upsertUser(client, row) {
  await client.query(
    `INSERT INTO "User"
       (id, email, "passwordHash", name, role, "tenantId",
        "districtId", "blockId", "schoolId", "studentId", "linkedStudentIds",
        active, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW())
     ON CONFLICT (email) DO UPDATE SET
       "passwordHash"      = EXCLUDED."passwordHash",
       role                = EXCLUDED.role,
       "tenantId"          = EXCLUDED."tenantId",
       "districtId"        = EXCLUDED."districtId",
       "blockId"           = EXCLUDED."blockId",
       "schoolId"          = EXCLUDED."schoolId"`,
    [
      row.id, row.email, row.passwordHash, row.name, row.role, row.tenantId,
      row.districtId ?? null, row.blockId ?? null, row.schoolId ?? null,
      null, null,
    ],
  );
}

/**
 * Multi-row bulk insert for students/parents.
 * Uses ON CONFLICT DO NOTHING — idempotent, won't re-hash on re-deploy.
 */
async function bulkInsertUsers(client, rows) {
  if (!rows.length) return;
  const cols = [
    'id','email','"passwordHash"','name','role','"tenantId"',
    '"districtId"','"blockId"','"schoolId"','"studentId"','"linkedStudentIds"',
    'active','"createdAt"',
  ];
  const placeholders = rows.map((_, i) => {
    const base = i * 13;
    return `(${Array.from({length: 13}, (_, j) => `$${base + j + 1}`).join(',')})`;
  });
  const values = rows.flatMap(r => [
    r.id, r.email, r.passwordHash, r.name, r.role, r.tenantId,
    r.districtId ?? null, null, r.schoolId ?? null,
    r.studentId ?? null, r.linkedStudentIds ?? null,
    true, new Date().toISOString(),
  ]);
  await client.query(
    `INSERT INTO "User" (${cols.join(',')}) VALUES ${placeholders.join(',')}
     ON CONFLICT (email) DO NOTHING`,
    values,
  );
}

async function main() {
  const client = await pool.connect();
  try {
    // ── reference data ──────────────────────────────────────────────────────
    const { rows: tenants }   = await client.query('SELECT id FROM "Tenant" LIMIT 1');
    const tenantId = tenants[0]?.id;
    if (!tenantId) { console.error('ERROR: No tenant — run the main seed first.'); process.exit(1); }

    const { rows: districts } = await client.query(
      'SELECT id, name FROM "District" WHERE "tenantId"=$1 ORDER BY name', [tenantId]);
    const { rows: blocks }    = await client.query(
      `SELECT b.id, b.name, b."districtId", d.name AS district_name
       FROM "Block" b JOIN "District" d ON d.id=b."districtId" ORDER BY d.name,b.name`);
    const { rows: schools }   = await client.query(
      `SELECT s.id, s.name, s."udiseCode", s."siteCode", b."districtId"
       FROM "School" s JOIN "Block" b ON b.id=s."blockId" ORDER BY s.name`);

    const csvRows = [];
    let created = 0;

    // ── district officials ──────────────────────────────────────────────────
    console.log(`\nDistrict officials (${districts.length})…`);
    for (const d of districts) {
      const u = slugify(d.name);
      await upsertUser(client, {
        id: `ud_${u}`, email: `${u}@edubeam.com`,
        passwordHash: await bcrypt.hash(u, COST_HIGH),
        name: `${d.name} District Official`, role: 'DISTRICT_OFFICIAL',
        tenantId, districtId: d.id,
      });
      csvRows.push({ role:'DISTRICT_OFFICIAL', email:`${u}@edubeam.com`, password:u, scope:d.name });
      created++; process.stdout.write('.');
    }
    console.log();

    // ── block officials ─────────────────────────────────────────────────────
    console.log(`Block officials (${blocks.length})…`);
    for (const b of blocks) {
      const bs = slugify(b.name), ds = slugify(b.district_name);
      const email = `${bs}@${ds}.edubeam.com`;
      await upsertUser(client, {
        id: `ub_${ds}_${bs}`, email,
        passwordHash: await bcrypt.hash(bs, COST_HIGH),
        name: `${b.name} Block Official`, role: 'BLOCK_OFFICIAL',
        tenantId, districtId: b.districtId, blockId: b.id,
      });
      csvRows.push({ role:'BLOCK_OFFICIAL', email, password:bs, scope:`${b.name} (${b.district_name})` });
      created++; process.stdout.write('.');
    }
    console.log();

    // ── school principals ───────────────────────────────────────────────────
    console.log(`School principals (${schools.length})…`);
    // Build siteCode map while we iterate
    const schoolSite = {};
    for (const s of schools) {
      const local = (s.siteCode || `s${s.udiseCode}`).toLowerCase();
      schoolSite[s.id] = local;
      await upsertUser(client, {
        id: `us_${local}`, email: `${local}@edubeam.com`,
        passwordHash: await bcrypt.hash(local, COST_HIGH),
        name: `Principal — ${s.name}`, role: 'PRINCIPAL',
        tenantId, districtId: s.districtId, schoolId: s.id,
      });
      csvRows.push({ role:'PRINCIPAL', email:`${local}@edubeam.com`, password:local, scope:s.name });
      created++; process.stdout.write('.');
    }
    console.log();

    // ── students + parents ──────────────────────────────────────────────────
    console.log('Loading students…');
    const { rows: students } = await client.query(
      `SELECT st.id, st.name, st."admissionNo", st."rollNo",
              st.grade, st.section, st."schoolId", st."guardianName",
              s.name AS school_name, b."districtId"
       FROM "Student" st
       JOIN "School"   s ON s.id = st."schoolId"
       JOIN "Block"    b ON b.id = s."blockId"
       ORDER BY s.name, st.grade`
    );
    console.log(`${students.length.toLocaleString()} students found`);

    const seenKeys = new Map();

    for (let i = 0; i < students.length; i += BATCH) {
      const chunk = students.slice(i, i + BATCH);

      // Build unique keys
      const stPws = [], prPws = [];
      const stMeta = [], prMeta = [];

      for (const s of chunk) {
        const site = schoolSite[s.schoolId] || 'school';
        let raw = (s.admissionNo || s.rollNo || '').replace(/\s+/g, '').toLowerCase();
        if (BAD_ADMNOS.has(raw)) raw = s.id.slice(0, 8);

        const dedup = `${site}|${raw}`;
        const cnt   = seenKeys.get(dedup) ?? 0;
        seenKeys.set(dedup, cnt + 1);
        const suffix = cnt === 0 ? '' : String.fromCharCode(98 + cnt - 1); // b,c,d…
        const key = `${site}${raw}${suffix}`;

        const grade = `Class ${s.grade}${s.section ? '-' + s.section : ''}`;

        stPws.push(`st${key}`);
        stMeta.push({ sid: s.id, name: s.name, schoolId: s.schoolId,
                      districtId: s.districtId, school_name: s.school_name, grade });

        prPws.push(`pr${key}`);
        prMeta.push({ sid: s.id, name: s.name, schoolId: s.schoolId,
                      districtId: s.districtId, school_name: s.school_name,
                      guardian: s.guardianName || '' });
      }

      // Hash both sets in parallel (cost 6 = ~3 ms/hash)
      const [stHashes, prHashes] = await Promise.all([
        hashMany(stPws, COST_BULK),
        hashMany(prPws, COST_BULK),
      ]);

      const stRows = stMeta.map((m, j) => ({
        id: `ustu_${stPws[j].slice(2)}`, email: `${stPws[j]}@edubeam.com`,
        passwordHash: stHashes[j], name: m.name, role: 'STUDENT',
        tenantId, districtId: m.districtId, schoolId: m.schoolId,
        studentId: m.sid, linkedStudentIds: null,
      }));
      const prRows = prMeta.map((m, j) => ({
        id: `upar_${prPws[j].slice(2)}`, email: `${prPws[j]}@edubeam.com`,
        passwordHash: prHashes[j], name: `Parent — ${m.name}`, role: 'PARENT',
        tenantId, districtId: m.districtId, schoolId: m.schoolId,
        studentId: null, linkedStudentIds: m.sid,
      }));

      await bulkInsertUsers(client, stRows);
      await bulkInsertUsers(client, prRows);
      created += stRows.length + prRows.length;

      const done = i + chunk.length;
      process.stdout.write(`\r  ${done.toLocaleString()} / ${students.length.toLocaleString()} (${Math.round(done*100/students.length)}%)`);
    }
    console.log('\n');

    // ── CSV summary (admin roles only — student CSV would be huge) ──────────
    const header = 'role,email,password,scope';
    const csvLines = csvRows.map(c =>
      [c.role, c.email, c.password, `"${c.scope.replace(/"/g,'""')}"`].join(','));
    writeFileSync('login-credentials.csv', [header, ...csvLines].join('\n'), 'utf8');

    console.log(`Done — ${created.toLocaleString()} logins created/updated.`);
    console.log(`District officials : ${districts.length}`);
    console.log(`Block officials    : ${blocks.length}`);
    console.log(`School principals  : ${schools.length}`);
    console.log(`Students           : ${students.length.toLocaleString()}`);
    console.log(`Parents            : ${students.length.toLocaleString()}`);
    console.log(`Admin CSV          : login-credentials.csv`);
  } catch (err) {
    console.error('ERROR:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
