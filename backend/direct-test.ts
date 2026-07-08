import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CatalogService } from './src/catalog/catalog.service';
import { PrismaClient } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const catalog = app.get(CatalogService);
  const prisma = new PrismaClient();
  
  try {
    const cats = await prisma.category.findMany();
    const units = await prisma.unit.findMany();
    const admin = await prisma.user.findFirst({ where: { email: 'superadmin@pasalo.com' }});
    
    console.log('Creating product...');
    await catalog.createProduct({
      name: 'Test ' + Date.now(),
      skuCode: 'TEST-' + Date.now(),
      categoryId: cats[0].id,
      defaultUnitId: units[0].id,
      costPrice: 100,
      mrp: 150,
      sellingPrice: 120,
      stock: 10,
      isActive: true,
      isBatchTracked: false,
      isExpiryTracked: false
    }, admin.id); 
    console.log('Product created successfully');
  } catch (err) {
    console.error('Error during creation:');
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await app.close();
  }
}
bootstrap();
