/**
 * One-time script: replace generated sample staff with real teacher/staff data
 * from 485 school Excel files.
 *
 * Usage:
 *   DATABASE_URL="file:C:/Development/edubeam-lms/packages/db/prisma/dev.db" \
 *   node scripts/import-real-staff.mjs
 */

import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../node_modules/xlsx');

import { readdirSync } from 'fs';
import { join } from 'path';

const EXCEL_DIR = 'C:/Users/Khan/Downloads/Teacher staff 2023-24/Teacher staff';
const ACADEMIC_YEAR = '2025-26';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

function norm(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\(\d+\)/g, '')        // strip (2), (3) suffixes
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestMatch(fileName, normToSchool) {
  const fileNorm = norm(fileName.replace('.xlsx', ''));
  const fileWords = new Set(fileNorm.split(' ').filter(Boolean));

  if (normToSchool.has(fileNorm)) return normToSchool.get(fileNorm);

  for (const [key, school] of normToSchool) {
    if (key.includes(fileNorm) || fileNorm.includes(key)) return school;
  }

  let best = null, bestScore = 0;
  for (const [key, school] of normToSchool) {
    const dbWords = new Set(key.split(' ').filter(Boolean));
    const overlap = [...fileWords].filter(w => dbWords.has(w)).length;
    const score = overlap / Math.max(fileWords.size, dbWords.size);
    if (score > bestScore) { bestScore = score; best = school; }
  }
  return bestScore >= 0.5 ? best : null;
}

// Map Role text → staffType enum
function mapStaffType(role) {
  const r = String(role ?? '').toLowerCase();
  if (r.includes('principal') || r.includes('head master') || r.includes('headmaster')) return 'PRINCIPAL';
  if (r.includes('lab')) return 'LAB_ASSISTANT';
  return 'TEACHER';
}

// GGIC schools are all-girls schools → staff likely female; GIC mixed → unknown
function inferGender(schoolName) {
  return String(schoolName).toUpperCase().startsWith('GGIC') ? 'F' : 'M';
}

async function main() {
  const dbSchools = await prisma.school.findMany({ select: { id: true, name: true } });
  const normToSchool = new Map(dbSchools.map(s => [norm(s.name), s]));

  const files = readdirSync(EXCEL_DIR).filter(f => f.endsWith('.xlsx'));
  console.log(`Found ${files.length} staff Excel files`);

  const deleted = await prisma.staff.deleteMany();
  console.log(`Deleted ${deleted.count} sample staff`);

  let totalInserted = 0;
  let matchedFiles = 0;
  const unmatchedFiles = [];

  for (const file of files) {
    const school = bestMatch(file, normToSchool);
    if (!school) {
      unmatchedFiles.push(file);
      continue;
    }

    const wb = XLSX.readFile(join(EXCEL_DIR, file));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const staffRecords = [];
    let idx = 0;
    for (const row of rows.slice(2)) {
      const staffId  = row[0];
      const name     = String(row[1] ?? '').trim();
      const role     = String(row[2] ?? '').trim();
      const dept     = String(row[3] ?? '').trim() || null;
      const desg     = String(row[4] ?? '').trim() || null;
      const phone    = row[5] ? String(row[5]).replace(/\D/g, '').slice(0, 10) : null;

      if (!name) continue;
      // Skip system admin entries
      if (role.toLowerCase().includes('super admin') || name.toLowerCase().includes('super admin')) continue;

      staffRecords.push({
        schoolId:       school.id,
        name,
        gender:         inferGender(school.name),
        staffType:      mapStaffType(role),
        designation:    desg ?? role ?? null,
        department:     dept,
        phone:          phone || null,
        employeeId:     staffId ? String(staffId) : null,
        academicYear:   ACADEMIC_YEAR,
      });
      idx++;
    }

    for (let i = 0; i < staffRecords.length; i += 500) {
      await prisma.staff.createMany({ data: staffRecords.slice(i, i + 500) });
    }
    totalInserted += staffRecords.length;
    matchedFiles++;
    process.stdout.write(`\r  Imported ${totalInserted} staff from ${matchedFiles} schools...`);
  }

  console.log(`\n\nDone!`);
  console.log(`  Matched files:   ${matchedFiles}`);
  console.log(`  Unmatched files: ${unmatchedFiles.length}`);
  console.log(`  Total staff:     ${totalInserted}`);

  if (unmatchedFiles.length > 0) {
    console.log('\nUnmatched files:');
    unmatchedFiles.slice(0, 20).forEach(f => console.log('  -', f));
  }

  const finalCount = await prisma.staff.count();
  console.log(`\nDB staff count: ${finalCount}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
