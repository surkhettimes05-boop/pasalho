import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  @RequirePermissions('warehouses.view')
  @ApiOperation({ summary: 'List inventory locations' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'type', required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: string,
  ) {
    return this.locationService.list(pagination, { branchId, warehouseId, type });
  }

  @Get(':id')
  @RequirePermissions('warehouses.view')
  @ApiOperation({ summary: 'Get location' })
  findOne(@Param('id') id: string) {
    return this.locationService.findById(id);
  }

  @Post()
  @RequirePermissions('warehouses.create')
  @ApiOperation({ summary: 'Create location' })
  create(@Body() dto: CreateLocationDto, @CurrentUser() actor: User) {
    return this.locationService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('warehouses.update')
  @ApiOperation({ summary: 'Update location' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto, @CurrentUser() actor: User) {
    return this.locationService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermissions('warehouses.update')
  @ApiOperation({ summary: 'Deactivate location' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.locationService.deactivate(id, actor.id);
  }
}
