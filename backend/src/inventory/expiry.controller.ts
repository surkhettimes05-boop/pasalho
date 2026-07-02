import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExpiryService } from './services/expiry.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class MarkActedUponDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionNote?: string;
}

@ApiTags('expiry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/expiry')
export class ExpiryController {
  constructor(private readonly expiryService: ExpiryService) {}

  @Get('events')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List expiry events' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  @ApiQuery({ name: 'isActedUpon', required: false, type: Boolean })
  listEvents(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('daysAhead') daysAhead?: string,
    @Query('isActedUpon') isActedUpon?: string,
  ) {
    return this.expiryService.listExpiryEvents(
      pagination,
      branchId,
      daysAhead ? Number(daysAhead) : undefined,
      isActedUpon !== undefined ? isActedUpon === 'true' : undefined,
    );
  }

  @Get('summary')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get expiry dashboard summary' })
  @ApiQuery({ name: 'branchId', required: false })
  getSummary(@Query('branchId') branchId?: string) {
    return this.expiryService.getExpirySummary(branchId);
  }

  @Post('scan')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Scan for expiring batches and generate expiry events' })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  scan(@Query('daysAhead') daysAhead?: string) {
    return this.expiryService.scanExpiringBatches(daysAhead ? Number(daysAhead) : 60);
  }

  @Post('events/:id/acted-upon')
  @RequirePermissions('inventory.adjust.create')
  @ApiOperation({ summary: 'Mark expiry event as acted upon' })
  markActedUpon(@Param('id') id: string, @Body() dto: MarkActedUponDto) {
    return this.expiryService.markActedUpon(id, dto.actionNote ?? 'Actioned');
  }

  @Post('batches/:batchId/block')
  @RequirePermissions('inventory.adjust.approve')
  @ApiOperation({ summary: 'Manually block a batch' })
  blockBatch(@Param('batchId') batchId: string, @CurrentUser() actor: User) {
    return this.expiryService.blockBatch(batchId, actor.id);
  }
}
