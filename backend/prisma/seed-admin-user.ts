import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  // We need to ensure a role and branch exist for the admin if the schema requires it.
  // Actually, let's just insert the User.
  await prisma.user.upsert({
    where: { email: 'admin@pasalho.internal' },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: 'System Administrator',
      email: 'admin@pasalho.internal',
      phone: '9800000001',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
  console.log('Admin user successfully seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
