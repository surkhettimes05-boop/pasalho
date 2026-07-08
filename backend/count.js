const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.count();
  const s = await prisma.salesOrder.count();
  const c = await prisma.cashSession.count();
  const r = await prisma.retailerNotification.count();
  console.log({ ProductCount: p, SalesOrderCount: s, CashSessionCount: c, RetailerNotificationCount: r });
}
main().finally(() => prisma.$disconnect());
