import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { SalesModule } from '../sales/sales.module';
import { FinanceModule } from '../finance/finance.module';
import { RetailerAuthService } from './retailer-auth.service';
import { RetailerAuthController } from './retailer-auth.controller';
import { RetailerOrderService } from './retailer-order.service';
import { RetailerOrderController } from './retailer-order.controller';
import { RetailerNotificationService } from './retailer-notification.service';
import { RetailerNotificationController } from './retailer-notification.controller';
import { RetailerRecommendationService } from './retailer-recommendation.service';
import { RetailerRecommendationController } from './retailer-recommendation.controller';
import { WhatsAppOrderService } from './whatsapp-order.service';
import { WhatsAppOrderController } from './whatsapp-order.controller';
import { RetailerJwtStrategy } from './retailer-jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    FinanceModule,
    PassportModule.register({ defaultStrategy: 'retailer-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_RETAILER_SECRET') || config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_RETAILER_EXPIRES_IN', '30d') as any },
      }),
    }),
    SalesModule,
  ],
  controllers: [
    RetailerAuthController,
    RetailerOrderController,
    RetailerNotificationController,
    RetailerRecommendationController,
    WhatsAppOrderController,
  ],
  providers: [
    RetailerAuthService,
    RetailerOrderService,
    RetailerNotificationService,
    RetailerRecommendationService,
    WhatsAppOrderService,
    RetailerJwtStrategy,
  ],
  exports: [
    RetailerAuthService,
    RetailerOrderService,
    RetailerNotificationService,
    RetailerRecommendationService,
  ],
})
export class RetailerPortalModule {}
