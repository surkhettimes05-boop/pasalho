import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^(?:(?:\+?977)?9\d{9})$/, { message: 'phone must be a valid Nepal mobile number' })
  phone: string;
}
