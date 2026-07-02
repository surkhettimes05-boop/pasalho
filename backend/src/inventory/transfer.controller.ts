import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StockTransferService } from './services/stock-transfer.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('stock-transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/transfers')
export class TransferController {
  constructor(private readonly transferService: StockTransferService) {}

  @Get()
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List stock transfers' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.transferService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findById(@Param('id') id: string) {
    return this.transferService.findById(id);
  }

  @Post()
  @RequirePermissions('inventory.transfer.create')
  @ApiOperation({ summary: 'Create stock transfer draft' })
  create(@Body() dto: CreateStockTransferDto, @CurrentUser() actor: User) {
    return this.transferService.create(dto, actor.id);
  }

  @Post(':id/ship')
  @RequirePermissions('inventory.transfer.ship')
  @ApiOperation({ summary: 'Ship transfer (deduct from origin, mark in-transit)' })
  ship(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.transferService.ship(id, actor.id);
  }

  @Post(':id/receive')
  @RequirePermissions('inventory.transfer.receive')
  @ApiOperation({ summary: 'Receive transfer (add to destination, clear in-transit)' })
  receive(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.transferService.receive(id, actor.id);
  }
}
