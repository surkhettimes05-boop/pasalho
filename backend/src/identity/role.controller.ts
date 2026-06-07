import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RolePermissionDto {
  @ApiProperty()
  @IsUUID()
  permissionId: string;
}

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'List roles' })
  list() {
    return this.roleService.listRoles();
  }

  @Post()
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Create role' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.createRole(dto);
  }

  @Get('permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'List permissions' })
  listPermissions() {
    return this.roleService.listPermissions();
  }

  @Post(':roleId/permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Add permission to role' })
  addPermission(@Param('roleId') roleId: string, @Body() dto: RolePermissionDto) {
    return this.roleService.addPermissionToRole(roleId, dto.permissionId);
  }

  @Delete(':roleId/permissions/:permissionId')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Remove permission from role' })
  removePermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return this.roleService.removePermissionFromRole(roleId, permissionId);
  }
}
