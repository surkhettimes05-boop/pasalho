import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DamageReportService } from './services/damage-report.service';
import { CreateDamageReportDto } from './dto/create-damage-report.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class RejectDamageReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('damage-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/damage-reports')
export class DamageReportController {
  constructor(private readonly damageReportService: DamageReportService) {}

  @Get()
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List damage reports' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.damageReportService.list(pagination, branchId, status);
  }

  @Get(':id')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get damage report by ID' })
  findById(@Param('id') id: string) {
    return this.damageReportService.findById(id);
  }

  @Post()
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Create damage report (DRAFT)' })
  create(@Body() dto: CreateDamageReportDto, @CurrentUser() actor: User) {
    return this.damageReportService.create(dto, actor.id);
  }

  @Post(':id/submit')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Submit damage report for approval' })
  submit(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.damageReportService.submit(id, actor.id);
  }

  @Post(':id/approve')
  @RequirePermissions('inventory.adjust.approve')
  @ApiOperation({ summary: 'Approve damage report' })
  approve(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.damageReportService.approve(id, actor.id);
  }

  @Post(':id/reject')
  @RequirePermissions('inventory.adjust.approve')
  @ApiOperation({ summary: 'Reject damage report' })
  reject(@Param('id') id: string, @Body() dto: RejectDamageReportDto, @CurrentUser() actor: User) {
    return this.damageReportService.reject(id, dto.reason ?? 'Rejected', actor.id);
  }

  @Post(':id/post')
  @RequirePermissions('inventory.adjust.post')
  @ApiOperation({ summary: 'Post approved damage report (deducts from AVAILABLE, credits DAMAGED)' })
  post(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.damageReportService.post(id, actor.id);
  }
}
