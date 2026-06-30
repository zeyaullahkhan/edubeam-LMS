process.env.DATABASE_URL = 'file:C:/Development/edubeam-lms/packages/db/prisma/dev.db';
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const notices = await p.notice.findMany({ select: { id: true, title: true, type: true } });
  console.log('Found', notices.length, 'notices:');
  notices.forEach(n => console.log(' ', n.type.padEnd(10), n.title));

  const target = notices.find(n => n.title.toLowerCase().includes('urgent')) ?? notices[0];
  if (target) {
    await p.notice.update({ where: { id: target.id }, data: { type: 'Urgent' } });
    console.log('\nUpdated "' + target.title + '" -> Urgent');
  } else {
    console.log('No notices found to update');
  }
}

main().catch(console.error).finally(() => p.$disconnect());
