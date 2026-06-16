/**
 * One-time script: replace generated sample students with real student data
 * from 496 school Excel files.
 *
 * Usage:
 *   DATABASE_URL="file:C:/Development/edubeam-lms/packages/db/prisma/dev.db" \
 *   node scripts/import-real-students.mjs
 */

import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../node_modules/xlsx');
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const EXCEL_DIR = 'C:/Users/Khan/Downloads/all excel school 13062026/all excel school 13062026';
const ACADEMIC_YEAR = '2025-26';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Normalise name for fuzzy matching: uppercase, collapse spaces, strip punctuation
function norm(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse "Class 11(A)" → { grade: 11, section: 'A' }
function parseClass(raw) {
  if (!raw) return { grade: null, section: null };
  const m = String(raw).match(/(\d+)\s*\(?\s*([A-Za-z])\s*\)?/);
  if (!m) return { grade: null, section: null };
  const grade = parseInt(m[1], 10);
  return { grade: grade >= 6 && grade <= 12 ? grade : null, section: m[2].toUpperCase() };
}

// Parse date: MM/DD/YYYY or DD/MM/YYYY or serial number
function parseDate(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    // Excel serial date
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d;
  }
  const s = String(raw).trim();
  // MM/DD/YYYY (Excel US format)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, a, b, y] = m.map(Number);
    // Heuristic: if first part > 12 it must be the day
    const [mo, dy] = a > 12 ? [b, a] : [a, b];
    return new Date(y, mo - 1, dy);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

async function main() {
  // Load all schools from DB
  const dbSchools = await prisma.school.findMany({ select: { id: true, name: true, udiseCode: true } });
  const normToSchool = new Map(dbSchools.map(s => [norm(s.name), s]));

  // Also build a word-overlap scorer for fallback matching
  function bestMatch(fileName) {
    const fileNorm = norm(fileName.replace('.xlsx', '').replace('SCHOOL', '').replace('  ', ' '));
    const fileWords = new Set(fileNorm.split(' ').filter(Boolean));

    // Exact match first
    if (normToSchool.has(fileNorm)) return normToSchool.get(fileNorm);

    // Substring match
    for (const [key, school] of normToSchool) {
      if (key.includes(fileNorm) || fileNorm.includes(key)) return school;
    }

    // Word overlap score
    let best = null, bestScore = 0;
    for (const [key, school] of normToSchool) {
      const dbWords = new Set(key.split(' ').filter(Boolean));
      const overlap = [...fileWords].filter(w => dbWords.has(w)).length;
      const score = overlap / Math.max(fileWords.size, dbWords.size);
      if (score > bestScore) { bestScore = score; best = school; }
    }
    return bestScore >= 0.5 ? best : null;
  }

  const files = readdirSync(EXCEL_DIR).filter(f => f.endsWith('.xlsx'));
  console.log(`Found ${files.length} Excel files`);

  // Wipe ALL existing students
  const deleted = await prisma.student.deleteMany();
  console.log(`Deleted ${deleted.count} sample students`);

  let totalInserted = 0;
  let matchedFiles = 0;
  let unmatchedFiles = [];

  for (const file of files) {
    const school = bestMatch(file);
    if (!school) {
      unmatchedFiles.push(file);
      continue;
    }

    const wb = XLSX.readFile(join(EXCEL_DIR, file));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const students = [];
    let idx = 0;
    for (const row of rows.slice(2)) {
      const admNo   = row[0];
      const name    = String(row[1] ?? '').trim();
      const clasRaw = row[2];
      const father  = String(row[3] ?? '').trim();
      const dob     = parseDate(row[4]);
      const gender  = String(row[5] ?? '').trim().toUpperCase().startsWith('M') ? 'M' : 'F';
      const category= String(row[6] ?? '').trim() || null;
      const phone   = row[7] ? String(row[7]).replace(/\D/g, '').slice(0, 10) : null;

      if (!name) continue;
      const { grade, section } = parseClass(clasRaw);

      // Normalise category to allowed values
      const catNorm = (category ?? '').toUpperCase();
      const cat = ['OBC', 'SC', 'ST'].includes(catNorm) ? catNorm : 'GEN';

      students.push({
        schoolId:        school.id,
        name,
        gender,
        grade:           grade ?? 9,
        section:         section ?? 'A',
        rollNo:          admNo ? String(admNo) : String(idx + 1),
        admissionNo:     admNo ? String(admNo) : null,
        guardianName:    father || null,
        guardianPhone:   phone || null,
        guardianRelation:'Father',
        category:        cat,
        isRte:           false,
        isDropout:       false,
        dropoutReason:   null,
        dateOfBirth:     dob,
        academicYear:    ACADEMIC_YEAR,
      });
      idx++;
    }

    // Batch insert
    for (let i = 0; i < students.length; i += 500) {
      try {
        await prisma.student.createMany({ data: students.slice(i, i + 500), skipDuplicates: true });
      } catch (e) {
        // Try one-by-one to find the bad record
        for (const rec of students.slice(i, i + 500)) {
          try {
            await prisma.student.create({ data: rec });
          } catch (e2) {
            console.error(`\nBad record in ${file}:`, JSON.stringify(rec));
            console.error('Error:', e2.message.slice(0, 200));
          }
        }
      }
    }
    totalInserted += students.length;
    matchedFiles++;
    process.stdout.write(`\r  Imported ${totalInserted} students from ${matchedFiles} schools...`);
  }

  console.log(`\n\nDone!`);
  console.log(`  Matched files:   ${matchedFiles}`);
  console.log(`  Unmatched files: ${unmatchedFiles.length}`);
  console.log(`  Total students:  ${totalInserted}`);

  if (unmatchedFiles.length > 0) {
    console.log('\nUnmatched files (no school found in DB):');
    unmatchedFiles.forEach(f => console.log('  -', f));
  }

  const finalCount = await prisma.student.count();
  console.log(`\nDB student count: ${finalCount}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
