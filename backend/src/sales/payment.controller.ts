import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @RequirePermissions('payments.view')
  @RequireScope('branch')
  @ApiOperation({ summary: 'List payments' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.paymentService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('payments.view')
  @RequireScope('payment')
  @ApiOperation({ summary: 'Get payment' })
  findOne(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  @Post()
  @RequirePermissions('payments.create')
  @RequireScope('payment')
  @ApiOperation({ summary: 'Record payment' })
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: User,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentService.create(dto, actor.id, idempotencyKey);
  }
}
