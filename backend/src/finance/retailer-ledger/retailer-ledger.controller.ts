import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { RetailerLedgerService, AgingBucket } from './retailer-ledger.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RetailerLedgerEntryType, ReferenceType } from '@prisma/client';

@Controller('finance/retailers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RetailerLedgerController {
  constructor(private readonly retailerLedgerService: RetailerLedgerService) {}

  @Get(':id/ledger')
  @RequirePermissions('retailer_ledger.view')
  async getLedger(
    @Param('id') retailerId: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '50',
    @Query('entryType') entryType?: RetailerLedgerEntryType,
    @Query('referenceType') referenceType?: ReferenceType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    if (entryType) filters.entryType = entryType;
    if (referenceType) filters.referenceType = referenceType;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.retailerLedgerService.getLedger(
      retailerId,
      { skip: parseInt(skip), take: parseInt(take) },
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Get(':id/outstanding')
  @RequirePermissions('retailer_ledger.view')
  async getOutstanding(@Param('id') retailerId: string) {
    const outstanding = await this.retailerLedgerService.getOutstanding(retailerId);
    return { retailerId, outstanding };
  }

  @Get(':id/aging')
  @RequirePermissions('retailer_ledger.view')
  async getAgingReport(@Param('id') retailerId: string) {
    return this.retailerLedgerService.getAgingReport(retailerId);
  }

  @Get(':id/entries/date-range')
  @RequirePermissions('retailer_ledger.view')
  async getEntriesByDateRange(
    @Param('id') retailerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.retailerLedgerService.getEntriesByDateRange(
      retailerId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
