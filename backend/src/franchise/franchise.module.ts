import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';

@Module({ imports: [DatabaseModule, SalesOrdersModule], controllers: [FranchiseController], providers: [FranchiseService] })
export class FranchiseModule {}
