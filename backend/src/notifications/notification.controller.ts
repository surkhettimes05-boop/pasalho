import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
    @CurrentUser() actor?: User,
  ) {
    return this.notificationService.listForUser(actor!.id, pagination, status as any);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id') id: string) {
    return this.notificationService.markRead(id);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() actor: User) {
    return this.notificationService.markAllRead(actor.id);
  }

  @Post('generate-low-stock-alerts')
  @ApiOperation({ summary: 'Trigger low-stock alert generation (admin/cron)' })
  generateAlerts() {
    return this.notificationService.generateLowStockAlerts();
  }
}
