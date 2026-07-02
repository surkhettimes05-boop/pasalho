import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  providers: [BranchService, WarehouseService, LocationService, StoreService],
  controllers: [BranchController, WarehouseController, LocationController, StoreController],
  exports: [BranchService, WarehouseService, LocationService, StoreService],
})
export class OrganizationModule {}
