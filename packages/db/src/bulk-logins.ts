/**
 * Bulk login generator.
 *
 * Creates PRINCIPAL, STUDENT and PARENT logins for every school and student
 * in the database. Idempotent — safe to re-run (upserts).
 *
 * Outputs: login-credentials-all.xlsx in the repo root.
 *
 * Usage:
 *   npm --workspace packages/db run bulk-logins
 *
 * Forces re-hash of passwords (useful after a domain change).
 */
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Always build an absolute path — the .env has a relative path which breaks when
// tsx is invoked outside packages/db.
const pgUrl = process.env.DATABASE_URL;
const dbUrl = pgUrl?.startsWith('postgres')
  ? pgUrl
  : `file:${join(__dirname, '../prisma/dev.db').replace(/\\/g, '/')}`;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });


const COST = 6;          // fast (≈3 ms each) — suitable for bulk, username = password
const BATCH = 200;       // parallel bcrypt operations per round
const DOMAIN = 'edubeam.com';
const TENANT_ID = 't_uk';

// ── helpers ──────────────────────────────────────────────────────────────────

const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').replace(/\.+/g, '.');

async function hashBatch(passwords: string[]): Promise<string[]> {
  return Promise.all(passwords.map((p) => bcrypt.hash(p, COST)));
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  districtId: string | null;
  blockId: string | null;
  schoolId: string | null;
  studentId: string | null;
  linkedStudentIds: string | null;
  passwordHash: string;
};

async function upsertUserBatch(rows: UserRow[], attempt = 0): Promise<void> {
  try {
    if (dbUrl.startsWith('postgres')) {
      await (prisma.user as any).createMany({
        data: rows.map((r) => ({ ...r, tenantId: TENANT_ID, active: true })),
        skipDuplicates: true,
      });
    } else {
      const now = new Date().toISOString();
      const esc = (v: string | null) => (v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
      const vals = rows
        .map(
          (r) =>
            `(${esc(r.id)},${esc(r.email)},${esc(r.passwordHash)},${esc(r.name)},${esc(r.role)},${esc(TENANT_ID)},${esc(r.districtId)},${esc(r.blockId)},${esc(r.schoolId)},${esc(r.studentId)},${esc(r.linkedStudentIds)},1,${esc(now)})`,
        )
        .join(',');
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "User" (id,email,"passwordHash",name,role,"tenantId","districtId","blockId","schoolId","studentId","linkedStudentIds",active,"createdAt") VALUES ${vals}`,
      );
    }
  } catch (e: any) {
    // Retry on SQLite "database is locked" (code 5) — another writer may be briefly holding the lock
    if (e?.meta?.code === '5' && attempt < 10) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return upsertUserBatch(rows, attempt + 1);
    }
    throw e;
  }
}

// ── process in chunks ─────────────────────────────────────────────────────────

async function processBatches<T>(
  items: T[],
  label: string,
  buildRow: (item: T) => { id: string; email: string; password: string; name: string; role: string; districtId: string | null; blockId: string | null; schoolId: string | null; studentId: string | null; linkedStudentIds: string | null },
): Promise<{ email: string; password: string; name: string; role: string; scope: string; school: string }[]> {
  const results: { email: string; password: string; name: string; role: string; scope: string; school: string }[] = [];
  let done = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const rows = chunk.map(buildRow);
    const hashes = await hashBatch(rows.map((r) => r.password));
    await upsertUserBatch(rows.map((r, j) => {
      const { password: _pw, ...rest } = r;
      return { ...rest, passwordHash: hashes[j] };
    }));
    for (const r of rows) results.push({ email: r.email, password: r.password, name: r.name, role: r.role, scope: '', school: '' });
    done += chunk.length;
    if (Math.floor(done / 500) > Math.floor((done - chunk.length) / 500))
      console.log(`  ${label}: ${done.toLocaleString()} / ${items.length.toLocaleString()}`);
  }
  return results;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' Edubeam LMS — Bulk Login Generator');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` Provider : ${dbUrl.startsWith('postgres') ? 'PostgreSQL' : 'SQLite'}`);
  console.log(` Batch    : ${BATCH}  |  bcrypt cost : ${COST}`);
  console.log('───────────────────────────────────────────────────────────\n');

  // SQLite: wait up to 30 s if another writer holds the lock
  if (!dbUrl.startsWith('postgres')) {
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 30000');
  }

  // ── 1. School (Principal) logins ──────────────────────────────────────────
  console.log('▶  Loading schools…');
  const schools = await prisma.school.findMany({
    include: { block: { include: { district: true } } },
    orderBy: { name: 'asc' },
  });
  console.log(`   ${schools.length} schools found`);

  const schoolRows = await processBatches(
    schools,
    'Schools',
    (s) => {
      const localPart = s.siteCode ? s.siteCode.toLowerCase() : `s${s.udiseCode}`;
      return {
        id: `us_${localPart}`,
        email: `${localPart}@${DOMAIN}`,
        password: localPart,
        name: `Principal — ${s.name}`,
        role: 'PRINCIPAL',
        districtId: s.block?.districtId ?? null,
        blockId: null,
        schoolId: s.id,
        studentId: null,
        linkedStudentIds: null,
      };
    },
  );
  for (let i = 0; i < schoolRows.length; i++) {
    schoolRows[i].scope = schools[i].block?.district?.name ?? '';
    schoolRows[i].school = schools[i].name;
  }
  console.log(`   ✔ ${schoolRows.length} principal logins created/updated\n`);

  // ── 2. Student logins ─────────────────────────────────────────────────────
  console.log('▶  Loading students…');
  const students = await prisma.student.findMany({
    include: { school: { include: { block: { include: { district: true } } } } },
    orderBy: [{ school: { name: 'asc' } }, { grade: 'asc' }],
  });
  console.log(`   ${students.length.toLocaleString()} students found`);

  const studentRows = await processBatches(
    students,
    'Students',
    (s) => {
      const key = (s.admissionNo || s.rollNo || s.id).replace(/\s+/g, '').toLowerCase();
      const localPart = `st${key}`;
      return {
        id: `ustu_${key}`,
        email: `${localPart}@${DOMAIN}`,
        password: localPart,
        name: s.name,
        role: 'STUDENT',
        districtId: s.school?.block?.districtId ?? null,
        blockId: null,
        schoolId: s.schoolId,
        studentId: s.id,
        linkedStudentIds: null,
      };
    },
  );
  for (let i = 0; i < studentRows.length; i++) {
    studentRows[i].scope = `Class ${students[i].grade}${students[i].section ? '-' + students[i].section : ''}`;
    studentRows[i].school = students[i].school?.name ?? '';
  }
  console.log(`   ✔ ${studentRows.length.toLocaleString()} student logins created/updated\n`);

  // ── 3. Parent logins ──────────────────────────────────────────────────────
  console.log('▶  Creating parent logins…');
  const parentRows = await processBatches(
    students,
    'Parents',
    (s) => {
      const key = (s.admissionNo || s.rollNo || s.id).replace(/\s+/g, '').toLowerCase();
      const localPart = `pr${key}`;
      return {
        id: `upar_${key}`,
        email: `${localPart}@${DOMAIN}`,
        password: localPart,
        name: `Parent — ${s.name}`,
        role: 'PARENT',
        districtId: s.school?.block?.districtId ?? null,
        blockId: null,
        schoolId: s.schoolId,
        studentId: null,
        linkedStudentIds: s.id,
      };
    },
  );
  for (let i = 0; i < parentRows.length; i++) {
    parentRows[i].scope = students[i].guardianName ?? '';
    parentRows[i].school = students[i].school?.name ?? '';
  }
  console.log(`   ✔ ${parentRows.length.toLocaleString()} parent logins created/updated\n`);

  // ── 4. Build Excel workbook ───────────────────────────────────────────────
  console.log('▶  Generating Excel workbook…');
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Edubeam LMS — All Login Credentials', '', '', ''],
    ['Generated on', new Date().toLocaleString('en-IN'), '', ''],
    ['', '', '', ''],
    ['Category', 'Count', 'Username format', 'Password rule'],
    ['School / Principal', schoolRows.length, '{sitecode}@edubeam.com', 'Same as username'],
    ['Student', studentRows.length, 'st{admissionNo}@edubeam.com', 'Same as username'],
    ['Parent', parentRows.length, 'pr{admissionNo}@edubeam.com', 'Same as username'],
    ['', '', '', ''],
    ['TOTAL', schoolRows.length + studentRows.length + parentRows.length, '', ''],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // School logins sheet
  const schoolHeader = ['Role', 'School Name', 'District', 'Email (Username)', 'Password'];
  const schoolData = [
    schoolHeader,
    ...schoolRows.map((r) => ['Principal', r.school, r.scope, r.email, r.password]),
  ];
  const schoolSheet = XLSX.utils.aoa_to_sheet(schoolData);
  schoolSheet['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 18 }, { wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, schoolSheet, 'School Principals');

  // Student logins sheet
  const studentHeader = ['Role', 'Student Name', 'School', 'Grade', 'Email (Username)', 'Password'];
  const studentData = [
    studentHeader,
    ...studentRows.map((r) => ['Student', r.name, r.school, r.scope, r.email, r.password]),
  ];
  const studentSheet = XLSX.utils.aoa_to_sheet(studentData);
  studentSheet['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 40 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, studentSheet, 'Students');

  // Parent logins sheet
  const parentHeader = ['Role', 'Parent of', 'School', 'Guardian', 'Email (Username)', 'Password'];
  const parentData = [
    parentHeader,
    ...parentRows.map((r) => ['Parent', r.name.replace('Parent — ', ''), r.school, r.scope, r.email, r.password]),
  ];
  const parentSheet = XLSX.utils.aoa_to_sheet(parentData);
  parentSheet['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 35 }, { wch: 25 }, { wch: 40 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, parentSheet, 'Parents');

  const outPath = join(__dirname, '../../../login-credentials-all.xlsx');
  console.log(`▶  Writing Excel to: ${outPath}`);
  XLSX.writeFile(wb, outPath);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(` ✅  Done!`);
  console.log(`    Principal logins : ${schoolRows.length.toLocaleString()}`);
  console.log(`    Student logins   : ${studentRows.length.toLocaleString()}`);
  console.log(`    Parent logins    : ${parentRows.length.toLocaleString()}`);
  console.log(`    Total            : ${(schoolRows.length + studentRows.length + parentRows.length).toLocaleString()}`);
  console.log(`    Excel file       : login-credentials-all.xlsx`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
