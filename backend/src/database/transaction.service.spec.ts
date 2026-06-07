import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  it('delegates work to Prisma interactive transactions', async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (client: unknown) => Promise<string>) =>
        callback('tx-client'),
      ),
    };
    const service = new TransactionService(prisma as never);

    const result = await service.run((tx) => Promise.resolve(String(tx)));

    expect(result).toBe('tx-client');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
