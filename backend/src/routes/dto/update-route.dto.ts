import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { RouteStatus } from '@prisma/client';
import { CreateRouteDto } from './create-route.dto';

export class UpdateRouteDto extends PartialType(CreateRouteDto) {
  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;
}
