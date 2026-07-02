import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RetailerAuthService } from './retailer-auth.service';
import { RetailerJwtAuthGuard } from './retailer-jwt-auth.guard';
import { CurrentRetailer } from './current-retailer.decorator';
import { RetailerLoginDto } from './dto/retailer-login.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { InitPinDto } from './dto/init-pin.dto';
import { Request } from 'express';

@ApiTags('retailer-portal/auth')
@Controller('retailer-portal/auth')
export class RetailerAuthController {
  constructor(private readonly authService: RetailerAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Retailer login with phone and PIN' })
  login(@Body() dto: RetailerLoginDto, @Req() req: Request) {
    const ipAddress = req.ip;
    return this.authService.login(dto.phone, dto.pin, dto.deviceId, dto.deviceType, ipAddress);
  }

  @Post('init-pin')
  @ApiOperation({ summary: 'Initialize retailer PIN (first-time, no auth required)' })
  initPin(@Body() dto: InitPinDto) {
    if (dto.pin !== dto.confirmPin) {
      throw new Error('PINs do not match.');
    }
    return this.authService.initPin(dto.phone, dto.pin);
  }

  @Post('set-pin')
  @UseGuards(RetailerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set retailer PIN' })
  setPin(@Body() dto: SetPinDto, @CurrentRetailer() retailerId: string) {
    return this.authService.setPin(retailerId, dto.pin);
  }

  @Post('change-pin')
  @UseGuards(RetailerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change retailer PIN' })
  changePin(@Body() dto: ChangePinDto, @CurrentRetailer() retailerId: string) {
    return this.authService.changePin(retailerId, dto.currentPin, dto.newPin);
  }

  @Post('logout')
  @UseGuards(RetailerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retailer logout' })
  async logout(@CurrentRetailer() _retailerId: string, @Req() req: Request) {
    const sessionId = (req as any).user?.['sessionId'];
    await this.authService.logout(sessionId);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(RetailerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get retailer profile' })
  getProfile(@CurrentRetailer() retailerId: string) {
    return this.authService.getProfile(retailerId);
  }
}
