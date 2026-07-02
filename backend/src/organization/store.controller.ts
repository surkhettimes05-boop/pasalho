import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  @RequirePermissions('warehouses.view')
  @ApiOperation({ summary: 'List stores' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.storeService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('warehouses.view')
  @ApiOperation({ summary: 'Get store' })
  findOne(@Param('id') id: string) {
    return this.storeService.findById(id);
  }

  @Post()
  @RequirePermissions('warehouses.create')
  @ApiOperation({ summary: 'Create store' })
  create(@Body() dto: CreateStoreDto, @CurrentUser() actor: User) {
    return this.storeService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('warehouses.update')
  @ApiOperation({ summary: 'Update store' })
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto, @CurrentUser() actor: User) {
    return this.storeService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermissions('warehouses.update')
  @ApiOperation({ summary: 'Deactivate store' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.storeService.deactivate(id, actor.id);
  }
}
