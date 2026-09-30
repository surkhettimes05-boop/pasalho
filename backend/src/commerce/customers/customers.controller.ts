import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../customer-auth/customer-jwt.guard';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('commerce-customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('commerce/me')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get current customer profile' })
  me(@CurrentCustomer() principal: { customerId: string }) {
    return this.customers.getMe(principal.customerId);
  }

  @Patch()
  updateMe(@CurrentCustomer() principal: { customerId: string }, @Body() dto: UpdateCustomerDto) {
    return this.customers.updateMe(principal.customerId, dto);
  }

  @Get('addresses')
  listAddresses(@CurrentCustomer() principal: { customerId: string }) {
    return this.customers.listAddresses(principal.customerId);
  }

  @Post('addresses')
  createAddress(@CurrentCustomer() principal: { customerId: string }, @Body() dto: CreateAddressDto) {
    return this.customers.createAddress(principal.customerId, dto);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @CurrentCustomer() principal: { customerId: string },
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customers.updateAddress(principal.customerId, addressId, dto);
  }

  @Delete('addresses/:addressId')
  deleteAddress(
    @CurrentCustomer() principal: { customerId: string },
    @Param('addressId') addressId: string,
  ) {
    return this.customers.deleteAddress(principal.customerId, addressId);
  }
}
