import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  providers: [BranchService, WarehouseService],
  controllers: [BranchController, WarehouseController],
  exports: [BranchService, WarehouseService],
})
export class OrganizationModule {}
