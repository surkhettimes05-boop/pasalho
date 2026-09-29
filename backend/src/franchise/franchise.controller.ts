import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FranchiseService } from './franchise.service';
import { CreateFranchisePartnerDto, CreateFranchiseStoreDto, CreateFranchiseSupplyOrderDto } from './franchise.dto';

@ApiTags('franchise')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('franchise')
export class FranchiseController {
  constructor(private readonly franchise: FranchiseService) {}

  @Get('overview') @RequirePermissions('sales-orders.view')
  overview() { return this.franchise.overview(); }

  @Get('partners') @RequirePermissions('sales-orders.view')
  listPartners() { return this.franchise.listPartners(); }

  @Post('partners') @RequirePermissions('sales-orders.create')
  createPartner(@Body() dto: CreateFranchisePartnerDto) { return this.franchise.createPartner(dto); }

  @Get('stores') @RequirePermissions('sales-orders.view')
  listStores() { return this.franchise.listStores(); }

  @Post('stores') @RequirePermissions('sales-orders.create')
  createStore(@Body() dto: CreateFranchiseStoreDto) { return this.franchise.createStore(dto); }

  @Get('supply-orders') @RequirePermissions('sales-orders.view')
  listOrders() { return this.franchise.listOrders(); }

  @Post('supply-orders') @RequirePermissions('sales-orders.create')
  createOrder(@Body() dto: CreateFranchiseSupplyOrderDto, @CurrentUser() actor: User) {
    return this.franchise.createSupplyOrder(dto, actor.id);
  }

  @Get('supply-orders/:id') @RequirePermissions('sales-orders.view')
  getOrder(@Param('id') id: string) { return this.franchise.getOrder(id); }

  @Post('supply-orders/:id/:action') @RequirePermissions('sales-orders.create')
  transition(@Param('id') id: string, @Param('action') action: 'approve' | 'pick' | 'pack' | 'dispatch' | 'receive', @CurrentUser() actor: User) {
    return this.franchise.transition(id, action, actor.id);
  }
}
