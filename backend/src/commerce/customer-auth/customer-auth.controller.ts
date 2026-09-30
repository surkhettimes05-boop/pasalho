import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerTokenService } from './customer-token.service';
import { CustomerJwtGuard } from './customer-jwt.guard';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshCustomerTokenDto } from './dto/refresh-customer-token.dto';

@ApiTags('commerce-auth')
@Controller('commerce/auth')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService, private readonly tokens: CustomerTokenService) {}

  @Post('request-otp')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Request a customer phone OTP' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Post('verify-otp')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify customer OTP and issue tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto, req.ip, req.headers['user-agent']);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a customer refresh token' })
  refresh(@Body() dto: RefreshCustomerTokenDto, @Req() req: Request) {
    return this.tokens.refresh(dto.refreshToken, req.ip, req.headers['user-agent']);
  }

  @Post('logout')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  logout(@CurrentCustomer() customer: { customerId: string; sessionId: string }) {
    return this.tokens.logout(customer.sessionId, customer.customerId);
  }
}
