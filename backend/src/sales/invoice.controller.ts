import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @RequirePermissions('invoices.view')
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.invoiceService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('invoices.view')
  @ApiOperation({ summary: 'Get invoice' })
  findOne(@Param('id') id: string) {
    return this.invoiceService.findById(id);
  }

  @Get(':id/receipt')
  @RequirePermissions('invoices.view')
  @ApiOperation({ summary: 'Get invoice receipt data' })
  getReceipt(@Param('id') id: string) {
    return this.invoiceService.findById(id);
  }

  @Post()
  @RequirePermissions('invoices.create')
  @ApiOperation({ summary: 'Create draft invoice' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() actor: User) {
    return this.invoiceService.create(dto, actor.id);
  }

  @Post(':id/post')
  @RequirePermissions('invoices.post')
  @ApiOperation({ summary: 'Post invoice (deducts stock + creates ledger entries)' })
  post(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.invoiceService.post(id, actor.id);
  }

  @Post(':id/void')
  @RequirePermissions('invoices.void')
  @ApiOperation({ summary: 'Void invoice (creates reversal event)' })
  void(@Param('id') id: string, @Body() dto: VoidInvoiceDto, @CurrentUser() actor: User) {
    return this.invoiceService.void(id, dto, actor.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('invoices.create')
  @ApiOperation({ summary: 'Cancel draft invoice' })
  cancel(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.invoiceService.cancel(id, actor.id);
  }
}
