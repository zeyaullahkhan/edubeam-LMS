/**
 * One-shot script: copy ALL data from local SQLite to Render Postgres.
 * Clears every table in Render first, then inserts from SQLite in FK order.
 *
 * Usage (from repo root):
 *   node scripts/migrate-to-render.mjs
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require  = createRequire(import.meta.url);
const __dir    = dirname(fileURLToPath(import.meta.url));

const { PrismaClient } = require('../node_modules/@prisma/client/index.js');
const pg = require('pg');
const { Pool } = pg;

// ── Connection strings ───────────────────────────────────────────────────────
// Set RENDER_DATABASE_URL in your shell before running:
//   export RENDER_DATABASE_URL="postgresql://user:pass@host/db"
const SQLITE_URL = `file:${join(__dir, '..', 'packages', 'db', 'prisma', 'dev.db').replace(/\\/g, '/')}`;
const PG_URL     = process.env.RENDER_DATABASE_URL;
if (!PG_URL) { console.error('ERROR: RENDER_DATABASE_URL env var not set'); process.exit(1); }

console.log('Source :', SQLITE_URL);
console.log('Target : Render Postgres (oregon)\n');

const src  = new PrismaClient({ datasources: { db: { url: SQLITE_URL } } });
const pool = new Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false }, max: 3 });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Batch insert rows into a Postgres table. */
async function bulkInsert(client, table, rows, fields) {
  if (!rows.length) return 0;
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    // Build: INSERT INTO "T" ("f1","f2",...) VALUES ($1,$2,...),($n+1,...) ON CONFLICT DO NOTHING
    const cols = fields.map(f => `"${f}"`).join(',');
    const valueClauses = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      const placeholders = fields.map(() => `$${p++}`).join(',');
      valueClauses.push(`(${placeholders})`);
      for (const f of fields) {
        let val = row[f] ?? null;
        // Prisma returns Date objects for DateTime; pg accepts them natively.
        params.push(val);
      }
    }
    await client.query(
      `INSERT INTO "${table}" (${cols}) VALUES ${valueClauses.join(',')} ON CONFLICT DO NOTHING`,
      params
    );
    inserted += batch.length;
  }
  return inserted;
}

/** Delete all rows from tables in reverse-FK order. */
async function clearAll(client) {
  const tables = [
    'ExamResult', 'StaffAttendance', 'Attendance',
    'Staff', 'Student', 'User',
    'IctDeployment', 'YearlyResult', 'BoardResult', 'Enrollment',
    'Lecture', 'ContentChannel',
    'School', 'Block', 'District', 'Tenant',
  ];
  for (const t of tables) {
    await client.query(`DELETE FROM "${t}"`);
    process.stdout.write(`  cleared ${t}\n`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    // ── 1. Clear Render DB ─────────────────────────────────────────────────
    console.log('Step 1 — Clearing Render tables...');
    await clearAll(client);

    // ── 2. Migrate table by table ──────────────────────────────────────────
    console.log('\nStep 2 — Migrating data...');

    // Tenant
    const tenants = await src.tenant.findMany();
    await bulkInsert(client, 'Tenant', tenants, ['id','name','code','createdAt']);
    console.log(`  Tenant         : ${tenants.length}`);

    // District
    const districts = await src.district.findMany();
    await bulkInsert(client, 'District', districts, ['id','tenantId','name']);
    console.log(`  District       : ${districts.length}`);

    // Block
    const blocks = await src.block.findMany();
    await bulkInsert(client, 'Block', blocks, ['id','districtId','name']);
    console.log(`  Block          : ${blocks.length}`);

    // School
    const schools = await src.school.findMany();
    await bulkInsert(client, 'School', schools, [
      'id','blockId','name','udiseCode','siteCode','type',
      'hasVirtualClassroom','hasIctLab','address','principalName','phone',
    ]);
    console.log(`  School         : ${schools.length}`);

    // Enrollment
    const enrollments = await src.enrollment.findMany();
    await bulkInsert(client, 'Enrollment', enrollments, [
      'id','schoolId','academicYear','grade','boys','girls','total',
    ]);
    console.log(`  Enrollment     : ${enrollments.length}`);

    // BoardResult
    const boardResults = await src.boardResult.findMany();
    await bulkInsert(client, 'BoardResult', boardResults, [
      'id','schoolId','examType','subject','passPct','academicYear',
    ]);
    console.log(`  BoardResult    : ${boardResults.length}`);

    // YearlyResult
    const yearlyResults = await src.yearlyResult.findMany();
    await bulkInsert(client, 'YearlyResult', yearlyResults, [
      'id','schoolId','year','examType','passPct',
    ]);
    console.log(`  YearlyResult   : ${yearlyResults.length}`);

    // IctDeployment
    const icts = await src.ictDeployment.findMany();
    await bulkInsert(client, 'IctDeployment', icts, [
      'id','schoolId','teacherCount','studentCount','academicYear',
      'lanIp','subnetMask','iduSerialNo','newIduSerialNo','iduModel',
      'materialStatus','installRemark','engineerName','scheduledDate','certUpdate',
    ]);
    console.log(`  IctDeployment  : ${icts.length}`);

    // Student  (potentially large — shown with progress)
    let offset = 0;
    const STUDENT_BATCH = 1000;
    let totalStudents = 0;
    process.stdout.write('  Student        : ');
    while (true) {
      const rows = await src.student.findMany({ skip: offset, take: STUDENT_BATCH });
      if (!rows.length) break;
      await bulkInsert(client, 'Student', rows, [
        'id','schoolId','admissionNo','rollNo','name','gender','dateOfBirth',
        'grade','section','guardianName','guardianPhone','guardianRelation',
        'address','category','religion','isRte','bankAccount','healthNotes',
        'isDropout','dropoutReason','academicYear','active','createdAt',
      ]);
      totalStudents += rows.length;
      process.stdout.write(`${totalStudents}...`);
      offset += rows.length;
      if (rows.length < STUDENT_BATCH) break;
    }
    process.stdout.write(` done\n`);

    // Staff  (potentially large)
    offset = 0;
    let totalStaff = 0;
    process.stdout.write('  Staff          : ');
    while (true) {
      const rows = await src.staff.findMany({ skip: offset, take: STUDENT_BATCH });
      if (!rows.length) break;
      await bulkInsert(client, 'Staff', rows, [
        'id','schoolId','employeeId','name','gender','dateOfBirth','staffType',
        'designation','qualification','subjects','phone','email','department',
        'salaryGroup','joiningDate','isClassTeacher','classTeacherOf','active',
        'academicYear','createdAt',
      ]);
      totalStaff += rows.length;
      process.stdout.write(`${totalStaff}...`);
      offset += rows.length;
      if (rows.length < STUDENT_BATCH) break;
    }
    process.stdout.write(` done\n`);

    // User
    const users = await src.user.findMany();
    await bulkInsert(client, 'User', users, [
      'id','email','passwordHash','name','role','tenantId','districtId',
      'schoolId','studentId','linkedStudentIds','active','createdAt',
    ]);
    console.log(`  User           : ${users.length}`);

    // Attendance
    offset = 0;
    let totalAtt = 0;
    const rows0 = await src.attendance.findMany({ take: 1 });
    if (rows0.length) {
      process.stdout.write('  Attendance     : ');
      while (true) {
        const rows = await src.attendance.findMany({ skip: offset, take: 2000 });
        if (!rows.length) break;
        await bulkInsert(client, 'Attendance', rows, [
          'id','studentId','schoolId','date','status','markedBy','academicYear',
        ]);
        totalAtt += rows.length;
        process.stdout.write(`${totalAtt}...`);
        offset += rows.length;
        if (rows.length < 2000) break;
      }
      process.stdout.write(` done\n`);
    } else {
      console.log('  Attendance     : 0 (skipped)');
    }

    // StaffAttendance
    const staffAtt = await src.staffAttendance.findMany();
    await bulkInsert(client, 'StaffAttendance', staffAtt, [
      'id','staffId','schoolId','date','status','markedBy','academicYear',
    ]);
    console.log(`  StaffAttendance: ${staffAtt.length}`);

    // ExamResult
    const examResults = await src.examResult.findMany();
    await bulkInsert(client, 'ExamResult', examResults, [
      'id','studentId','schoolId','subject','grade','section','examType',
      'academicYear','marksObtained','maxMarks','grade_letter','remarks',
    ]);
    console.log(`  ExamResult     : ${examResults.length}`);

    // Lecture
    const lectures = await src.lecture.findMany();
    await bulkInsert(client, 'Lecture', lectures, [
      'id','srNo','date','studioName','medium','startTime','endTime',
      'standard','teacherName','subject','topic','youtubeUrl',
    ]);
    console.log(`  Lecture        : ${lectures.length}`);

    // ContentChannel
    const channels = await src.contentChannel.findMany();
    await bulkInsert(client, 'ContentChannel', channels, [
      'id','studioName','channelName','channelUrl',
    ]);
    console.log(`  ContentChannel : ${channels.length}`);

    console.log('\n✅  Migration complete — Render database now mirrors local SQLite.');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
    await src.$disconnect();
  }
}

main().catch(() => process.exit(1));
