import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WhatsAppOrderService } from './whatsapp-order.service';
import { WhatsAppOrderDto } from './dto/whatsapp-order.dto';

@ApiTags('retailer-portal/whatsapp')
@Controller('retailer-portal/whatsapp')
export class WhatsAppOrderController {
  constructor(private readonly whatsappService: WhatsAppOrderService) {}

  @Post('incoming')
  @ApiOperation({ summary: 'Process incoming WhatsApp order message' })
  incoming(@Body() dto: WhatsAppOrderDto) {
    return this.whatsappService.processWhatsAppMessage(dto.retailerPhone, dto.message);
  }
}
