import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class RetailerJwtAuthGuard extends AuthGuard('retailer-jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new AppError(ErrorCodes.AUTH_REQUIRED, 'Unauthorized retailer access.', 401);
    }
    return user;
  }
}
