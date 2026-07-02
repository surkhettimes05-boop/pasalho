import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditLogService } from './audit-log.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { PassportModule } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [DatabaseModule, PassportModule],
  providers: [AuditLogService, AuditInterceptor, PermissionsGuard, JwtAuthGuard],
  controllers: [AuditController],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditModule {}

