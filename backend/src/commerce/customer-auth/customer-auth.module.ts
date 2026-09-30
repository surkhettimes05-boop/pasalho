import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtGuard } from './customer-jwt.guard';
import { CustomerTokenService } from './customer-token.service';
import { ConsoleOtpProvider, HttpOtpProvider, OTP_PROVIDER } from './otp.provider';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('CUSTOMER_JWT_SECRET') ?? config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<number>('CUSTOMER_JWT_TTL_SECONDS', 900) },
      }),
    }),
  ],
  controllers: [CustomerAuthController],
  providers: [
    CustomerAuthService,
    CustomerTokenService,
    CustomerJwtGuard,
    {
      provide: OTP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('OTP_PROVIDER', 'console') === 'sms'
          ? new HttpOtpProvider(
              config.getOrThrow<string>('OTP_SMS_WEBHOOK_URL'),
              config.getOrThrow<string>('OTP_SMS_WEBHOOK_TOKEN'),
            )
          : new ConsoleOtpProvider(),
    },
  ],
  exports: [CustomerJwtGuard, CustomerTokenService],
})
export class CustomerAuthModule {}
