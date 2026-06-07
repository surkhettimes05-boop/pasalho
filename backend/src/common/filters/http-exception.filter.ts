import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { mapPrismaError } from '../errors/prisma-error.mapper';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const mapped = this.toAppError(exception);

    response.status(mapped.statusCode).json({
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details ?? {},
      },
      requestId: request.headers['x-request-id'] ?? null,
    });
  }

  private toAppError(exception: unknown): AppError {
    if (exception instanceof AppError) {
      return exception;
    }

    const prismaError = mapPrismaError(exception);
    if (prismaError) {
      return prismaError;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? Array.isArray(body.message)
            ? body.message.join(', ')
            : String(body.message)
          : exception.message;

      return new AppError(
        statusCode === HttpStatus.BAD_REQUEST ? ErrorCodes.VALIDATION_ERROR : exception.name,
        message,
        statusCode,
      );
    }

    return new AppError(ErrorCodes.INTERNAL_ERROR, 'Internal server error.', 500);
  }
}
