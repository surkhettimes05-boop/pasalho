import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @RequirePermissions('branches.view')
  @ApiOperation({ summary: 'List branches' })
  list(@Query() pagination: PaginationDto) {
    return this.branchService.list(pagination);
  }

  @Get(':id')
  @RequirePermissions('branches.view')
  @ApiOperation({ summary: 'Get branch' })
  findOne(@Param('id') id: string) {
    return this.branchService.findById(id);
  }

  @Post()
  @RequirePermissions('branches.create')
  @ApiOperation({ summary: 'Create branch' })
  create(@Body() dto: CreateBranchDto, @CurrentUser() actor: User) {
    return this.branchService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('branches.update')
  @ApiOperation({ summary: 'Update branch' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() actor: User) {
    return this.branchService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermissions('branches.update')
  @ApiOperation({ summary: 'Deactivate branch' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.branchService.deactivate(id, actor.id);
  }
}
