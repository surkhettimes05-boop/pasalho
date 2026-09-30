import { IsString, MinLength } from 'class-validator';

export class RefreshCustomerTokenDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
