import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller('sessions')
export class SessionsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getSessions() {
    return this.prisma.session.findMany({
      include: { rep: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.prisma.session.findUnique({
      where: { id },
      include: { rep: { select: { name: true } }, orders: true },
    });
  }
}
