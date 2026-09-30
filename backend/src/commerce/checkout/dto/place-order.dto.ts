import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';

export class PlaceOrderDto {
  @IsUUID()
  cartToken: string;

  @IsUUID()
  addressId: string;

  @IsIn(['COD'])
  paymentMethod: 'COD';

  @IsString()
  @MinLength(20)
  checkoutToken: string;
}
