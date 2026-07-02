import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller('reps')
export class RepsController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async createRep(@Body() body: { name: string }) {
    return this.prisma.rep.create({
      data: { name: body.name },
    });
  }

  @Get()
  async getReps() {
    return this.prisma.rep.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  async getRep(@Param('id') id: string) {
    return this.prisma.rep.findUnique({ where: { id } });
  }
}
