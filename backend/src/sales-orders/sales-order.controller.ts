import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ConvertToInvoiceDto } from './dto/convert-to-invoice.dto';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('sales-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @Post('public/checkout')
  @Public()
  @ApiOperation({ summary: 'Create public storefront order (Guest COD)' })
  publicCheckout(@Body() dto: PublicCheckoutDto) {
    return this.salesOrderService.createPublicOrder(dto);
  }

  @Get()
  @RequirePermissions('sales-orders.view')
  @ApiOperation({ summary: 'List sales orders' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'salesRepId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'source', required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('salesRepId') salesRepId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
  ) {
    return this.salesOrderService.list(pagination, branchId, salesRepId, status, source);
  }

  @Get(':id')
  @RequirePermissions('sales-orders.view')
  @ApiOperation({ summary: 'Get sales order by ID' })
  findById(@Param('id') id: string) {
    return this.salesOrderService.findById(id);
  }

  @Post()
  @RequirePermissions('sales-orders.create')
  @ApiOperation({ summary: 'Create sales order' })
  create(@Body() dto: CreateSalesOrderDto, @CurrentUser() actor: User) {
    return this.salesOrderService.create(dto, actor.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('sales-orders.create')
  @ApiOperation({ summary: 'Confirm sales order' })
  confirm(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.salesOrderService.confirm(id, actor.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales-orders.create')
  @ApiOperation({ summary: 'Cancel sales order' })
  cancel(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.salesOrderService.cancel(id, actor.id);
  }

  @Post(':id/status')
  @RequirePermissions('sales-orders.create')
  @ApiOperation({ summary: 'Update storefront order status (PACKED or DELIVERED)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'PACKED' | 'DELIVERED',
    @CurrentUser() actor: User,
  ) {
    return this.salesOrderService.updateStatus(id, status, actor.id);
  }

  @Post(':id/convert-to-invoice')
  @RequirePermissions('invoices.create')
  @ApiOperation({ summary: 'Convert confirmed order to invoice' })
  convertToInvoice(
    @Param('id') id: string,
    @Body() dto: ConvertToInvoiceDto,
    @CurrentUser() actor: User,
  ) {
    return this.salesOrderService.convertToInvoice(id, dto, actor.id);
  }
}
