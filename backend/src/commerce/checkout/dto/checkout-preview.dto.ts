import { IsIn, IsUUID } from 'class-validator';

export class CheckoutPreviewDto {
  @IsUUID()
  cartToken: string;

  @IsUUID()
  addressId: string;

  @IsIn(['COD'])
  paymentMethod: 'COD';
}
