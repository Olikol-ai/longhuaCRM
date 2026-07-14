import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { getClientIp } from '../../common/security/client-ip';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService, JwtPayload } from './auth.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendRegistrationDto } from './dto/resend-registration.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, getClientIp(req));
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, getClientIp(req));
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, getClientIp(req));
  }

  @Post('verify-registration')
  verifyRegistration(@Body() dto: VerifyRegistrationDto, @Req() req: Request) {
    return this.authService.verifyRegistration(dto.email, dto.code, getClientIp(req));
  }

  @Post('resend-registration-code')
  resendRegistrationCode(@Body() dto: ResendRegistrationDto) {
    return this.authService.resendRegistrationCode(dto.email);
  }

  /** @deprecated Legacy endpoint for users created before PendingRegistration */
  @Post('verify-code')
  @UseGuards(JwtAuthGuard)
  verifyCodeLegacy(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyCodeDto,
    @Req() req: Request,
  ) {
    return this.authService.verifyCode(user.sub, dto.code, getClientIp(req));
  }

  /** @deprecated Legacy endpoint for users created before PendingRegistration */
  @Post('resend-code')
  @UseGuards(JwtAuthGuard)
  resendCodeLegacy(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerificationCode(user.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user.sub, dto);
  }

  @Get('public-settings')
  publicSettings() {
    return {
      id: 'longhua-crm',
      public_settings: { auth_required: true },
    };
  }
}
