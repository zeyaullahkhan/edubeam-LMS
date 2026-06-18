/**
 * Edubeam LMS seed importer.
 *
 * Reads the three real Uttarakhand 2025-26 Excel files and loads them into the
 * database, building the District -> Block -> School hierarchy and the
 * Enrollment / BoardResult / IctDeployment records.
 *
 *   data/virtual.xlsx  -> ~500 Virtual Classroom schools, enrollment by grade/gender
 *   data/ict.xlsx      -> ~500 ICT Lab schools, teacher/student counts
 *   data/results.xlsx  -> 10th & 12th board pass % per school per subject
 *
 * All three join on the UDISE code. Run with: npm run db:seed
 */
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { prisma } from './client';

const ACADEMIC_YEAR = '2025-26';
const DATA_DIR = join(__dirname, '..', 'data');

// ── helpers ─────────────────────────────────────────────────────────────────

const clean = (v: unknown): string =>
  v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Normalise a UDISE code so the same school joins across files. The Virtual/ICT
 * sheets store an 11-digit code with a leading zero (e.g. 05090104505) while the
 * Results sheet drops it (5090104505); stripping leading zeros unifies them.
 */
const normalizeUdise = (v: unknown): string => clean(v).replace(/\.0$/, '').replace(/^0+/, '');

// Deterministic id slug so tenant/district/block/school ids stay STABLE across
// re-seeds. This keeps already-issued JWTs valid after a re-seed (the token's
// tenantId/districtId/schoolId still resolve) instead of silently scoping to 0.
const slug = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

/** Parse a board "passed %" cell into a 0..1 float, or null for NA/blank. */
function parsePct(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = clean(v);
  if (!s || /^(na|n\/a|-|nil)$/i.test(s)) return null;
  const n = Number(s.replace('%', ''));
  if (!Number.isFinite(n)) return null;
  // A few sheets express percentages as 0..100; normalise to 0..1.
  return n > 1.5 ? n / 100 : n;
}

function parseCount(v: unknown): number {
  const n = Number(clean(v));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Derive school type from its name (GGIC = Govt Girls IC, GIC = Govt IC). */
function deriveType(name: string): string | null {
  const m = name.toUpperCase().match(/\b(GGIC|GIC|GGSS|GHS|GMS)\b/);
  return m ? m[1] : null;
}

function readSheet(file: string, sheet?: string): unknown[][] {
  const wb = XLSX.readFile(join(DATA_DIR, file));
  const ws = wb.Sheets[sheet ?? wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
}

// In-memory aggregation so a school appearing in multiple files is merged once.
type SchoolAgg = {
  udiseCode: string;
  name: string;
  district: string;
  block: string;
  siteCode: string | null;
  type: string | null;
  hasVirtualClassroom: boolean;
  hasIctLab: boolean;
  enrollments: { grade: number; boys: number; girls: number; total: number }[];
  results: { examType: string; subject: string; passPct: number }[];
  ict: { teacherCount: number; studentCount: number } | null;
};

const schools = new Map<string, SchoolAgg>();

// Canonicalise district names case-insensitively so source typos like
// "UTTARKASHI" vs "UTTARKAsHI" collapse to a single district (first spelling wins).
const districtCanon = new Map<string, string>();
function canonDistrict(name: string): string {
  const key = name.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!key) return name;
  if (!districtCanon.has(key)) districtCanon.set(key, name.replace(/\s+/g, ' ').trim());
  return districtCanon.get(key)!;
}

// Explicit block-name corrections for source-data typos (district key is uppercased).
const BLOCK_CORRECTIONS: Record<string, Record<string, string>> = {
  DEHRADUN: { DOJWALA: 'Doiwala' },
};

// Canonicalise block names case-insensitively within a district (first spelling wins).
const blockCanon = new Map<string, string>(); // key: DISTRICT::BLOCK_UPPER
function canonBlock(district: string, block: string): string {
  const dKey = district.toUpperCase().replace(/\s+/g, ' ').trim();
  const bUpper = block.toUpperCase().replace(/\s+/g, ' ').trim();
  // Apply explicit correction first.
  const corrected = BLOCK_CORRECTIONS[dKey]?.[bUpper];
  const canonical = corrected ?? block.replace(/\s+/g, ' ').trim();
  const mapKey = `${dKey}::${corrected ? corrected.toUpperCase() : bUpper}`;
  if (!blockCanon.has(mapKey)) blockCanon.set(mapKey, canonical);
  return blockCanon.get(mapKey)!;
}

function getSchool(udise: string, name: string, district: string, block: string): SchoolAgg {
  district = canonDistrict(district);
  block = canonBlock(district, block);
  let s = schools.get(udise);
  if (!s) {
    s = {
      udiseCode: udise,
      name,
      district,
      block,
      siteCode: null,
      type: deriveType(name),
      hasVirtualClassroom: false,
      hasIctLab: false,
      enrollments: [],
      results: [],
      ict: null,
    };
    schools.set(udise, s);
  }
  return s;
}

// ── parse: Virtual Classroom enrollment ──────────────────────────────────────

function importVirtual() {
  const rows = readSheet('virtual.xlsx', 'Sheet1');
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const udise = normalizeUdise(r[3]);
    const name = clean(r[4]);
    if (!udise || !name) continue;
    const s = getSchool(udise, name, clean(r[1]), clean(r[2]));
    s.hasVirtualClassroom = true;
    for (let grade = 6; grade <= 12; grade++) {
      const base = 5 + (grade - 6) * 3; // Boys, Girls, Total columns per grade
      const boys = parseCount(r[base]);
      const girls = parseCount(r[base + 1]);
      const total = parseCount(r[base + 2]) || boys + girls;
      if (boys || girls || total) s.enrollments.push({ grade, boys, girls, total });
    }
    n++;
  }
  return n;
}

// ── parse: ICT Lab deployments ────────────────────────────────────────────────

function importIct() {
  const rows = readSheet('ict.xlsx', 'Sheet1');
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const udise = normalizeUdise(r[3]);
    const name = clean(r[4]);
    if (!udise || !name) continue;
    const s = getSchool(udise, name, clean(r[1]), clean(r[2]));
    s.hasIctLab = true;
    s.ict = { teacherCount: parseCount(r[5]), studentCount: parseCount(r[6]) };
    n++;
  }
  return n;
}

// ── parse: board results ──────────────────────────────────────────────────────

function importResults(sheet: string, examType: string, subjects: Record<number, string>) {
  const rows = readSheet('results.xlsx', sheet);
  let n = 0;
  // Header is on row 2 (index 1); data starts at index 2.
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const udise = normalizeUdise(r[4]);
    const name = clean(r[3]);
    if (!udise || !name) continue;
    const s = getSchool(udise, name, clean(r[1]), clean(r[2]));
    const site = clean(r[5]);
    if (site) s.siteCode = site;
    for (const [col, subject] of Object.entries(subjects)) {
      const pct = parsePct(r[Number(col)]);
      if (pct != null) s.results.push({ examType, subject, passPct: pct });
    }
    n++;
  }
  return n;
}

// ── persistence ───────────────────────────────────────────────────────────────

async function wipe() {
  // Save manually-curated school fields (principal, phone, address) keyed by
  // UDISE code so they survive the wipe and are restored after re-seeding.
  // These come from NEW INSTALLATION.xlsx and are NOT in the auto-import files.
  const curated = await prisma.school.findMany({
    where: { OR: [{ principalName: { not: null } }, { phone: { not: null } }, { address: { not: null } }] },
    select: { udiseCode: true, principalName: true, phone: true, address: true },
  });
  const ictCurated = await prisma.ictDeployment.findMany({
    where: { OR: [{ lanIp: { not: null } }, { iduSerialNo: { not: null } }, { engineerName: { not: null } }] },
    include: { school: { select: { udiseCode: true } } },
  });

  await prisma.lecture.deleteMany();
  await prisma.contentChannel.deleteMany();
  await prisma.student.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.boardResult.deleteMany();
  await prisma.yearlyResult.deleteMany();
  await prisma.ictDeployment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
  await prisma.block.deleteMany();
  await prisma.district.deleteMany();
  await prisma.tenant.deleteMany();

  // Return saved data so persist() can restore it after re-creating schools.
  return { curated, ictCurated };
}

async function persist() {
  const tenant = await prisma.tenant.create({ data: { id: 't_uk', name: 'Uttarakhand', code: 'UK' } });

  // Districts & blocks (deduped from the aggregated schools). Slug ids are made
  // collision-safe with a deterministic suffix when two names slug identically.
  const usedIds = new Set<string>();
  const uniqueId = (base: string): string => {
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}_${n}`;
    usedIds.add(id);
    return id;
  };
  const districtId = new Map<string, string>();
  const blockId = new Map<string, string>();
  for (const s of schools.values()) {
    if (!districtId.has(s.district)) {
      const d = await prisma.district.create({
        data: { id: uniqueId(`d_${slug(s.district)}`), tenantId: tenant.id, name: s.district || 'Unknown' },
      });
      districtId.set(s.district, d.id);
    }
    const bkey = `${s.district}||${s.block}`;
    if (!blockId.has(bkey)) {
      const b = await prisma.block.create({
        data: {
          id: uniqueId(`b_${slug(s.district)}__${slug(s.block)}`),
          districtId: districtId.get(s.district)!,
          name: s.block || 'Unknown',
        },
      });
      blockId.set(bkey, b.id);
    }
  }

  // Schools + their child records.
  for (const s of schools.values()) {
    const school = await prisma.school.create({
      data: {
        id: `s_${s.udiseCode}`,
        blockId: blockId.get(`${s.district}||${s.block}`)!,
        name: s.name,
        udiseCode: s.udiseCode,
        siteCode: s.siteCode,
        type: s.type,
        hasVirtualClassroom: s.hasVirtualClassroom,
        hasIctLab: s.hasIctLab,
      },
    });
    if (s.enrollments.length) {
      await prisma.enrollment.createMany({
        data: s.enrollments.map((e) => ({ schoolId: school.id, academicYear: ACADEMIC_YEAR, ...e })),
      });
    }
    if (s.results.length) {
      // Dedupe (schoolId, examType, subject) in case a sheet repeats a subject.
      const seen = new Set<string>();
      const data = s.results
        .filter((x) => {
          const k = `${x.examType}|${x.subject}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((x) => ({ schoolId: school.id, academicYear: ACADEMIC_YEAR, ...x }));
      await prisma.boardResult.createMany({ data });
    }
    if (s.ict) {
      await prisma.ictDeployment.create({
        data: { schoolId: school.id, academicYear: ACADEMIC_YEAR, ...s.ict },
      });
    }
  }

  return { tenant, districts: districtId.size, blocks: blockId.size };
}

async function seedDemoUsers(tenantId: string) {
  const almora = await prisma.district.findFirst({ where: { name: { contains: 'ALMORA' } } });
  const aSchool = await prisma.school.findUnique({ where: { udiseCode: '5090104505' } }); // GIC BARECHHINA

  // Platform Admin has tenantId=null so it can span all states.
  const users: { email: string; name: string; role: string; tenantId: string | null; districtId?: string | null; schoolId?: string | null }[] = [
    { email: 'admin@edubeam.com', name: 'Platform Admin', role: 'ADMIN', tenantId: null },
    { email: 'state.uk@edubeam.com', name: 'State Official (UK)', role: 'STATE_OFFICIAL', tenantId },
    { email: 'state@edubeam.com', name: 'State Official (UK)', role: 'STATE_OFFICIAL', tenantId },
    {
      email: 'almora@edubeam.com',
      name: 'Almora District Official',
      role: 'DISTRICT_OFFICIAL',
      tenantId,
      districtId: almora?.id,
    },
    {
      email: 'principal@edubeam.com',
      name: 'Principal (GIC Barechhina)',
      role: 'PRINCIPAL',
      tenantId,
      districtId: almora?.id,
      schoolId: aSchool?.id,
    },
  ];
  for (const u of users) {
    const pw = u.email.split('@')[0];
    const passwordHash = await bcrypt.hash(pw, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      create: { id: `u_${pw.replace(/\./g, '_')}`, ...u, passwordHash },
      update: { passwordHash, name: u.name, role: u.role, tenantId: u.tenantId, districtId: u.districtId ?? null, schoolId: u.schoolId ?? null },
    });
  }
  return users.length;
}

/**
 * Seeds a demo state tenant with synthetic districts/blocks/schools + logins.
 * Data is entirely deterministic (no random seed needed) so re-seeds are stable.
 */
async function seedDemoState(
  id: string,
  name: string,
  code: string,
  districts: { name: string; blocks: { name: string; schools: { name: string; udise: string; siteCode: string }[] }[] }[],
) {
  const tenant = await prisma.tenant.create({ data: { id, name, code } });

  const districtIds: string[] = [];
  for (const d of districts) {
    const dId = `d_${id}_${slug(d.name)}`;
    await prisma.district.create({ data: { id: dId, tenantId: tenant.id, name: d.name } });
    districtIds.push(dId);

    for (const b of d.blocks) {
      const bId = `b_${id}_${slug(d.name)}_${slug(b.name)}`;
      await prisma.block.create({ data: { id: bId, districtId: dId, name: b.name } });

      for (const s of b.schools) {
        const school = await prisma.school.create({
          data: {
            id: `s_${s.udise}`,
            blockId: bId,
            name: s.name,
            udiseCode: s.udise,
            siteCode: s.siteCode,
            hasVirtualClassroom: true,
            hasIctLab: false,
          },
        });
        // Add some demo enrollment rows (grades 6-10, mixed gender)
        const enrollRows = [6, 7, 8, 9, 10].map((grade) => ({
          schoolId: school.id,
          academicYear: ACADEMIC_YEAR,
          grade,
          boys: 18 + grade,
          girls: 15 + grade,
          total: 33 + grade * 2,
        }));
        await prisma.enrollment.createMany({ data: enrollRows });

        // Two sample students and staff per school
        const r = mulberry32(hashStr(s.udise));

        // Synthetic board results so analytics don't show empty charts (deterministic via r())
        const boardRows = ['Hindi', 'English', 'Mathematics', 'Science'].map((subject) => ({
          schoolId: school.id, academicYear: ACADEMIC_YEAR, examType: '10TH', subject, passPct: 0.7 + r() * 0.25,
        }));
        await prisma.boardResult.createMany({ data: boardRows });
        await prisma.student.createMany({
          data: [
            { ...makeStudent(s.udise + 'b', 0, school.id, 9, 'M'), admissionNo: `ADM${s.udise.slice(-4)}01`, rollNo: '1', academicYear: ACADEMIC_YEAR },
            { ...makeStudent(s.udise + 'g', 1, school.id, 9, 'F'), admissionNo: `ADM${s.udise.slice(-4)}02`, rollNo: '2', academicYear: ACADEMIC_YEAR },
          ],
        });
        await prisma.staff.createMany({
          data: [
            makeStaff(s.udise, 0, school.id, 'PRINCIPAL'),
            makeStaff(s.udise, 1, school.id, 'TEACHER'),
          ],
        });
      }
    }
  }

  return { tenant, districtCount: districts.length };
}

async function seedDemoStateUsers() {
  // Find the first district+school in each demo state for scoping demo logins
  const mhDistrict = await prisma.district.findFirst({ where: { tenantId: 't_mh' } });
  const mhSchool = await prisma.school.findFirst({ where: { block: { district: { tenantId: 't_mh' } } } });
  const odDistrict = await prisma.district.findFirst({ where: { tenantId: 't_od' } });
  const odSchool = await prisma.school.findFirst({ where: { block: { district: { tenantId: 't_od' } } } });

  const users: { email: string; name: string; role: string; tenantId: string; districtId?: string | null; schoolId?: string | null }[] = [
    { email: 'state.mh@edubeam.com', name: 'State Official (MH)', role: 'STATE_OFFICIAL', tenantId: 't_mh' },
    { email: 'state.od@edubeam.com', name: 'State Official (OD)', role: 'STATE_OFFICIAL', tenantId: 't_od' },
    { email: 'district.mh@edubeam.com', name: 'Pune District Official', role: 'DISTRICT_OFFICIAL', tenantId: 't_mh', districtId: mhDistrict?.id },
    { email: 'district.od@edubeam.com', name: 'Bhubaneswar District Official', role: 'DISTRICT_OFFICIAL', tenantId: 't_od', districtId: odDistrict?.id },
    { email: 'principal.mh@edubeam.com', name: 'Principal (MH Demo School)', role: 'PRINCIPAL', tenantId: 't_mh', districtId: mhDistrict?.id, schoolId: mhSchool?.id },
    { email: 'principal.od@edubeam.com', name: 'Principal (OD Demo School)', role: 'PRINCIPAL', tenantId: 't_od', districtId: odDistrict?.id, schoolId: odSchool?.id },
  ];
  for (const u of users) {
    const pw = u.email.split('@')[0];
    const passwordHash = await bcrypt.hash(pw, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      create: { id: `u_${pw.replace(/\./g, '_')}`, ...u, passwordHash },
      update: { passwordHash, name: u.name, tenantId: u.tenantId, districtId: u.districtId ?? null, schoolId: u.schoolId ?? null },
    });
  }
  return users.length;
}

/** Parse a year cell into a 4-digit year in range, else null. */
function parseYear(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 2015 && v <= 2026) return v;
  const m = String(v ?? '').trim().match(/^(20\d\d)/);
  const y = m ? Number(m[1]) : NaN;
  return y >= 2015 && y <= 2026 ? y : null;
}

/** A 0..100 "Total %" cell → 0..1, treating 0/blank/negative/over-100 as missing. */
function parseTotalPct(v: unknown): number | null {
  const n = Number(clean(v));
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n / 100;
}

/**
 * Imports the 5-year historical board results (yearly.xlsx). Uses block-1 columns
 * only (block 2 is sparse/anomalous): High School Total% (col 11 -> 10TH) and
 * Intermediate Total% (col 18 -> 12TH). Attaches to existing schools by UDISE.
 */
async function importYearlyResults() {
  const rows = readSheet('yearly.xlsx', 'Sheet1 (2)');
  const schoolByUdise = new Map(
    (await prisma.school.findMany({ select: { id: true, udiseCode: true } })).map((s) => [s.udiseCode, s.id]),
  );

  const seen = new Set<string>();
  const data: { schoolId: string; year: number; examType: string; passPct: number }[] = [];
  let matched = 0;
  let skippedUnknown = 0;

  // Data starts at row index 2 (two header rows).
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const udise = normalizeUdise(r[4]);
    const year = parseYear(r[6]);
    if (!udise || !year) continue;
    const schoolId = schoolByUdise.get(udise);
    if (!schoolId) {
      skippedUnknown++;
      continue;
    }
    matched++;
    for (const [col, examType] of [[11, '10TH'], [18, '12TH']] as const) {
      const pct = parseTotalPct(r[col]);
      if (pct == null) continue;
      const key = `${schoolId}|${year}|${examType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({ schoolId, year, examType, passPct: pct });
    }
  }

  // Chunked insert (SQLite has a parameter limit).
  for (let i = 0; i < data.length; i += 500) {
    await prisma.yearlyResult.createMany({ data: data.slice(i, i + 500) });
  }
  return { rowsMatched: matched, skippedUnknownSchools: skippedUnknown, inserted: data.length };
}

// ── Student & Staff generation ───────────────────────────────────────────────
// The source Excel files give aggregate enrollment/teacher counts but no named
// individuals. To make the Student/Staff registry demonstrable, we generate
// deterministic sample people: a full roster for the principal's demo school
// (GIC Barechhina, from its real grade/gender enrollment) and a small sample for
// every other school so district/state demographics are non-empty. All names are
// generated with a seeded RNG so re-seeding is stable.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FIRST_M = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Kabir', 'Ayaan', 'Dev', 'Yash', 'Harsh', 'Mohit', 'Naveen', 'Pankaj', 'Rahul', 'Sachin', 'Tarun', 'Umesh'];
const FIRST_F = ['Aanya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Kiara', 'Riya', 'Ananya', 'Ishita', 'Khushi', 'Meera', 'Nisha', 'Pooja', 'Ritu', 'Sneha', 'Tanvi', 'Priya', 'Komal'];
const LAST = ['Negi', 'Bisht', 'Rawat', 'Bhatt', 'Joshi', 'Pant', 'Sharma', 'Verma', 'Kandpal', 'Mehra', 'Bora', 'Tiwari', 'Pandey', 'Arya', 'Singh', 'Chandra', 'Tamta', 'Dhanik', 'Karki', 'Bhandari'];
const QUALS = ['B.A, B.Ed', 'M.A, B.Ed', 'B.Sc, B.Ed', 'M.Sc, B.Ed', 'M.Com, B.Ed', 'B.Ed', 'M.A', 'M.Sc'];
const SUBJECTS = ['Hindi', 'English', 'Mathematics', 'Science', 'Social Studies', 'Physics', 'Chemistry', 'Biology'];
const CATS = ['GEN', 'GEN', 'GEN', 'OBC', 'OBC', 'SC', 'ST'];
const RELS = ['Hindu', 'Hindu', 'Hindu', 'Hindu', 'Muslim', 'Sikh', 'Christian'];

function pick<T>(arr: T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length];
}

type GenStudent = {
  schoolId: string; name: string; gender: string; grade: number; section: string;
  rollNo: string; admissionNo: string; guardianName: string; guardianPhone: string;
  guardianRelation: string; category: string; religion: string; isRte: boolean;
  isDropout: boolean; dropoutReason: string | null; dateOfBirth: Date; academicYear: string;
};
type GenStaff = {
  schoolId: string; name: string; gender: string; staffType: string; designation: string;
  qualification: string; subjects: string; phone: string; department: string; salaryGroup: string;
  isClassTeacher: boolean; classTeacherOf: string | null; employeeId: string;
  joiningDate: Date; academicYear: string;
};

function makeStudent(seed: string, idx: number, schoolId: string, grade: number, gender: 'M' | 'F'): GenStudent {
  const r = mulberry32(hashStr(seed) + idx * 2654435761);
  const first = gender === 'M' ? pick(FIRST_M, r()) : pick(FIRST_F, r());
  const last = pick(LAST, r());
  const dropRoll = r();
  const age = 5 + grade + Math.floor(r() * 2); // rough age for the grade
  return {
    schoolId,
    name: `${first} ${last}`,
    gender,
    grade,
    section: pick(['A', 'B', 'C'], r()),
    rollNo: String(idx + 1),
    admissionNo: `ADM${(hashStr(seed) % 9000 + 1000)}${idx + 1}`,
    guardianName: `${pick(FIRST_M, r())} ${last}`,
    guardianPhone: `9${Math.floor(r() * 900000000 + 100000000)}`,
    guardianRelation: r() < 0.7 ? 'Father' : 'Mother',
    category: pick(CATS, r()),
    religion: pick(RELS, r()),
    isRte: r() < 0.18,
    isDropout: dropRoll < 0.04,
    dropoutReason: dropRoll < 0.04 ? pick(['Migration', 'Financial', 'Distance to school', 'Family reasons'], r()) : null,
    dateOfBirth: new Date(2026 - age, Math.floor(r() * 12), Math.floor(r() * 28) + 1),
    academicYear: ACADEMIC_YEAR,
  };
}

function makeStaff(seed: string, idx: number, schoolId: string, type: 'PRINCIPAL' | 'TEACHER' | 'LAB_ASSISTANT'): GenStaff {
  const r = mulberry32(hashStr(seed + '|staff') + idx * 40503);
  const gender = r() < 0.55 ? 'M' : 'F';
  const first = gender === 'M' ? pick(FIRST_M, r()) : pick(FIRST_F, r());
  const last = pick(LAST, r());
  const subj = pick(SUBJECTS, r());
  const designation = type === 'PRINCIPAL' ? 'Principal' : type === 'LAB_ASSISTANT' ? 'Lab Assistant' : pick(['Assistant Teacher', 'TGT', 'PGT', 'Lecturer'], r());
  const isCt = type === 'TEACHER' && r() < 0.5;
  return {
    schoolId,
    name: `${first} ${last}`,
    gender,
    staffType: type,
    designation,
    qualification: pick(QUALS, r()),
    subjects: type === 'TEACHER' ? subj : type === 'LAB_ASSISTANT' ? 'ICT / Computers' : 'Administration',
    phone: `9${Math.floor(r() * 900000000 + 100000000)}`,
    department: type === 'TEACHER' ? subj : type === 'LAB_ASSISTANT' ? 'ICT Lab' : 'Administration',
    salaryGroup: pick(['Level 7', 'Level 8', 'Level 10', 'Level 12'], r()),
    isClassTeacher: isCt,
    classTeacherOf: isCt ? `${6 + Math.floor(r() * 7)}-${pick(['A', 'B'], r())}` : null,
    employeeId: `EMP${(hashStr(seed) % 9000 + 1000)}${idx + 1}`,
    joiningDate: new Date(2010 + Math.floor(r() * 14), Math.floor(r() * 12), Math.floor(r() * 28) + 1),
    academicYear: ACADEMIC_YEAR,
  };
}

/**
 * Generates and inserts sample students & staff. GIC Barechhina (the principal
 * demo school) gets a full roster derived from its real enrollment; every other
 * school gets a small deterministic sample so demographics roll up at all scopes.
 */
async function seedPeople() {
  const demoSchool = await prisma.school.findUnique({
    where: { udiseCode: '5090104505' },
    include: { enrollments: true },
  });
  const allSchools = await prisma.school.findMany({
    select: { id: true, udiseCode: true, hasIctLab: true },
  });

  const students: GenStudent[] = [];
  const staff: GenStaff[] = [];

  // Full roster for the demo school from real enrollment grade/gender counts (capped per grade).
  if (demoSchool) {
    let idx = 0;
    for (const e of demoSchool.enrollments) {
      const boys = Math.min(e.boys, 18);
      const girls = Math.min(e.girls, 18);
      for (let i = 0; i < boys; i++) students.push(makeStudent(demoSchool.udiseCode + 'b', idx++, demoSchool.id, e.grade, 'M'));
      for (let i = 0; i < girls; i++) students.push(makeStudent(demoSchool.udiseCode + 'g', idx++, demoSchool.id, e.grade, 'F'));
    }
    staff.push(makeStaff(demoSchool.udiseCode, 0, demoSchool.id, 'PRINCIPAL'));
    for (let i = 1; i <= 12; i++) staff.push(makeStaff(demoSchool.udiseCode, i, demoSchool.id, 'TEACHER'));
    staff.push(makeStaff(demoSchool.udiseCode, 13, demoSchool.id, 'LAB_ASSISTANT'));
  }

  // Small deterministic sample for every other school.
  for (const s of allSchools) {
    if (demoSchool && s.id === demoSchool.id) continue;
    const r = mulberry32(hashStr(s.udiseCode));
    let idx = 0;
    for (let g = 6; g <= 12; g++) {
      // 1 boy + 1 girl per grade for a 14-student sample roster.
      students.push(makeStudent(s.udiseCode + 'b', idx++, s.id, g, 'M'));
      students.push(makeStudent(s.udiseCode + 'g', idx++, s.id, g, 'F'));
    }
    staff.push(makeStaff(s.udiseCode, 0, s.id, 'PRINCIPAL'));
    const nTeachers = 3 + Math.floor(r() * 3);
    for (let i = 1; i <= nTeachers; i++) staff.push(makeStaff(s.udiseCode, i, s.id, 'TEACHER'));
    if (s.hasIctLab) staff.push(makeStaff(s.udiseCode, 99, s.id, 'LAB_ASSISTANT'));
  }

  for (let i = 0; i < students.length; i += 500) {
    await prisma.student.createMany({ data: students.slice(i, i + 500) });
  }
  for (let i = 0; i < staff.length; i += 500) {
    await prisma.staff.createMany({ data: staff.slice(i, i + 500) });
  }
  return { students: students.length, staff: staff.length };
}

// ── Content channels & lecture import ───────────────────────────────────────

const STUDIO_CHANNELS = [
  { id: 'ch_studio1', studioName: 'Studio1', channelName: 'ICT Virtual Class Uttarakhand', channelUrl: 'https://www.youtube.com/@ictvirtualclassuttarakhand882' },
  { id: 'ch_studio2', studioName: 'Studio2', channelName: 'ICT UK Studio 2', channelUrl: 'https://www.youtube.com/@ictukstudio2940' },
  { id: 'ch_studio3', studioName: 'Studio3', channelName: 'ICT UK Studio 3', channelUrl: 'https://www.youtube.com/@ictukstudio3778' },
  { id: 'ch_studio4', studioName: 'Studio4', channelName: 'ICT UK Studio 4', channelUrl: 'https://www.youtube.com/@ictukstudio4568' },
];

function parseLectureDate(v: unknown): string {
  if (v == null) return '2000-01-01';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Excel serial number (e.g. 46022 = 2025-12-31)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // MM/DD/YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '2000-01-01';
}

async function seedLectures(): Promise<number> {
  const lecturesFile = join(DATA_DIR, 'lectures.xlsx');
  const wb2 = XLSX.readFile(lecturesFile);
  const ws2 = wb2.Sheets[wb2.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws2, { header: 1, raw: true, defval: null });

  // Seed channels first
  for (const ch of STUDIO_CHANNELS) {
    await prisma.contentChannel.upsert({ where: { studioName: ch.studioName }, create: ch, update: { channelName: ch.channelName, channelUrl: ch.channelUrl } });
  }

  const batch: {
    id: string; srNo: number; date: string; studioName: string; medium: string;
    startTime: string; endTime: string; standard: number; teacherName: string;
    subject: string; topic: string; youtubeUrl: null;
  }[] = [];

  let inserted = 0;
  let skipped = 0;
  let rowIdx = 0;

  // New file columns (Lecturer Detail data.xlsx):
  // 0:studio_name  1:lec_date  2:start_time  3:end_time  4:teacher_name
  // 5:Medium  6:subject_name  7:teacher_name(dup)  8:standard  9:topic
  // 10:lecture_type  11:updated_by  12:remark  13:id  14:Session_Remark
  for (const row of rows.slice(1)) {
    rowIdx++;
    const r = row as unknown[];
    const studioName = clean(r[0]);
    const subject    = clean(r[6]);
    const topic      = clean(r[9]);
    const srNo       = Number(r[13]) || rowIdx;

    if (!studioName || !subject || !topic) { skipped++; continue; }

    const standard = Number(r[8]);
    if (!Number.isFinite(standard) || standard < 6 || standard > 12) { skipped++; continue; }

    batch.push({
      id: `lec_${String(rowIdx).padStart(6, '0')}`,
      srNo,
      date: parseLectureDate(r[1]),
      studioName,
      medium: clean(r[5]) || 'Hindi',
      startTime: clean(r[2]),
      endTime: clean(r[3]),
      standard,
      teacherName: clean(r[4]),
      subject,
      topic,
      youtubeUrl: null,
    });

    if (batch.length >= 500) {
      await prisma.lecture.createMany({ data: batch });
      inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length) {
    await prisma.lecture.createMany({ data: batch });
    inserted += batch.length;
  }
  return inserted;
}

async function restoreYoutubeUrls(): Promise<number> {
  const urlsFile = join(DATA_DIR, 'youtube-urls.json');
  if (!existsSync(urlsFile)) return 0;
  const map: Record<string, string> = JSON.parse(readFileSync(urlsFile, 'utf8'));
  const entries = Object.entries(map);
  if (!entries.length) return 0;
  const CHUNK = 200;
  let restored = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    await Promise.all(
      entries.slice(i, i + CHUNK).map(([id, youtubeUrl]) =>
        prisma.lecture.updateMany({ where: { id }, data: { youtubeUrl } }),
      ),
    );
    restored += Math.min(CHUNK, entries.length - i);
  }
  return restored;
}

async function main() {
  // Idempotent first-run guard: on a deployed DB we only seed when it's empty, so
  // a redeploy never wipes data that reviewers/managers have added. Pass --force
  // (or SEED_FORCE=1) to force a full re-seed — local `npm run db:seed` does this.
  const force = process.env.SEED_FORCE || process.argv.includes('--force');
  if (!force) {
    const existing = await prisma.school.count().catch(() => 0);
    if (existing > 0) {
      console.log(`DB already has ${existing} schools — skipping seed (set SEED_FORCE=1 to override).`);
      return;
    }
  }

  console.log('Edubeam LMS — seeding from real Uttarakhand 2025-26 data\n');
  const { curated, ictCurated } = await wipe();

  const virtual = importVirtual();
  const ict = importIct();
  const r10 = importResults('10th', '10TH', {
    6: 'Hindi',
    7: 'English',
    8: 'Science',
    9: 'SST',
    10: 'Math',
  });
  const r12 = importResults('12th', '12TH', {
    6: 'Hindi',
    7: 'English',
    8: 'Physics',
    9: 'Chemistry',
    10: 'Biology',
    11: 'Math',
    12: 'Political Science',
    13: 'Economics',
    14: 'Geography',
    15: 'History',
  });

  console.log(`Parsed rows  -> virtual: ${virtual}, ict: ${ict}, 10th: ${r10}, 12th: ${r12}`);
  console.log(`Unique schools across all files: ${schools.size}`);

  const { tenant, districts, blocks } = await persist();
  const userCount = await seedDemoUsers(tenant.id);
  const yearly = await importYearlyResults();
  const people = await seedPeople();

  // Seed Maharashtra and Odisha demo states
  await seedDemoState('t_mh', 'Maharashtra', 'MH', [
    { name: 'Pune', blocks: [
      { name: 'Haveli', schools: [
        { name: 'GR High School Haveli', udise: 'mh_001_1', siteCode: 'MHHAV01' },
        { name: 'GR High School Khed', udise: 'mh_001_2', siteCode: 'MHKHE01' },
      ]},
      { name: 'Bhor', schools: [
        { name: 'GR High School Bhor', udise: 'mh_001_3', siteCode: 'MHBHR01' },
      ]},
    ]},
    { name: 'Nashik', blocks: [
      { name: 'Niphad', schools: [
        { name: 'GR High School Niphad', udise: 'mh_002_1', siteCode: 'MHNIP01' },
        { name: 'GR High School Sinnar', udise: 'mh_002_2', siteCode: 'MHSIN01' },
      ]},
    ]},
    { name: 'Aurangabad', blocks: [
      { name: 'Paithan', schools: [
        { name: 'GR High School Paithan', udise: 'mh_003_1', siteCode: 'MHPAI01' },
      ]},
    ]},
  ]);
  await seedDemoState('t_od', 'Odisha', 'OD', [
    { name: 'Khurda', blocks: [
      { name: 'Bhubaneswar', schools: [
        { name: 'GR High School Bhubaneswar', udise: 'od_001_1', siteCode: 'ODBHU01' },
        { name: 'GR High School Jatni', udise: 'od_001_2', siteCode: 'ODJAT01' },
      ]},
      { name: 'Tangi', schools: [
        { name: 'GR High School Tangi', udise: 'od_001_3', siteCode: 'ODTAN01' },
      ]},
    ]},
    { name: 'Cuttack', blocks: [
      { name: 'Cuttack Sadar', schools: [
        { name: 'GR High School Cuttack', udise: 'od_002_1', siteCode: 'ODCUT01' },
        { name: 'GR High School Salepur', udise: 'od_002_2', siteCode: 'ODSAL01' },
      ]},
    ]},
    { name: 'Puri', blocks: [
      { name: 'Puri Sadar', schools: [
        { name: 'GR High School Puri', udise: 'od_003_1', siteCode: 'ODPURI1' },
      ]},
    ]},
  ]);
  const demoStateUserCount = await seedDemoStateUsers();
  const lectureCount = await seedLectures();
  const urlsRestored = await restoreYoutubeUrls();

  // Restore manually-curated school fields (principal, phone, address) saved before wipe
  for (const s of curated) {
    await prisma.school.updateMany({
      where: { udiseCode: s.udiseCode },
      data: { principalName: s.principalName, phone: s.phone, address: s.address },
    });
  }
  // Restore ICT deployment fields saved before wipe
  for (const ict of ictCurated) {
    const school = await prisma.school.findFirst({ where: { udiseCode: ict.school.udiseCode } });
    if (school) {
      await prisma.ictDeployment.updateMany({
        where: { schoolId: school.id },
        data: {
          lanIp: ict.lanIp,
          subnetMask: ict.subnetMask,
          iduSerialNo: ict.iduSerialNo,
          newIduSerialNo: ict.newIduSerialNo,
          iduModel: ict.iduModel,
          materialStatus: ict.materialStatus,
          installRemark: ict.installRemark,
          engineerName: ict.engineerName,
          scheduledDate: ict.scheduledDate,
          certUpdate: ict.certUpdate,
        },
      });
    }
  }
  console.log(`Restored curated data: ${curated.length} schools, ${ictCurated.length} ICT records`);

  const [schoolCount, vc, il, enr, br, yr] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { hasVirtualClassroom: true } }),
    prisma.school.count({ where: { hasIctLab: true } }),
    prisma.enrollment.count(),
    prisma.boardResult.count(),
    prisma.yearlyResult.count(),
  ]);

  console.log('\n── Loaded ────────────────────────────────');
  console.log(`Districts: ${districts}   Blocks: ${blocks}   Schools: ${schoolCount}`);
  console.log(`  Virtual Classroom schools: ${vc}   ICT Lab schools: ${il}`);
  console.log(`  Enrollment rows: ${enr}   Board result rows: ${br}   Demo users: ${userCount}`);
  console.log(
    `  Yearly results: ${yr} rows (matched ${yearly.rowsMatched} file rows; ` +
      `${yearly.skippedUnknownSchools} rows for schools not in our 500 set skipped)`,
  );
  console.log(`  Students: ${people.students}   Staff: ${people.staff} (sample registry)`);
  console.log(`  Demo states (MH + OD): seeded, ${demoStateUserCount} state/district/principal logins added`);
  console.log(`  Lectures: ${lectureCount} (virtual classroom recordings 2019–2026); YouTube URLs restored: ${urlsRestored}`);
  console.log(`  Content channels: ${STUDIO_CHANNELS.length} (Studio1–4 YouTube mappings)`);

  // Spot-check a known school from the plan's verification step.
  const spot = await prisma.school.findUnique({
    where: { udiseCode: '5090104505' },
    include: { boardResults: { where: { examType: '10TH' } } },
  });
  console.log('\nSpot-check 5090104505 (GIC BARECHHINA, site VVEAMO352):');
  console.log(`  name=${spot?.name} site=${spot?.siteCode} type=${spot?.type}`);
  console.log(`  10th subjects loaded: ${spot?.boardResults.map((b) => `${b.subject}=${b.passPct}`).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
