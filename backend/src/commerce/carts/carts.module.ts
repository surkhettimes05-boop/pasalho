import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { StorefrontCatalogModule } from '../storefront-catalog/storefront-catalog.module';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';

@Module({
  imports: [DatabaseModule, StorefrontCatalogModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
