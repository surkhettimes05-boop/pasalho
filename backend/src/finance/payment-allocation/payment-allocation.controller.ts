import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { PaymentAllocationService, AllocationItem } from './payment-allocation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentAllocationController {
  constructor(private readonly paymentAllocationService: PaymentAllocationService) {}

  @Post(':id/allocate')
  @RequirePermissions('payments.create')
  async allocatePayment(
    @Param('id') paymentId: string,
    @Body() body: { allocations: Array<{ invoiceId: string; amount: number }> },
    @CurrentUser() user: any,
  ) {
    return this.paymentAllocationService.allocatePayment(
      paymentId,
      body.allocations,
      user.id,
    );
  }

  @Post(':id/auto-allocate')
  @RequirePermissions('payments.create')
  async autoAllocate(
    @Param('id') paymentId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentAllocationService.autoAllocate(paymentId, user.id);
  }

  @Get(':id/allocation')
  @RequirePermissions('payments.view')
  async getPaymentAllocation(@Param('id') paymentId: string) {
    return this.paymentAllocationService.getPaymentAllocation(paymentId);
  }

  @Post(':id/reverse-allocation')
  @RequirePermissions('payments.create')
  async reverseAllocation(
    @Param('id') paymentId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentAllocationService.reverseAllocation(paymentId, user.id);
  }
}
