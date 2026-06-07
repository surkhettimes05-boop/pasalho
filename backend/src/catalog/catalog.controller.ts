import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ── Categories ───────────────────────────────────────────────────────────────

  @Get('categories')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'List categories' })
  listCategories(@Query() pagination: PaginationDto) {
    return this.catalogService.listCategories(pagination);
  }

  @Post('categories')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Create category' })
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() actor: User) {
    return this.catalogService.createCategory(dto, actor.id);
  }

  // ── Brands ───────────────────────────────────────────────────────────────────

  @Get('brands')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'List brands' })
  listBrands(@Query() pagination: PaginationDto) {
    return this.catalogService.listBrands(pagination);
  }

  @Post('brands')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Create brand' })
  createBrand(@Body() dto: CreateBrandDto, @CurrentUser() actor: User) {
    return this.catalogService.createBrand(dto, actor.id);
  }

  // ── Units ─────────────────────────────────────────────────────────────────────

  @Get('units')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'List units' })
  listUnits(@Query() pagination: PaginationDto) {
    return this.catalogService.listUnits(pagination);
  }

  @Post('units')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Create unit' })
  createUnit(@Body() dto: CreateUnitDto, @CurrentUser() actor: User) {
    return this.catalogService.createUnit(dto, actor.id);
  }

  // ── Products ──────────────────────────────────────────────────────────────────

  @Get('products')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'List products' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'brandId', required: false })
  listProducts(
    @Query() pagination: PaginationDto,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.catalogService.listProducts(pagination, categoryId, brandId);
  }

  @Post('products')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Create product' })
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() actor: User) {
    return this.catalogService.createProduct(dto, actor.id);
  }

  @Get('products/:id')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'Get product by ID' })
  findProduct(@Param('id') id: string) {
    return this.catalogService.findProductById(id);
  }

  @Patch('products/:id')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Update product' })
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: User,
  ) {
    return this.catalogService.updateProduct(id, dto, actor.id);
  }

  // ── Batches ───────────────────────────────────────────────────────────────────

  @Get('batches')
  @RequirePermissions('batches.view')
  @ApiOperation({ summary: 'List batches' })
  @ApiQuery({ name: 'productId', required: false })
  listBatches(
    @Query() pagination: PaginationDto,
    @Query('productId') productId?: string,
  ) {
    return this.catalogService.listBatches(pagination, productId);
  }

  @Post('batches')
  @RequirePermissions('batches.create')
  @ApiOperation({ summary: 'Create batch' })
  createBatch(@Body() dto: CreateBatchDto, @CurrentUser() actor: User) {
    return this.catalogService.createBatch(dto, actor.id);
  }

  @Get('batches/:id')
  @RequirePermissions('batches.view')
  @ApiOperation({ summary: 'Get batch by ID' })
  findBatch(@Param('id') id: string) {
    return this.catalogService.findBatchById(id);
  }

  @Patch('batches/:id')
  @RequirePermissions('batches.create')
  @ApiOperation({ summary: 'Update batch' })
  updateBatch(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUser() actor: User,
  ) {
    return this.catalogService.updateBatch(id, dto, actor.id);
  }

  // ── Barcode lookup ────────────────────────────────────────────────────────────

  @Get('barcodes/:barcode')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'Look up product by barcode' })
  lookupBarcode(@Param('barcode') barcode: string) {
    return this.catalogService.lookupBarcode(barcode);
  }
}
