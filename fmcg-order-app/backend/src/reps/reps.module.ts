import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RepsController } from './reps.controller';

@Module({
  controllers: [RepsController],
  providers: [PrismaService],
})
export class RepsModule {}
