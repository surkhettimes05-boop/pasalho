import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  providers: [RouteService],
  controllers: [RouteController],
  exports: [RouteService],
})
export class RouteModule {}
