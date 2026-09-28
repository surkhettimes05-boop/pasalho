import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { SalesOrderService } from "./sales-order.service";
import { CreateSalesOrderDto } from "./dto/create-sales-order.dto";
import { ConvertToInvoiceDto } from "./dto/convert-to-invoice.dto";
import { PublicCheckoutDto } from "./dto/public-checkout.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { ScopeGuard } from "../auth/scope.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { RequireScope } from "../auth/decorators/require-scope.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";

@ApiTags("sales-orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@Controller("sales-orders")
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  private assertCommerceIntegration(secret: string | undefined) {
    const expected = process.env.PASALO_INTEGRATION_SECRET;
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException("Commerce integration is not configured.");
      }
      return;
    }
    const provided = secret?.replace(/^Bearer\s+/i, "") ?? "";
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(provided, "utf8");
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException("Unauthorized commerce integration request.");
    }
  }

  @Post("public/checkout")
  @Public()
  @ApiOperation({ summary: "Create public storefront order (Guest COD)" })
  publicCheckout(
    @Body() dto: PublicCheckoutDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("authorization") authorization?: string,
  ) {
    this.assertCommerceIntegration(authorization);
    return this.salesOrderService.createPublicOrder(dto, idempotencyKey);
  }

  @Get("public/:id")
  @Public()
  @ApiOperation({ summary: "Read a storefront order for commerce synchronization" })
  publicStatus(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    this.assertCommerceIntegration(authorization);
    return this.salesOrderService.findById(id);
  }

  @Post("public/:id/cancel")
  @Public()
  @ApiOperation({ summary: "Cancel a storefront order from commerce" })
  publicCancel(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    this.assertCommerceIntegration(authorization);
    return this.salesOrderService.cancelPublicOrder(
      id,
      "99999999-9999-4999-a999-999999999999",
    );
  }

  @Get()
  @RequirePermissions("sales-orders.view")
  @RequireScope("branch")
  @ApiOperation({ summary: "List sales orders" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "salesRepId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "source", required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query("branchId") branchId?: string,
    @Query("salesRepId") salesRepId?: string,
    @Query("status") status?: string,
    @Query("source") source?: string,
  ) {
    return this.salesOrderService.list(
      pagination,
      branchId,
      salesRepId,
      status,
      source,
    );
  }

  @Get(":id")
  @RequirePermissions("sales-orders.view")
  @RequireScope("order")
  @ApiOperation({ summary: "Get sales order by ID" })
  findById(@Param("id") id: string) {
    return this.salesOrderService.findById(id);
  }

  @Post()
  @RequirePermissions("sales-orders.create")
  @RequireScope("branch")
  @ApiOperation({ summary: "Create sales order" })
  create(
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() actor: User,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.salesOrderService.create(
      dto,
      actor.id,
      idempotencyKey ?? dto.idempotencyKey,
    );
  }

  @Post(":id/confirm")
  @RequirePermissions("sales-orders.create")
  @RequireScope("order")
  @ApiOperation({ summary: "Confirm sales order" })
  confirm(@Param("id") id: string, @CurrentUser() actor: User) {
    return this.salesOrderService.confirm(id, actor.id);
  }

  @Post(":id/cancel")
  @RequirePermissions("sales-orders.create")
  @RequireScope("order")
  @ApiOperation({ summary: "Cancel sales order" })
  cancel(@Param("id") id: string, @CurrentUser() actor: User) {
    return this.salesOrderService.cancel(id, actor.id);
  }

  @Post(":id/status")
  @RequirePermissions("sales-orders.create")
  @RequireScope("order")
  @ApiOperation({
    summary: "Update storefront order status (PACKED or DELIVERED)",
  })
  updateStatus(
    @Param("id") id: string,
    @Body("status") status: "PACKED" | "DELIVERED",
    @CurrentUser() actor: User,
  ) {
    return this.salesOrderService.updateStatus(id, status, actor.id);
  }

  @Post(":id/convert-to-invoice")
  @RequirePermissions("invoices.create")
  @RequireScope("order")
  @ApiOperation({ summary: "Convert confirmed order to invoice" })
  convertToInvoice(
    @Param("id") id: string,
    @Body() dto: ConvertToInvoiceDto,
    @CurrentUser() actor: User,
  ) {
    return this.salesOrderService.convertToInvoice(id, dto, actor.id);
  }
}
