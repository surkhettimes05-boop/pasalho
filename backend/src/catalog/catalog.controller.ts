import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
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
import { Public } from '../auth/decorators/public.decorator';
import { cloudinaryStorage } from '../config/cloudinary.config';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ── Categories ───────────────────────────────────────────────────────────────

  @Get('categories')
  @Public()
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
  @Public()
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
  @Public()
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

  @Post('upload')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Upload product image' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: cloudinaryStorage,
    }),
  )
  uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    // multer-storage-cloudinary provides the URL in file.path
    return { imageUrl: file.path };
  }

  @Get('products/:id')
  @Public()
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

  @Delete('products/:id')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Delete product' })
  deleteProduct(
    @Param('id') id: string,
    @CurrentUser() actor: User,
  ) {
    return this.catalogService.deleteProduct(id, actor.id);
  }

  @Patch('products/:id/stock')
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Adjust product stock' })
  adjustStock(
    @Param('id') id: string,
    @Body('delta') delta: number,
    @CurrentUser() actor: User,
  ) {
    return this.catalogService.adjustStock(id, delta, actor.id);
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
  @Public()
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'Look up product by barcode' })
  lookupBarcode(@Param('barcode') barcode: string) {
    return this.catalogService.lookupBarcode(barcode);
  }
}
