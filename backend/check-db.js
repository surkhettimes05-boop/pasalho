const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to the PostgreSQL database!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Failed to connect to the database:', e);
    process.exit(1);
  });
