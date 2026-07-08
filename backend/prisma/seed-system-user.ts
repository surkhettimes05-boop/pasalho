import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const SYSTEM_USER_ID = '99999999-9999-4999-a999-999999999999';

async function main() {
  const passwordHash = await bcrypt.hash('System@123', 10);

  await prisma.user.upsert({
    where: { email: 'system@pasalho.internal' },
    update: {
      id: SYSTEM_USER_ID,
      status: UserStatus.ACTIVE,
    },
    create: {
      id: SYSTEM_USER_ID,
      fullName: 'Storefront Guest',
      email: 'system@pasalho.internal',
      phone: '0000000000',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
  console.log('System user successfully seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
