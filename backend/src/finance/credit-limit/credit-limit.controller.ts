import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CreditLimitService } from './credit-limit.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CreditLimitController {
  constructor(private readonly creditLimitService: CreditLimitService) {}

  @Post('retailers/:id/credit-request')
  @RequirePermissions('retailers.update')
  async requestIncrease(
    @Param('id') retailerId: string,
    @Body() body: { branchId: string; newLimit: number; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.creditLimitService.requestIncrease({
      retailerId,
      branchId: body.branchId,
      requestedById: user.id,
      newLimit: body.newLimit,
      reason: body.reason,
    });
  }

  @Post('credit-approvals/:id/approve')
  @RequirePermissions('retailers.update')
  async approveRequest(
    @Param('id') approvalId: string,
    @CurrentUser() user: any,
  ) {
    return this.creditLimitService.approveRequest(approvalId, user.id);
  }

  @Post('credit-approvals/:id/reject')
  @RequirePermissions('retailers.update')
  async rejectRequest(
    @Param('id') approvalId: string,
    @Body() body: { rejectionReason: string },
    @CurrentUser() user: any,
  ) {
    return this.creditLimitService.rejectRequest(
      approvalId,
      user.id,
      body.rejectionReason,
    );
  }

  @Get('credit-approvals')
  @RequirePermissions('retailers.view')
  async getCreditApprovals(
    @Query('retailerId') retailerId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.creditLimitService.getCreditApprovals({
      retailerId,
      branchId,
      status: status as any,
    });
  }

  @Get('retailers/:id/credit-history')
  @RequirePermissions('retailers.view')
  async getRetailerCreditHistory(@Param('id') retailerId: string) {
    return this.creditLimitService.getRetailerCreditHistory(retailerId);
  }

  @Get('retailers/:id/credit-check')
  @RequirePermissions('retailers.view')
  async checkCreditLimit(
    @Param('id') retailerId: string,
    @Query('orderAmount') orderAmount: string,
  ) {
    return this.creditLimitService.checkCreditLimit(
      retailerId,
      parseFloat(orderAmount),
    );
  }
}
