import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResolveServiceabilityDto } from './dto/resolve-serviceability.dto';
import { ServiceabilityService } from './serviceability.service';

@ApiTags('commerce-serviceability')
@Controller('commerce/serviceability')
export class ServiceabilityController {
  constructor(private readonly serviceability: ServiceabilityService) {}

  @Post('resolve')
  @ApiOperation({ summary: 'Resolve customer coordinates to a Pasalho fulfillment store' })
  resolve(@Body() dto: ResolveServiceabilityDto) {
    return this.serviceability.resolve(dto);
  }
}
