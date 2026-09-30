import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../customer-auth/customer-jwt.guard';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CheckoutService } from './checkout.service';
import { CheckoutPreviewDto } from './dto/checkout-preview.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

@ApiTags('commerce-checkout')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('commerce')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('checkout/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reprice cart and issue a short-lived checkout token' })
  preview(
    @CurrentCustomer() principal: { customerId: string },
    @Body() dto: CheckoutPreviewDto,
  ) {
    return this.checkout.preview(principal.customerId, dto);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create an idempotent storefront order and reserve inventory' })
  placeOrder(
    @CurrentCustomer() principal: { customerId: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: PlaceOrderDto,
  ) {
    return this.checkout.placeOrder(
      principal.customerId,
      idempotencyKey,
      dto,
    );
  }
}
