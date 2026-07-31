import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UserEntity } from '../users/entities/user.entity';
import { CHAT_ENTITIES } from './entities';
import { ChatMembershipModule } from './chat-membership.module';
import { ChatsController } from './controllers/chats.controller';
import { CryptoController } from './controllers/crypto.controller';
import { SubjectsController } from './controllers/subjects.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { ChatAttachmentsService } from './services/chat-attachments.service';
import { ChatDirectoryService } from './services/chat-directory.service';
import { ChatMessagesService } from './services/chat-messages.service';
import { ChatPresenceService } from './services/chat-presence.service';
import { ChatsService } from './services/chats.service';
import { DirectChatRequestService } from './services/direct-chat-request.service';
import { ChatDmRequestJobsService } from './services/chat-dm-request-jobs.service';
import { SubjectsService } from './services/subjects.service';
import { UserCryptoService } from './services/user-crypto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([...CHAT_ENTITIES, UserEntity]),
    ChatMembershipModule,
    AuthModule,
    NotificationsModule,
    TelegramModule,
  ],
  controllers: [ChatsController, CryptoController, SubjectsController],
  providers: [
    ChatPresenceService,
    SubjectsService,
    ChatsService,
    ChatMessagesService,
    ChatAttachmentsService,
    ChatDirectoryService,
    DirectChatRequestService,
    ChatDmRequestJobsService,
    UserCryptoService,
    ChatGateway,
  ],
  exports: [
    ChatMembershipModule,
    SubjectsService,
    ChatsService,
    ChatPresenceService,
    DirectChatRequestService,
    UserCryptoService,
  ],
})
export class ChatsModule {}
