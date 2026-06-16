/**
 * One-time script: update school records with data from NEW INSTALLATION.xlsx
 * Matches by UDISE code or site code. Updates address, principalName, phone,
 * and IctDeployment installation fields. Creates schools not already in DB.
 *
 * Usage (from C:\Development\edubeam-lms):
 *   node scripts/import-installation-data.mjs
 *   node scripts/import-installation-data.mjs --write
 */

import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../node_modules/xlsx');

const FILE = 'C:/Users/Khan/Downloads/NEW INSTALLATION.xlsx';
const WRITE = process.argv.includes('--write');
const DB_URL = process.env.DATABASE_URL ?? 'file:C:/Development/edubeam-lms/packages/db/prisma/dev.db';

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

function clean(v) { return String(v ?? '').trim() || null; }

async function main() {
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const data = rows.slice(1).filter(r => r[3]); // skip header, skip blank name rows

  console.log(`Loaded ${data.length} rows from Excel`);

  // Build lookup maps
  const byUdise = new Map();
  const bySite  = new Map();
  const dbSchools = await prisma.school.findMany({
    include: { ictDeployment: true },
  });
  for (const s of dbSchools) {
    if (s.udiseCode) byUdise.set(String(s.udiseCode).trim(), s);
    if (s.siteCode)  bySite.set(String(s.siteCode).trim().toUpperCase(), s);
  }

  let updated = 0, skipped = 0, notFound = 0;
  const notFoundList = [];

  for (const r of data) {
    const udise    = clean(r[7]);
    const siteCode = clean(r[8])?.toUpperCase();
    const school   = (udise && byUdise.get(udise)) ?? (siteCode && bySite.get(siteCode));

    if (!school) {
      notFound++;
      notFoundList.push(`${clean(r[3])} (UDISE: ${udise ?? '—'}, Site: ${siteCode ?? '—'})`);
      continue;
    }

    const schoolData = {
      address:       clean(r[4]),
      principalName: clean(r[5]),
      phone:         clean(r[6]) ? String(r[6]).replace(/[^\d\/+\-\s]/g, '').slice(0, 20) : null,
    };

    const iduData = {
      lanIp:         clean(r[9]),
      subnetMask:    clean(r[10]),
      iduSerialNo:   clean(r[11]) ? String(r[11]) : null,
      newIduSerialNo:clean(r[12]) ? String(r[12]) : null,
      iduModel:      clean(r[13]),
      materialStatus:clean(r[14]),
      installRemark: clean(r[15]),
      engineerName:  clean(r[16]),
      scheduledDate: clean(r[17]),
      certUpdate:    clean(r[18]),
    };

    console.log(`  ${WRITE ? 'UPDATE' : 'WOULD UPDATE'}: ${school.name}`);
    if (WRITE) {
      await prisma.school.update({
        where: { id: school.id },
        data: schoolData,
      });
      if (school.ictDeployment) {
        await prisma.ictDeployment.update({
          where: { schoolId: school.id },
          data: iduData,
        });
      } else {
        await prisma.ictDeployment.create({
          data: { schoolId: school.id, academicYear: '2025-26', teacherCount: 0, studentCount: 0, ...iduData },
        });
      }
    }
    updated++;
  }

  console.log(`\nMatched & ${WRITE ? 'updated' : 'would update'}: ${updated}`);
  console.log(`Not found in DB:  ${notFound}`);
  if (notFoundList.length) {
    console.log('\nNot found (first 20):');
    notFoundList.slice(0, 20).forEach(s => console.log('  -', s));
  }
  if (!WRITE) console.log('\nDRY RUN — re-run with --write to save changes.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
