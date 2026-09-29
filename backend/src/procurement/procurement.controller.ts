import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateGoodsReceiptDto, CreatePurchaseOrderDto, CreateSupplierDto, UpdateSupplierDto } from './dto/procurement.dto';
import { ProcurementService } from './procurement.service';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller()
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get('suppliers')
  @RequirePermissions('suppliers.view')
  listSuppliers(@Query() pagination: PaginationDto) { return this.procurement.listSuppliers(pagination); }

  @Post('suppliers')
  @RequirePermissions('suppliers.create')
  createSupplier(@Body() dto: CreateSupplierDto, @CurrentUser() actor: User) { return this.procurement.createSupplier(dto, actor.id); }

  @Get('suppliers/:id')
  @RequirePermissions('suppliers.view')
  getSupplier(@Param('id') id: string) { return this.procurement.getSupplier(id); }

  @Patch('suppliers/:id')
  @RequirePermissions('suppliers.update')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() actor: User) { return this.procurement.updateSupplier(id, dto, actor.id); }

  @Delete('suppliers/:id')
  @RequirePermissions('suppliers.update')
  deactivateSupplier(@Param('id') id: string, @CurrentUser() actor: User) { return this.procurement.deactivateSupplier(id, actor.id); }

  @Get('purchase-orders')
  @RequirePermissions('purchases.view')
  @RequireScope('warehouse')
  listPurchaseOrders(@Query() pagination: PaginationDto, @Query('warehouseId') warehouseId: string) { return this.procurement.listPurchaseOrders(pagination, warehouseId); }

  @Post('purchase-orders')
  @RequirePermissions('purchases.create')
  @RequireScope('warehouse')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() actor: User) { return this.procurement.createPurchaseOrder(dto, actor.id); }

  @Get('purchase-orders/:id')
  @RequirePermissions('purchases.view')
  @RequireScope('purchase-order')
  getPurchaseOrder(@Param('id') id: string) { return this.procurement.getPurchaseOrder(id); }

  @Post('purchase-orders/:id/confirm')
  @RequirePermissions('purchases.confirm')
  @RequireScope('purchase-order')
  confirmPurchaseOrder(@Param('id') id: string, @CurrentUser() actor: User) { return this.procurement.confirmPurchaseOrder(id, actor.id); }

  @Post('purchase-orders/:id/cancel')
  @RequirePermissions('purchases.confirm')
  @RequireScope('purchase-order')
  cancelPurchaseOrder(@Param('id') id: string, @CurrentUser() actor: User) { return this.procurement.cancelPurchaseOrder(id, actor.id); }

  @Get('purchase-orders/:id/receipts')
  @RequirePermissions('purchases.view')
  @RequireScope('purchase-order')
  listGoodsReceipts(@Param('id') id: string) { return this.procurement.listGoodsReceipts(id); }

  @Post('purchase-orders/:id/receipts')
  @RequirePermissions('purchases.receive')
  @RequireScope('purchase-order')
  receiveGoods(@Param('id') id: string, @Body() dto: CreateGoodsReceiptDto, @Headers('idempotency-key') key: string, @CurrentUser() actor: User) {
    return this.procurement.receiveGoods(id, dto, key, actor.id);
  }
}
