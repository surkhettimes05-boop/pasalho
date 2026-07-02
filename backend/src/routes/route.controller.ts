import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RouteService } from './route.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('routes')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Get()
  @RequirePermissions('routes.view')
  @ApiOperation({ summary: 'List routes' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'salesRepId', required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('salesRepId') salesRepId?: string,
  ) {
    return this.routeService.list(pagination, branchId, salesRepId);
  }

  @Get(':id')
  @RequirePermissions('routes.view')
  @ApiOperation({ summary: 'Get route by ID' })
  findById(@Param('id') id: string) {
    return this.routeService.findById(id);
  }

  @Post()
  @RequirePermissions('routes.manage')
  @ApiOperation({ summary: 'Create route' })
  create(@Body() dto: CreateRouteDto, @CurrentUser() actor: User) {
    return this.routeService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('routes.manage')
  @ApiOperation({ summary: 'Update route' })
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto, @CurrentUser() actor: User) {
    return this.routeService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermissions('routes.manage')
  @ApiOperation({ summary: 'Deactivate route' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.routeService.deactivate(id, actor.id);
  }
}
