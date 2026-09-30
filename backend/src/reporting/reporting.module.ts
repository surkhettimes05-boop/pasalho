import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
