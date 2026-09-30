import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, phone: true, fullName: true, email: true, status: true, lastLoginAt: true, createdAt: true },
    });
    if (!customer) throw new AppError(ErrorCodes.CUSTOMER_AUTH_REQUIRED, 'Customer not found.', 401);
    return customer;
  }

  async updateMe(customerId: string, dto: UpdateCustomerDto) {
    await this.getMe(customerId);
    return this.prisma.customer.update({
      where: { id: customerId },
      data: dto,
      select: { id: true, phone: true, fullName: true, email: true, status: true },
    });
  }

  listAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createAddress(customerId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.customerAddress.count({ where: { customerId, deletedAt: null } });
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.create({ data: { ...dto, customerId, isDefault: makeDefault } });
    });
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId, deletedAt: null },
      });
      if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Address not found.', 404);

      if (dto.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: { customerId, deletedAt: null, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }
      const updated = await tx.customerAddress.update({ where: { id: addressId }, data: dto });

      if (existing.isDefault && dto.isDefault === false) {
        const fallback = await tx.customerAddress.findFirst({
          where: { customerId, deletedAt: null, id: { not: addressId } },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });
        if (fallback) await tx.customerAddress.update({ where: { id: fallback.id }, data: { isDefault: true } });
      }
      return updated;
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId, deletedAt: null },
      });
      if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Address not found.', 404);

      await tx.customerAddress.update({
        where: { id: addressId },
        data: { deletedAt: new Date(), isDefault: false },
      });
      if (existing.isDefault) {
        const fallback = await tx.customerAddress.findFirst({
          where: { customerId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });
        if (fallback) await tx.customerAddress.update({ where: { id: fallback.id }, data: { isDefault: true } });
      }
      return { deleted: true };
    });
  }
}
