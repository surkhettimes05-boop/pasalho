import { Prisma } from '@prisma/client';
import { mapPrismaError } from './prisma-error.mapper';

describe('mapPrismaError', () => {
  it('maps unique constraint violations to conflict errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['code'] },
    });

    const mapped = mapPrismaError(error);

    expect(mapped.statusCode).toBe(409);
    expect(mapped.code).toBe('CONFLICT');
  });
});
