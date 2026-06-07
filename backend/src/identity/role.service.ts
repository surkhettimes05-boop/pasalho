import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createRole(dto: CreateRoleDto) {
    return this.prisma.role.create({ data: dto });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  async addPermissionToRole(roleId: string, permissionId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(ErrorCodes.NOT_FOUND, 'Role not found.', 404);
    return this.prisma.rolePermission.create({ data: { roleId, permissionId } });
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    await this.prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId, permissionId } } });
  }
}
