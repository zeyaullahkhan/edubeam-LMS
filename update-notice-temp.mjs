import { PrismaClient } from './packages/db/node_modules/@prisma/client/default.js';
const p = new PrismaClient();

const notices = await p.notice.findMany({ select: { id: true, title: true, type: true } });
console.log('Notices:', notices.map(n => `${n.title} [${n.type}]`).join('\n'));

const target = notices.find(n => n.title.toLowerCase().includes('urgent')) ?? notices[0];
if (target) {
  await p.notice.update({ where: { id: target.id }, data: { type: 'Urgent' } });
  console.log(`\nUpdated "${target.title}" → type: Urgent`);
}

await p.$disconnect();
