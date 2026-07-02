import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { FinancialLedgerService } from './financial-ledger.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FinancialLedgerEntryType, ReferenceType } from '@prisma/client';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancialLedgerController {
  constructor(private readonly financialLedgerService: FinancialLedgerService) {}

  @Get('financial/ledger')
  @RequirePermissions('dashboard.view')
  async getLedger(
    @Query('branchId') branchId: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '50',
    @Query('entryType') entryType?: FinancialLedgerEntryType,
    @Query('referenceType') referenceType?: ReferenceType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    if (entryType) filters.entryType = entryType;
    if (referenceType) filters.referenceType = referenceType;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.financialLedgerService.getLedger(
      branchId,
      { skip: parseInt(skip), take: parseInt(take) },
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Get('financial/balance')
  @RequirePermissions('dashboard.view')
  async getBalance(@Query('branchId') branchId: string) {
    const balance = await this.financialLedgerService.getBalance(branchId);
    return { branchId, balance };
  }

  @Get('financial/summary')
  @RequirePermissions('dashboard.view')
  async getFinancialSummary(@Query('branchId') branchId: string) {
    return this.financialLedgerService.getFinancialSummary(branchId);
  }
}
