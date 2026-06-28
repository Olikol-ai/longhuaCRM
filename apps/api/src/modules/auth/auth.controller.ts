import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { getClientIp } from '../../common/security/client-ip';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, getClientIp(req));
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, getClientIp(req));
  }

  @Post('verify-code')
  @UseGuards(JwtAuthGuard)
  verifyCode(@CurrentUser() user: JwtPayload, @Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(user.sub, dto.code);
  }

  @Post('resend-code')
  @UseGuards(JwtAuthGuard)
  resendCode(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerificationCode(user.sub);
  }

  @Post('telegram-link')
  @UseGuards(JwtAuthGuard)
  createTelegramLink(@CurrentUser() user: JwtPayload) {
    return this.authService.createTelegramLinkToken(user.sub);
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
