import {
  Controller,
  BadRequestException,
  Get,
  Headers,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ReportingService } from './reporting.service';

function verifyReportingToken(receivedHeader?: string) {
  const configured = process.env.PASALO_REPORTING_API_TOKEN || process.env.PASALO_INTEGRATION_SECRET;
  if (!configured) {
    throw new ServiceUnavailableException('PASALO reporting authentication is not configured.');
  }
  const received = (receivedHeader ?? '').replace(/^Bearer\s+/i, '');
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(configured);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new UnauthorizedException('Invalid PASALO reporting token.');
  }
}

@Controller('reporting')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('daily-summary')
  async dailySummary(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    verifyReportingToken(authorization);
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      throw new BadRequestException('Invalid reporting date range.');
    }
    return this.reporting.getDailySummary(start, end);
  }
}
