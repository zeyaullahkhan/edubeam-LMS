/**
 * One-time migration: fix 3 extra blocks that were created during initial seed.
 * Idempotent — safe to run on every deploy; no-ops if blocks are already gone.
 *
 * DUGADDA_2  (PAURI)     → merge into DUGADDA
 * GADARPUR_2 (U.S.Nagar) → merge into GADARPUR
 * DOJWALA    (Dehradun)  → merge into DOIWALA (source typo)
 */
import { prisma } from './client';

const MERGES: Array<{ from: string; to: string }> = [
  { from: 'b_pauri__dugadda_2',       to: 'b_pauri__dugadda' },
  { from: 'b_u_s_nagar__gadarpur_2',  to: 'b_u_s_nagar__gadarpur' },
  { from: 'b_dehradun__dojwala',      to: 'b_dehradun__doiwala' },
];

async function run() {
  let anyFixed = false;
  for (const { from, to } of MERGES) {
    const src = await prisma.block.findUnique({ where: { id: from }, select: { id: true, name: true } });
    if (!src) continue;
    const moved = await prisma.school.updateMany({ where: { blockId: from }, data: { blockId: to } });
    await prisma.block.delete({ where: { id: from } });
    console.log(`migrate-blocks: merged ${src.name} (${from}) → ${to}, moved ${moved.count} schools`);
    anyFixed = true;
  }
  if (!anyFixed) console.log('migrate-blocks: nothing to do (already clean)');
}

run()
  .catch((e) => { console.error('migrate-blocks failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
