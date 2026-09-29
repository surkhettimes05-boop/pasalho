import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListStoreQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
