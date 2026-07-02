import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RetailerOrderService } from './retailer-order.service';
import { RetailerJwtAuthGuard } from './retailer-jwt-auth.guard';
import { CurrentRetailer } from './current-retailer.decorator';
import { CreateRetailerOrderDto } from './dto/create-retailer-order.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('retailer-portal/orders')
@ApiBearerAuth()
@UseGuards(RetailerJwtAuthGuard)
@Controller('retailer-portal/orders')
export class RetailerOrderController {
  constructor(private readonly orderService: RetailerOrderService) {}

  @Get()
  @ApiOperation({ summary: 'List retailer orders' })
  listOrders(@CurrentRetailer() retailerId: string, @Query() pagination: PaginationDto) {
    return this.orderService.listOrders(retailerId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  getOrder(@CurrentRetailer() retailerId: string, @Param('id') id: string) {
    return this.orderService.getOrder(retailerId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Place a new order' })
  placeOrder(@CurrentRetailer() retailerId: string, @Body() dto: CreateRetailerOrderDto) {
    return this.orderService.placeOrder(retailerId, dto.items, dto.notes);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order' })
  cancelOrder(@CurrentRetailer() retailerId: string, @Param('id') id: string) {
    return this.orderService.cancelOrder(retailerId, id);
  }
}
