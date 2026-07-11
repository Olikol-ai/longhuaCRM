import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { MailService } from './mail.service';

class DebugMailDto {
  @IsEmail()
  @IsString()
  email: string;
}

@Controller('debug/mail')
export class DebugMailController {
  constructor(private readonly mail: MailService) {}

  @Post()
  async sendTest(@Body() dto: DebugMailDto) {
    return this.mail.sendTestEmail(dto.email.trim());
  }
}
