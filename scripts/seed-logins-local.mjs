/**
 * Local SQLite login seeder — creates student + parent logins for a school.
 * Works with SQLite (local dev). For production use seed-logins.mjs (PostgreSQL).
 *
 * Usage:
 *   DATABASE_URL="file:..." node scripts/seed-logins-local.mjs [schoolId]
 *
 * If schoolId is omitted, seeds the first school in each demo state (t_mh, t_od)
 * plus a sample from UK (first 20 students).
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('ERROR: DATABASE_URL not set'); process.exit(1); }

const dbPath = DB_URL.replace(/^file:/, '');
const db = new Database(dbPath);

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').replace(/\.+/g, '.').slice(0, 30);
}

const schoolIdArg = process.argv[2];

let students;
if (schoolIdArg) {
  students = db.prepare(`SELECT s.*, sc.id as schoolId FROM Student s JOIN School sc ON s.schoolId = sc.id WHERE s.schoolId = ? AND s.active = 1`).all(schoolIdArg);
} else {
  // Demo MH and OD schools + first 20 UK students
  const mhOdStudents = db.prepare(`
    SELECT s.* FROM Student s
    JOIN School sc ON s.schoolId = sc.id
    JOIN Block b ON sc.blockId = b.id
    JOIN District d ON b.districtId = d.id
    WHERE d.tenantId IN ('t_mh', 't_od') AND s.active = 1
  `).all();
  const ukStudents = db.prepare(`
    SELECT s.* FROM Student s
    JOIN School sc ON s.schoolId = sc.id
    JOIN Block b ON sc.blockId = b.id
    JOIN District d ON b.districtId = d.id
    WHERE d.tenantId = 't_uk' AND s.active = 1
    LIMIT 20
  `).all();
  students = [...mhOdStudents, ...ukStudents];
}

console.log(`Seeding logins for ${students.length} students...`);

const insertUser = db.prepare(`
  INSERT INTO User (id, email, passwordHash, name, role, tenantId, districtId, blockId, schoolId, studentId, linkedStudentIds, active, createdAt)
  VALUES (?, ?, ?, ?, 'STUDENT', NULL, NULL, NULL, ?, ?, NULL, 1, datetime('now'))
  ON CONFLICT(email) DO UPDATE SET passwordHash = excluded.passwordHash, studentId = excluded.studentId, schoolId = excluded.schoolId
`);

const insertParent = db.prepare(`
  INSERT INTO User (id, email, passwordHash, name, role, tenantId, districtId, blockId, schoolId, studentId, linkedStudentIds, active, createdAt)
  VALUES (?, ?, ?, ?, 'PARENT', NULL, NULL, NULL, ?, NULL, ?, 1, datetime('now'))
  ON CONFLICT(email) DO UPDATE SET passwordHash = excluded.passwordHash, linkedStudentIds = excluded.linkedStudentIds
`);

let created = 0, skipped = 0;

const upsertMany = db.transaction((rows) => {
  for (const s of rows) {
    const admNo = (s.admissionNo ?? s.id.slice(0, 8)).toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `st${admNo}`;
    const email = `${username}@edubeam.com`;
    const hash = bcrypt.hashSync(username, 6);

    try {
      insertUser.run(
        randomUUID(), email, hash, s.name, s.schoolId, s.id
      );

      // Parent login
      const parentUsername = `pr${admNo}`;
      const parentEmail = `${parentUsername}@edubeam.com`;
      const parentName = s.guardianName ?? `Parent of ${s.name}`;
      const parentHash = bcrypt.hashSync(parentUsername, 6);
      insertParent.run(
        randomUUID(), parentEmail, parentHash, parentName, s.schoolId, s.id
      );
      created++;
    } catch (e) {
      skipped++;
    }
  }
});

upsertMany(students);

// Print sample credentials
console.log(`\nDone: ${created} created, ${skipped} skipped.`);
console.log('\nSample student logins:');
const sample = students.slice(0, 8);
for (const s of sample) {
  const admNo = (s.admissionNo ?? s.id.slice(0, 8)).toLowerCase().replace(/[^a-z0-9]/g, '');
  console.log(`  st${admNo}@edubeam.com  /  st${admNo}   (${s.name}, Class ${s.grade})`);
}

db.close();
