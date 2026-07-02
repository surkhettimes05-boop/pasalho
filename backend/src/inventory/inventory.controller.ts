import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InventoryLedgerService } from './services/inventory-ledger.service';
import { StockAdjustmentService } from './services/stock-adjustment.service';
import { InventorySnapshotService } from './services/inventory-snapshot.service';
import { StockReservationService } from './services/stock-reservation.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ReserveStockDto, ReleaseStockDto } from './dto/stock-reservation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly ledger: InventoryLedgerService,
    private readonly adjustmentService: StockAdjustmentService,
    private readonly snapshotService: InventorySnapshotService,
    private readonly reservationService: StockReservationService,
  ) {}

  // ── Snapshots (enhanced) ──────────────────────────────────────────────────────

  @Get('snapshots')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List inventory snapshots with filters' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'lowStockThreshold', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  getSnapshots(
    @Query() pagination: PaginationDto,
    @Query('locationId') locationId?: string,
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
    @Query('lowStock') lowStock?: string,
    @Query('lowStockThreshold') lowStockThreshold?: string,
    @Query('search') search?: string,
  ) {
    const lowStockBool = lowStock === 'true';
    const threshold = lowStockThreshold ? Number(lowStockThreshold) : undefined;
    return this.snapshotService.listSnapshots(
      { locationId, branchId, productId, lowStock: lowStockBool, lowStockThreshold: threshold, search },
      pagination,
    );
  }

  @Get('snapshots/summary')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Stock summary (total SKUs, low stock, out of stock)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  getStockSummary(
    @Query('branchId') branchId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.snapshotService.getStockSummary(branchId, locationId);
  }

  @Get('snapshots/:id')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get snapshot by ID' })
  getSnapshot(@Param('id') id: string) {
    return this.snapshotService.findById(id);
  }

  @Get('products/:productId/stock')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get stock for a product across locations' })
  @ApiQuery({ name: 'branchId', required: false })
  getProductStock(
    @Param('productId') productId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.snapshotService.getStockByProduct(productId, branchId);
  }

  @Get('locations/:id/stock')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get stock for a specific location (flat)' })
  getLocationStock(@Param('id') locationId: string) {
    return this.snapshotService.getLocationStockFlat(locationId);
  }

  // ── Movements ────────────────────────────────────────────────────────────────

  @Get('movements')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get inventory movements' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  getMovements(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.ledger.getMovements({ branchId, productId, locationId }, { skip: pagination.skip, take: pagination.limit });
  }

  // ── Reservations ──────────────────────────────────────────────────────────────

  @Get('reservations')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List stock reservations' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  listReservations(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('locationId') locationId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reservationService.listReservations(
      { branchId, locationId, productId },
      { skip: pagination.skip, take: pagination.limit },
    );
  }

  @Post('reservations/reserve')
  @RequirePermissions('inventory.reserve')
  @ApiOperation({ summary: 'Reserve stock for a pending operation' })
  reserveStock(@Body() dto: ReserveStockDto, @CurrentUser() actor: User) {
    return this.reservationService.reserveStock({
      ...dto,
      createdById: actor.id,
    });
  }

  @Post('reservations/release')
  @RequirePermissions('inventory.reserve')
  @ApiOperation({ summary: 'Release reserved stock back to available' })
  releaseStock(@Body() dto: ReleaseStockDto, @CurrentUser() actor: User) {
    return this.reservationService.releaseStock({
      ...dto,
      createdById: actor.id,
    });
  }

  // ── Adjustments ──────────────────────────────────────────────────────────────

  @Get('adjustments')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List stock adjustments' })
  @ApiQuery({ name: 'branchId', required: false })
  listAdjustments(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.adjustmentService.list(pagination, branchId);
  }

  @Get('adjustments/:id')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get stock adjustment' })
  getAdjustment(@Param('id') id: string) {
    return this.adjustmentService.findById(id);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Create stock adjustment draft' })
  createAdjustment(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() actor: User) {
    return this.adjustmentService.create(dto, actor.id);
  }

  @Post('adjustments/:id/submit')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Submit adjustment for approval' })
  submitAdjustment(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.adjustmentService.submit(id, actor.id);
  }

  @Post('adjustments/:id/approve')
  @RequirePermissions('inventory.adjust.approve')
  @ApiOperation({ summary: 'Approve adjustment' })
  approveAdjustment(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.adjustmentService.approve(id, actor.id);
  }

  @Post('adjustments/:id/post')
  @RequirePermissions('inventory.adjust.post')
  @ApiOperation({ summary: 'Post approved adjustment to ledger' })
  postAdjustment(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.adjustmentService.post(id, actor.id);
  }
}
