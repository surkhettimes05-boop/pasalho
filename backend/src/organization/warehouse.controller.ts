import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @RequirePermissions('warehouses.view')
  @RequireScope('branch')
  @ApiOperation({ summary: 'List warehouses' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.warehouseService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('warehouses.view')
  @RequireScope('warehouse')
  @ApiOperation({ summary: 'Get warehouse' })
  findOne(@Param('id') id: string) {
    return this.warehouseService.findById(id);
  }

  @Post()
  @RequirePermissions('warehouses.create')
  @RequireScope('branch')
  @ApiOperation({ summary: 'Create warehouse' })
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() actor: User) {
    return this.warehouseService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('warehouses.update')
  @RequireScope('warehouse')
  @ApiOperation({ summary: 'Update warehouse' })
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser() actor: User) {
    return this.warehouseService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermissions('warehouses.update')
  @RequireScope('warehouse')
  @ApiOperation({ summary: 'Deactivate warehouse' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.warehouseService.deactivate(id, actor.id);
  }

  @Get(':id/inventory')
  @RequirePermissions('inventory.view')
  @RequireScope('warehouse')
  @ApiOperation({ summary: 'Get warehouse inventory snapshot' })
  getInventory(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.warehouseService.getInventory(id, pagination);
  }
}
