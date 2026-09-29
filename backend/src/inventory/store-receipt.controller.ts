import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { timingSafeEqual } from "crypto";
import { AcknowledgeStoreReceiptDto } from "./dto/acknowledge-store-receipt.dto";
import { StockTransferService } from "./services/stock-transfer.service";

@ApiTags("store-receipt-integration")
@Controller("integrations/store-receipts")
export class StoreReceiptController {
  constructor(private readonly transfers: StockTransferService) {}

  @Post(":id")
  @ApiOperation({ summary: "Acknowledge a physical store receipt from CEO Dashboard" })
  acknowledge(
    @Param("id") id: string,
    @Body() dto: AcknowledgeStoreReceiptDto,
    @Headers("x-pasalo-webhook-secret") receivedSecret: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    const configuredSecret = process.env.STORE_SYNC_WEBHOOK_SECRET;
    if (!configuredSecret) {
      throw new ServiceUnavailableException("Store receipt integration authentication is not configured.");
    }
    const received = Buffer.from(receivedSecret ?? "");
    const expected = Buffer.from(configuredSecret);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException("Invalid store receipt integration secret.");
    }
    return this.transfers.acknowledgeStoreReceipt(id, dto, idempotencyKey);
  }
}
