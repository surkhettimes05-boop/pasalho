import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CustomerJwtGuard } from '../customer-auth/customer-jwt.guard';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CancelStorefrontOrderDto } from './dto/cancel-order.dto';
import { CustomerOrdersService } from './orders.service';

@ApiTags('commerce-orders')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('commerce/orders')
export class CustomerOrdersController {
  constructor(private readonly orders: CustomerOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List current customer storefront orders' })
  list(
    @CurrentCustomer() principal: { customerId: string },
    @Query() pagination: PaginationDto,
  ) {
    return this.orders.list(principal.customerId, pagination);
  }

  @Get(':id/tracking')
  @ApiOperation({ summary: 'Get customer-friendly order tracking timeline' })
  tracking(
    @CurrentCustomer() principal: { customerId: string },
    @Param('id') id: string,
  ) {
    return this.orders.tracking(principal.customerId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one storefront order owned by current customer' })
  detail(
    @CurrentCustomer() principal: { customerId: string },
    @Param('id') id: string,
  ) {
    return this.orders.detail(principal.customerId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a storefront order before picking starts' })
  cancel(
    @CurrentCustomer() principal: { customerId: string },
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CancelStorefrontOrderDto,
  ) {
    return this.orders.cancel(
      principal.customerId,
      id,
      idempotencyKey,
      dto,
    );
  }
}
