import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(12) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class RefreshDto { @IsString() refreshToken: string; }
export class ForgotPasswordDto { @IsEmail() email: string; }
export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(12) password: string;
}
export class EmailTokenDto { @IsString() token: string; }
export class ResendEmailDto { @IsEmail() email: string; }
