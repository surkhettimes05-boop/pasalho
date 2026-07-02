import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller('orders')
export class OrdersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getOrders(
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('repId') repId?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (repId) where.repId = repId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: { rep: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return orders;
  }

  @Get('today')
  async getTodayOrders(@Query('status') status?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      createdAt: { gte: today, lt: tomorrow },
    };
    if (status) where.status = status;

    const orders = await this.prisma.order.findMany({
      where,
      include: { rep: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return orders;
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { rep: { select: { id: true, name: true } } },
    });
  }

  @Patch(':id')
  async updateOrder(
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.prisma.order.update({
      where: { id },
      data: { status: body.status },
    });
  }
}
