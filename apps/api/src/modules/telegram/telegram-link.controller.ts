import { Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { TelegramLinkService } from './telegram-link.service';

@Controller('telegram')
@UseGuards(JwtAuthGuard)
export class TelegramLinkController {
  constructor(private readonly linkService: TelegramLinkService) {}

  @Post('link/create')
  createLink(@CurrentUser() user: JwtPayload) {
    return this.linkService.createLink(user.sub);
  }

  @Get('status')
  status(@CurrentUser() user: JwtPayload) {
    return this.linkService.getStatus(user.sub);
  }

  @Delete('link')
  unlink(@CurrentUser() user: JwtPayload) {
    return this.linkService.unlink(user.sub);
  }

  /** Alias for clients that prefer POST unlink. */
  @Post('unlink')
  unlinkPost(@CurrentUser() user: JwtPayload) {
    return this.linkService.unlink(user.sub);
  }
}
