import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MailService } from './mail.service';

class DebugMailDto {
  @IsEmail()
  @IsString()
  email: string;
}

@Controller('debug/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DebugMailController {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async sendTest(@Body() dto: DebugMailDto) {
    if (this.config.get<string>('nodeEnv') === 'production') {
      return { ok: false, message: 'Debug mail is disabled in production' };
    }
    return this.mail.sendTestEmail(dto.email.trim());
  }
}
