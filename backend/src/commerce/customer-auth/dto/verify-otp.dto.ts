import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID()
  challengeId: string;

  @IsString()
  @Matches(/^(?:(?:\+?977)?9\d{9})$/, { message: 'phone must be a valid Nepal mobile number' })
  phone: string;

  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}
