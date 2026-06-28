/**
 * One-time import script: replaces synthetic Student rows with real student
 * data from the 496 school Excel files.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx src/import-students.ts "<path-to-excel-folder>"
 *
 * Or via npm script:
 *   npm --workspace packages/db run import-students -- "<path-to-excel-folder>"
 *
 * Safe to re-run — deletes existing students per school before reinserting.
 * The Enrollment table (dashboard counts) is NOT touched.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

function importUrl() {
  const base = process.env.DATABASE_URL ?? '';
  const sep = base.includes('?') ? '&' : '?';
  const stripped = base
    .replace(/[?&]connection_limit=\d+/g, '')
    .replace(/[?&]pool_timeout=\d+/g, '');
  return stripped + sep + 'connection_limit=2&pool_timeout=60';
}

let prisma = new PrismaClient({ datasources: { db: { url: importUrl() } } });
const ACADEMIC_YEAR = '2025-26';

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Parse "Class 11(A)" → { grade: 11, section: "A" }. Fallback grade 6, section A. */
function parseClass(raw: unknown): { grade: number; section: string } {
  const s = raw == null ? '' : String(raw).trim();
  const m = s.match(/class\s*(\d+)\s*\(([A-Za-z])\)/i);
  if (m) return { grade: parseInt(m[1], 10), section: m[2].toUpperCase() };
  // try without section: "Class 11"
  const m2 = s.match(/class\s*(\d+)/i);
  if (m2) return { grade: parseInt(m2[1], 10), section: 'A' };
  return { grade: 6, section: 'A' };
}

function parseGender(raw: unknown): string {
  const s = raw == null ? '' : String(raw).toUpperCase().trim();
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M')) return 'M';
  return 'M';
}

function parseCategory(raw: unknown): string {
  const s = raw == null ? '' : String(raw).toUpperCase().trim();
  if (['GEN', 'OBC', 'SC', 'ST'].includes(s)) return s;
  return 'GEN';
}

function parseDob(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw).trim();
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parsePhone(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\D/g, '').trim();
  return s.length >= 7 ? s : null;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 8): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const transient =
        e?.code === 'P1017' || e?.code === 'P1001' || e?.code === 'P1008' ||
        /closed the connection|Can't reach database|Server has closed/i.test(e?.message ?? '');
      if (!transient || attempt >= attempts) throw e;
      const delay = attempt * 2000;
      console.log(`  [retry] ${label} – reconnecting in ${delay / 1000}s (attempt ${attempt + 1}/${attempts})`);
      await new Promise(r => setTimeout(r, delay));
      // Recreate the entire client — $disconnect/$connect is not enough in Prisma 5
      try { await prisma.$disconnect(); } catch {}
      prisma = new PrismaClient({ datasources: { db: { url: importUrl() } } });
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(dir)) {
    console.error('Usage: tsx src/import-students.ts "<path-to-excel-folder>"');
    process.exit(1);
  }

  await prisma.$connect();

  // Load all schools from DB and build normalized name → id map
  const allSchools = await prisma.school.findMany({ select: { id: true, name: true } });
  const schoolMap = new Map<string, string>(); // normalizedName → schoolId
  for (const s of allSchools) {
    schoolMap.set(normalizeName(s.name), s.id);
  }
  console.log(`\nLoaded ${allSchools.length} schools from DB.`);

  // List all Excel files
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();

  console.log(`Found ${files.length} Excel files to process.\n`);

  let matched = 0;
  let unmatched = 0;
  let totalInserted = 0;
  const unmatchedFiles: string[] = [];

  for (const filename of files) {
    const schoolName = basename(filename, '.xlsx'); // e.g. "GGIC AJABPUR"
    const normalized = normalizeName(schoolName);
    const schoolId = schoolMap.get(normalized);

    if (!schoolId) {
      unmatched++;
      unmatchedFiles.push(filename);
      continue;
    }

    matched++;
    const filePath = join(dir, filename);

    // Parse Excel rows
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    // header: 1 → array of arrays; skip row 0 (title) and row 1 (headers)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    const dataRows = rows.slice(2).filter(r => Array.isArray(r) && r[1] != null);

    const students = dataRows.map((r: any, idx) => {
      const { grade, section } = parseClass(r[2]);
      return {
        schoolId,
        admissionNo: r[0] != null ? String(r[0]).trim() : null,
        name: r[1] != null ? String(r[1]).trim() : 'Unknown',
        grade,
        section,
        guardianName: r[3] != null ? String(r[3]).trim() : null,
        fatherName:   r[3] != null ? String(r[3]).trim() : null,
        dateOfBirth:  parseDob(r[4]),
        gender:       parseGender(r[5]),
        category:     parseCategory(r[6]),
        guardianPhone: parsePhone(r[7] ?? null),
        guardianRelation: 'Father' as const,
        rollNo: String(idx + 1),
        academicYear: ACADEMIC_YEAR,
        active: true,
      };
    });

    // Delete existing students for this school then insert real ones
    await withRetry(`delete ${schoolName}`, () =>
      prisma.student.deleteMany({ where: { schoolId } })
    );

    // Insert in chunks of 200 to keep DB pressure low
    for (let i = 0; i < students.length; i += 200) {
      const chunk = students.slice(i, i + 200);
      await withRetry(`insert ${schoolName} chunk ${Math.floor(i / 200) + 1}`, () =>
        prisma.student.createMany({ data: chunk })
      );
    }

    totalInserted += students.length;
    console.log(`  ✓  ${schoolName.padEnd(40)} → ${students.length} students`);
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`Files processed : ${files.length}`);
  console.log(`Schools matched : ${matched}`);
  console.log(`Unmatched files : ${unmatched}`);
  console.log(`Students inserted: ${totalInserted}`);

  if (unmatchedFiles.length) {
    console.log('\nUnmatched files (schools not found in DB):');
    unmatchedFiles.forEach(f => console.log('  ✗', f));
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
