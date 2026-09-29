import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AuthModule } from '../auth/auth.module';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';

@Module({ imports: [DatabaseModule, SalesOrdersModule, InventoryModule, AuthModule], controllers: [FranchiseController], providers: [FranchiseService] })
export class FranchiseModule {}
