import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { OrganizationModule } from './organization/organization.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { FinanceModule } from './finance/finance.module';
import { SalesModule } from './sales/sales.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { appConfigSchema } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: appConfigSchema,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    CommonModule,
    AuthModule,
    IdentityModule,
    OrganizationModule,
    CatalogModule,
    InventoryModule,
    FinanceModule,
    SalesModule,
    AuditModule,
    HealthModule,
    DashboardModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
