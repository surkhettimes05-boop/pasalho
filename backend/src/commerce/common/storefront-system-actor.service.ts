import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

@Injectable()
export class StorefrontSystemActorService {
  private cachedUserId: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;

    const configuredId = this.config.get<string>('STOREFRONT_SYSTEM_USER_ID');
    if (!configuredId) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        'STOREFRONT_SYSTEM_USER_ID is not configured.',
        500,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: configuredId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        'Configured storefront system actor is missing or inactive.',
        500,
      );
    }

    this.cachedUserId = user.id;
    return user.id;
  }
}
