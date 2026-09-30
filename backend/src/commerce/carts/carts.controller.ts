import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartsService } from './carts.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('commerce-carts')
@Controller('commerce/carts')
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an anonymous server cart' })
  create(@Body() dto: CreateCartDto) {
    return this.carts.create(dto);
  }

  @Get(':cartToken')
  get(@Param('cartToken') cartToken: string) {
    return this.carts.get(cartToken);
  }

  @Post(':cartToken/items')
  addItem(
    @Param('cartToken') cartToken: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.carts.addItem(cartToken, dto);
  }

  @Patch(':cartToken/items/:itemId')
  updateItem(
    @Param('cartToken') cartToken: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.carts.updateItem(cartToken, itemId, dto);
  }

  @Delete(':cartToken/items/:itemId')
  removeItem(
    @Param('cartToken') cartToken: string,
    @Param('itemId') itemId: string,
  ) {
    return this.carts.removeItem(cartToken, itemId);
  }

  @Post(':cartToken/revalidate')
  revalidate(@Param('cartToken') cartToken: string) {
    return this.carts.revalidate(cartToken);
  }
}
