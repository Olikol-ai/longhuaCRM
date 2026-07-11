import { Global, Module } from '@nestjs/common';
import { DebugMailController } from './debug-mail.controller';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [DebugMailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
