import { Prisma } from '@prisma/client';
import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

export function mapPrismaError(error: unknown): AppError | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }

  if (error.code === 'P2002') {
    return new AppError(ErrorCodes.CONFLICT, 'A record with this value already exists.', 409, {
      target: error.meta?.target,
    });
  }

  if (error.code === 'P2025') {
    return new AppError(ErrorCodes.NOT_FOUND, 'The requested record was not found.', 404);
  }

  if (error.code === 'P2003') {
    return new AppError(ErrorCodes.CONFLICT, 'This operation violates a related data constraint.', 409, {
      field: error.meta?.field_name,
    });
  }

  return new AppError(ErrorCodes.INTERNAL_ERROR, 'Database operation failed.', 500, {
    prismaCode: error.code,
  });
}
