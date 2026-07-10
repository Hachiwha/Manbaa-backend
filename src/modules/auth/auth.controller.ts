import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { AuthService } from './auth.service';
import { EmailTokenDto, ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResendEmailDto, ResetPasswordDto } from './dto/auth.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('register') register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.meta(req));
  }

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200) @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) { return this.auth.login(dto, this.meta(req)); }

  @Public() @HttpCode(200) @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }
  @Public() @HttpCode(204) @Post('logout') logout(@Body() dto: RefreshDto) { return this.auth.logout(dto.refreshToken); }
  @HttpCode(204) @Post('logout-all') logoutAll(@CurrentUser() user: { id: string }) { return this.auth.logoutAll(user.id); }
  @Get('me') me(@CurrentUser() user: { id: string }) { return this.auth.me(user.id); }

  // Enumeration-safe recovery foundation; delivery adapters can subscribe to the audit/domain event.
  @Public() @Throttle({ default: { limit: 3, ttl: 60_000 } }) @HttpCode(202) @Post('password/forgot')
  forgot(@Body() dto: ForgotPasswordDto) { return this.auth.requestPasswordReset(dto.email); }
  @Public() @HttpCode(200) @Post('password/reset') reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto.token, dto.password); }
  @Public() @HttpCode(200) @Post('email/verify') verify(@Body() dto: EmailTokenDto) { return this.auth.verifyEmail(dto.token); }
  @Public() @HttpCode(202) @Post('email/resend') resend(@Body() dto: ResendEmailDto) { return this.auth.resendVerification(dto.email); }

  private meta(req: Request) {
    return { ipAddress: req.ip, userAgent: req.get('user-agent') };
  }
}
