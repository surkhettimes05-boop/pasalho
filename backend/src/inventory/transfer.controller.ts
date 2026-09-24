import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { StockTransferService } from "./services/stock-transfer.service";
import { CreateStockTransferDto } from "./dto/create-stock-transfer.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { ScopeGuard } from "../auth/scope.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { RequireScope } from "../auth/decorators/require-scope.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "@prisma/client";

@ApiTags("stock-transfers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller("inventory/transfers")
export class TransferController {
  constructor(private readonly transferService: StockTransferService) {}

  @Get()
  @RequirePermissions("inventory.view")
  @RequireScope("branch")
  @ApiOperation({ summary: "List stock transfers" })
  @ApiQuery({ name: "branchId", required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.transferService.list(pagination, branchId);
  }

  @Get(":id")
  @RequirePermissions("inventory.view")
  @RequireScope("transfer")
  @ApiOperation({ summary: "Get stock transfer by ID" })
  findById(@Param("id") id: string) {
    return this.transferService.findById(id);
  }

  @Post()
  @RequirePermissions("inventory.transfer.create")
  @RequireScope("transfer")
  @ApiOperation({ summary: "Create stock transfer draft" })
  create(
    @Body() dto: CreateStockTransferDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() actor: User,
  ) {
    return this.transferService.create(dto, actor.id, idempotencyKey);
  }

  @Post(":id/confirm")
  @RequirePermissions("inventory.transfer.ship")
  @RequireScope("transfer")
  @ApiOperation({ summary: "Confirm stock transfer" })
  confirm(@Param("id") id: string, @CurrentUser() actor: User) {
    return this.transferService.confirm(id, actor.id);
  }

  @Post(":id/dispatch")
  @RequirePermissions("inventory.transfer.ship")
  @RequireScope("transfer")
  @ApiOperation({
    summary: "Dispatch transfer (deduct from origin, mark in-transit)",
  })
  dispatch(
    @Param("id") id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() actor: User,
  ) {
    return this.transferService.dispatch(id, actor.id, idempotencyKey);
  }

  @Post(":id/ship")
  @RequirePermissions("inventory.transfer.ship")
  @RequireScope("transfer")
  @ApiOperation({ summary: "Compatibility alias for dispatch" })
  ship(
    @Param("id") id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() actor: User,
  ) {
    return this.transferService.dispatch(id, actor.id, idempotencyKey);
  }

  @Post(":id/receive")
  @RequirePermissions("inventory.transfer.receive")
  @RequireScope("transfer")
  @ApiOperation({
    summary: "Receive transfer (add to destination, clear in-transit)",
  })
  receive(
    @Param("id") id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() actor: User,
  ) {
    return this.transferService.receive(id, actor.id, idempotencyKey);
  }

  @Post(":id/retry-store-sync")
  @RequirePermissions("inventory.transfer.receive")
  @RequireScope("transfer")
  @ApiOperation({ summary: "Retry a pending store synchronization webhook" })
  retryStoreSync(@Param("id") id: string, @CurrentUser() actor: User) {
    return this.transferService.retryStoreSync(id, actor.id);
  }
}
