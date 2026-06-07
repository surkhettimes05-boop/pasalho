import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SalesRepService } from './sales-rep.service';
import { CreateSalesRepDto } from './dto/create-sales-rep.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('sales-reps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales-reps')
export class SalesRepController {
  constructor(private readonly salesRepService: SalesRepService) {}

  @Get()
  @RequirePermissions('sales_reps.view')
  @ApiOperation({ summary: 'List sales reps' })
  @ApiQuery({ name: 'branchId', required: false })
  list(@Query() pagination: PaginationDto, @Query('branchId') branchId?: string) {
    return this.salesRepService.list(pagination, branchId);
  }

  @Get(':id')
  @RequirePermissions('sales_reps.view')
  @ApiOperation({ summary: 'Get sales rep' })
  findOne(@Param('id') id: string) {
    return this.salesRepService.findById(id);
  }

  @Post()
  @RequirePermissions('sales_reps.create')
  @ApiOperation({ summary: 'Create sales rep' })
  create(@Body() dto: CreateSalesRepDto, @CurrentUser() actor: User) {
    return this.salesRepService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('sales_reps.view')
  @ApiOperation({ summary: 'Update sales rep status' })
  update(@Param('id') id: string, @Body() dto: { status?: any }, @CurrentUser() actor: User) {
    return this.salesRepService.update(id, dto, actor.id);
  }
}
