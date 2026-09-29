import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RetailerService, UpdateRetailerDto } from './retailer.service';
import { CreateRetailerDto } from './dto/create-retailer.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('retailers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller('retailers')
export class RetailerController {
  constructor(private readonly retailerService: RetailerService) {}

  @Get()
  @RequirePermissions('retailers.view')
  @RequireScope('branch')
  @ApiOperation({ summary: 'List retailers' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.retailerService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('retailers.view')
  @RequireScope('retailer')
  @ApiOperation({ summary: 'Get retailer' })
  findOne(@Param('id') id: string) {
    return this.retailerService.findById(id);
  }

  @Post()
  @RequirePermissions('retailers.create')
  @RequireScope('branch')
  @ApiOperation({ summary: 'Create retailer' })
  create(@Body() dto: CreateRetailerDto, @CurrentUser() actor: User) {
    return this.retailerService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('retailers.update')
  @RequireScope('retailer')
  @ApiOperation({ summary: 'Update retailer' })
  update(@Param('id') id: string, @Body() dto: UpdateRetailerDto, @CurrentUser() actor: User) {
    return this.retailerService.update(id, dto, actor.id);
  }

  @Get(':id/ledger')
  @RequirePermissions('retailer_ledger.view')
  @RequireScope('retailer')
  @ApiOperation({ summary: 'Get retailer credit ledger' })
  getLedger(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.retailerService.getLedger(id, pagination);
  }

  @Get(':id/outstanding')
  @RequirePermissions('retailer_ledger.view')
  @RequireScope('retailer')
  @ApiOperation({ summary: 'Get retailer outstanding balance' })
  getOutstanding(@Param('id') id: string) {
    return this.retailerService.getOutstanding(id);
  }
}
