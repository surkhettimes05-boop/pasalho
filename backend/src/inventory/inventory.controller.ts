import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InventoryLedgerService } from './services/inventory-ledger.service';
import { StockAdjustmentService } from './services/stock-adjustment.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
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
  ) {}

  @Get('snapshots')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get inventory snapshots by location' })
  @ApiQuery({ name: 'locationId', required: true })
  getSnapshots(@Query() pagination: PaginationDto, @Query('locationId') locationId: string) {
    return this.ledger.getSnapshots(locationId, { skip: pagination.skip, take: pagination.limit });
  }

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

  @Get('locations/:id/stock')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get stock for a specific location' })
  getLocationStock(@Param('id') locationId: string, @Query() pagination: PaginationDto) {
    return this.ledger.getSnapshots(locationId, { skip: pagination.skip, take: pagination.limit });
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
