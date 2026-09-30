import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorefrontSystemActorService } from './common/storefront-system-actor.service';

@Module({
  imports: [DatabaseModule],
  providers: [StorefrontSystemActorService],
  exports: [StorefrontSystemActorService],
})
export class CommerceModule {}
