/**
 * Bulk-updates school contact details from NEW INSTALLATION.xlsx.
 * Also normalises all District and Block names to UPPERCASE.
 *
 * Usage:
 *   npm --workspace packages/db run import-installation
 *   DATABASE_URL="postgresql://..." npm --workspace packages/db run import-installation
 *
 * Excel columns (sheet "500 School"):
 *   0  Sr. no.
 *   1  District Name
 *   2  Block Name
 *   3  Name of school
 *   4  Address
 *   5  Name of Principal/Headmaster
 *   6  Contact Number  (may be "phoneA/phoneB")
 *   7  Udise Code      ← match key
 *   8  Site code
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { prisma } from './client';

const EXCEL_PATH = path.resolve(
  __dirname,
  '../../../Images/NEW INSTALLATION.xlsx',
);

interface Row {
  udiseCode: string;
  address: string | null;
  principalName: string | null;
  phone: string | null;
  phone2: string | null;
}

function parseExcel(): Row[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const rows: Row[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const udise = String(r[7] ?? '').trim();
    if (!udise || udise === '0') continue;

    const contact = String(r[6] ?? '').trim();
    const parts = contact.split('/').map((p) => p.trim()).filter(Boolean);

    rows.push({
      udiseCode: udise,
      address: String(r[4] ?? '').trim() || null,
      principalName: String(r[5] ?? '').trim() || null,
      phone: parts[0] || null,
      phone2: parts[1] || null,
    });
  }
  return rows;
}

async function main() {
  console.log(`Reading: ${EXCEL_PATH}`);
  const rows = parseExcel();
  console.log(`Excel rows parsed: ${rows.length}`);

  // ── 1. Update school contact details ──────────────────────────────────────
  const dbSchools = await prisma.school.findMany({ select: { id: true, udiseCode: true } });
  const udiseMap = new Map(dbSchools.map((s) => [s.udiseCode, s.id]));

  let matched = 0;
  let unmatched = 0;

  for (const row of rows) {
    const schoolId = udiseMap.get(row.udiseCode);
    if (!schoolId) {
      console.warn(`  UNMATCHED UDISE: ${row.udiseCode}`);
      unmatched++;
      continue;
    }
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        address: row.address,
        principalName: row.principalName,
        phone: row.phone,
        phone2: row.phone2,
      },
    });
    matched++;
  }

  console.log(`Schools updated: ${matched} matched, ${unmatched} unmatched`);

  // ── 2. Normalise District names to UPPERCASE ──────────────────────────────
  const districts = await prisma.district.findMany({ select: { id: true, name: true } });
  let districtUpdated = 0;
  for (const d of districts) {
    const upper = d.name.toUpperCase();
    if (upper !== d.name) {
      await prisma.district.update({ where: { id: d.id }, data: { name: upper } });
      districtUpdated++;
    }
  }
  console.log(`Districts normalised to UPPERCASE: ${districtUpdated}/${districts.length}`);

  // ── 3. Normalise Block names to UPPERCASE ─────────────────────────────────
  const blocks = await prisma.block.findMany({ select: { id: true, name: true } });
  let blockUpdated = 0;
  for (const b of blocks) {
    const upper = b.name.toUpperCase();
    if (upper !== b.name) {
      await prisma.block.update({ where: { id: b.id }, data: { name: upper } });
      blockUpdated++;
    }
  }
  console.log(`Blocks normalised to UPPERCASE: ${blockUpdated}/${blocks.length}`);

  await prisma.$disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
