import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CashSessionService } from './cash-session.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('finance/cash-sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashSessionController {
  constructor(private readonly cashSessionService: CashSessionService) {}

  @Post('open')
  @RequirePermissions('inventory.view')
  async openSession(
    @Body() body: { branchId: string; openingBalance: number; notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.cashSessionService.openSession({
      branchId: body.branchId,
      openedById: user.id,
      openingBalance: body.openingBalance,
      notes: body.notes,
    });
  }

  @Post(':id/close')
  @RequirePermissions('inventory.view')
  async closeSession(
    @Param('id') sessionId: string,
    @Body() body: { closingBalance: number; actualCash: number; notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.cashSessionService.closeSession(sessionId, {
      closedById: user.id,
      closingBalance: body.closingBalance,
      actualCash: body.actualCash,
      notes: body.notes,
    });
  }

  @Get('current')
  @RequirePermissions('inventory.view')
  async getCurrentSession(@Query('branchId') branchId: string) {
    return this.cashSessionService.getCurrentSession(branchId);
  }

  @Get('history')
  @RequirePermissions('inventory.view')
  async getSessionHistory(
    @Query('branchId') branchId: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '50',
  ) {
    return this.cashSessionService.getSessionHistory(branchId, {
      skip: parseInt(skip),
      take: parseInt(take),
    });
  }

  @Get(':id')
  @RequirePermissions('inventory.view')
  async getSessionById(@Param('id') sessionId: string) {
    return this.cashSessionService.getSessionById(sessionId);
  }

  @Get('variance-report')
  @RequirePermissions('inventory.view')
  async getVarianceReport(
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashSessionService.getSessionVarianceReport(
      branchId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
