import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto, MarkItemDeliveredDto } from './dto/update-delivery.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('deliveries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  @RequirePermissions('deliveries.view')
  @ApiOperation({ summary: 'List deliveries' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'routeId', required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('routeId') routeId?: string,
  ) {
    return this.deliveryService.list(pagination, branchId, status, routeId);
  }

  @Get(':id')
  @RequirePermissions('deliveries.view')
  @ApiOperation({ summary: 'Get delivery by ID' })
  findById(@Param('id') id: string) {
    return this.deliveryService.findById(id);
  }

  @Post()
  @RequirePermissions('deliveries.manage')
  @ApiOperation({ summary: 'Create delivery' })
  create(@Body() dto: CreateDeliveryDto, @CurrentUser() actor: User) {
    return this.deliveryService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('deliveries.manage')
  @ApiOperation({ summary: 'Update delivery details' })
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryDto, @CurrentUser() actor: User) {
    return this.deliveryService.update(id, dto, actor.id);
  }

  @Post(':id/dispatch')
  @RequirePermissions('deliveries.manage')
  @ApiOperation({ summary: 'Dispatch delivery (PENDING → IN_TRANSIT)' })
  dispatch(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.deliveryService.dispatch(id, actor.id);
  }

  @Post(':id/complete')
  @RequirePermissions('deliveries.manage')
  @ApiOperation({ summary: 'Complete delivery (IN_TRANSIT → DELIVERED)' })
  complete(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.deliveryService.complete(id, actor.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('deliveries.manage')
  @ApiOperation({ summary: 'Cancel delivery' })
  cancel(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.deliveryService.cancel(id, actor.id);
  }

  @Post(':id/items/:itemId/delivered')
  @RequirePermissions('deliveries.manage')
  @ApiOperation({ summary: 'Mark individual delivery item as delivered' })
  markItemDelivered(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: MarkItemDeliveredDto,
    @CurrentUser() actor: User,
  ) {
    return this.deliveryService.markItemDelivered(id, itemId, dto.notes, actor.id);
  }
}
