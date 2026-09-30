import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SalesOrderStatus, User } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { ScopeGuard } from '../../auth/scope.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RequireScope } from '../../auth/decorators/require-scope.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PickStorefrontItemDto } from './dto/pick-item.dto';
import { ReportStorefrontShortageDto } from './dto/report-shortage.dto';
import { StorefrontFulfillmentService } from './fulfillment.service';

@ApiTags('commerce-fulfillment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller('commerce/fulfillment/orders')
export class StorefrontFulfillmentController {
  constructor(private readonly fulfillment: StorefrontFulfillmentService) {}

  @Get()
  @RequirePermissions('sales-orders.view')
  @RequireScope('branch')
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Query('branchId') branchId: string,
    @Query('status') status: SalesOrderStatus | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.fulfillment.list(branchId, status, pagination);
  }

  @Get(':id')
  @RequirePermissions('sales-orders.view')
  @RequireScope('order')
  detail(@Param('id') id: string) {
    return this.fulfillment.detail(id);
  }

  @Post(':id/start-picking')
  @RequirePermissions('deliveries.manage')
  @RequireScope('order')
  @ApiOperation({ summary: 'Start store picking for a storefront order' })
  startPicking(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.fulfillment.startPicking(id, actor.id);
  }

  @Post(':id/items/:orderItemId/pick')
  @RequirePermissions('deliveries.manage')
  @RequireScope('order')
  pickItem(
    @Param('id') id: string,
    @Param('orderItemId') orderItemId: string,
    @Body() dto: PickStorefrontItemDto,
    @CurrentUser() actor: User,
  ) {
    return this.fulfillment.pickItem(id, orderItemId, dto, actor.id);
  }

  @Post(':id/items/:orderItemId/shortage')
  @RequirePermissions('deliveries.manage')
  @RequireScope('order')
  reportShortage(
    @Param('id') id: string,
    @Param('orderItemId') orderItemId: string,
    @Body() dto: ReportStorefrontShortageDto,
    @CurrentUser() actor: User,
  ) {
    return this.fulfillment.reportShortage(
      id,
      orderItemId,
      dto,
      actor.id,
    );
  }

  @Post(':id/pack')
  @RequirePermissions('deliveries.manage')
  @RequireScope('order')
  pack(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.fulfillment.pack(id, actor.id);
  }

  @Post(':id/dispatch')
  @RequirePermissions('deliveries.manage')
  @RequireScope('order')
  @ApiOperation({ summary: 'Dispatch a packed storefront order and consume its reservation' })
  dispatch(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.fulfillment.dispatch(id, actor.id);
  }

  @Post(':id/deliver')
  @RequirePermissions('deliveries.manage')
  @RequireScope('order')
  @ApiOperation({ summary: 'Complete delivery and collect COD payment' })
  deliver(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.fulfillment.deliver(id, actor.id);
  }

}
