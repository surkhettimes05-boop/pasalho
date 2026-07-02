import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InventoryReconciliationService } from './services/inventory-reconciliation.service';
import { CreateStockCountDto, StockCountItemDto } from './dto/create-stock-count.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('inventory-reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/reconciliation')
export class InventoryReconciliationController {
  constructor(private readonly reconciliationService: InventoryReconciliationService) {}

  @Post('start')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Start a physical stock count session' })
  startCount(
    @Body() dto: { branchId: string; warehouseId: string; locationId: string },
    @CurrentUser() actor: User,
  ) {
    return this.reconciliationService.startStockCount({ ...dto, actorUserId: actor.id });
  }

  @Get('sessions')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List stock count sessions' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string, @Query('locationId') locationId?: string) {
    return this.reconciliationService.list({ branchId, locationId }, pagination);
  }

  @Get('sessions/:id')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get stock count session details' })
  findOne(@Param('id') id: string) {
    return this.reconciliationService.findById(id);
  }

  @Post('sessions/:id/update')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Update counted quantities in a session' })
  updateCount(@Param('id') id: string, @Body() items: StockCountItemDto[]) {
    return this.reconciliationService.updateCount(id, items);
  }

  @Post('sessions/:id/submit')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Submit stock count for reconciliation' })
  submit(@Param('id') id: string) {
    return this.reconciliationService.submit(id);
  }

  @Post('sessions/:id/reconcile')
  @RequirePermissions('inventory.adjust.post')
  @ApiOperation({ summary: 'Process reconciliation (generate and post adjustments)' })
  reconcile(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.reconciliationService.reconcile(id, actor.id);
  }
}
