import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RetailerNotificationService } from './retailer-notification.service';
import { RetailerJwtAuthGuard } from './retailer-jwt-auth.guard';
import { CurrentRetailer } from './current-retailer.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('retailer-portal/notifications')
@ApiBearerAuth()
@UseGuards(RetailerJwtAuthGuard)
@Controller('retailer-portal/notifications')
export class RetailerNotificationController {
  constructor(private readonly notificationService: RetailerNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List retailer notifications' })
  list(@CurrentRetailer() retailerId: string, @Query() pagination: PaginationDto, @Query('status') status?: string) {
    return this.notificationService.list(retailerId, pagination, status as any);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@CurrentRetailer() retailerId: string, @Param('id') id: string) {
    return this.notificationService.markRead(id, retailerId);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentRetailer() retailerId: string) {
    return this.notificationService.markAllRead(retailerId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentRetailer() retailerId: string) {
    return this.notificationService.unreadCount(retailerId);
  }
}
