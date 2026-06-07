import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx));
  }
}
