import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentEntity } from '../students/entities/student.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { UserEntity } from '../users/entities/user.entity';
import { CHAT_ENTITIES } from './entities';
import { AI_PROVIDER } from './ai/ai-provider.interface';
import { ChatAiService } from './ai/chat-ai.service';
import { OpenAiProvider } from './ai/openai-ai.provider';
import { UnavailableAiProvider } from './ai/unavailable-ai.provider';
import { ChatsController } from './controllers/chats.controller';
import { CryptoController } from './controllers/crypto.controller';
import { SubjectsController } from './controllers/subjects.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { ChatAttachmentsService } from './services/chat-attachments.service';
import { ChatDirectoryService } from './services/chat-directory.service';
import { ChatMembershipSyncService } from './services/chat-membership-sync.service';
import { ChatMessagesService } from './services/chat-messages.service';
import { ChatPresenceService } from './services/chat-presence.service';
import { ChatsService } from './services/chats.service';
import { DirectChatRequestService } from './services/direct-chat-request.service';
import { ChatDmRequestJobsService } from './services/chat-dm-request-jobs.service';
import { UserCryptoService } from './services/user-crypto.service';

const aiModuleLogger = new Logger('ChatsAiModule');

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...CHAT_ENTITIES,
      UserEntity,
      StudentEntity,
      CourseTemplateEntity,
    ]),
    AuthModule,
    NotificationsModule,
    TelegramModule,
  ],
  controllers: [ChatsController, CryptoController, SubjectsController],
  providers: [
    ChatPresenceService,
    ChatMembershipSyncService,
    ChatsService,
    ChatMessagesService,
    ChatAttachmentsService,
    ChatDirectoryService,
    DirectChatRequestService,
    ChatDmRequestJobsService,
    UserCryptoService,
    ChatGateway,
    ChatAiService,
    OpenAiProvider,
    UnavailableAiProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, OpenAiProvider, UnavailableAiProvider],
      useFactory: (
        config: ConfigService,
        openai: OpenAiProvider,
        unavailable: UnavailableAiProvider,
      ) => {
        const configured = Boolean(config.get<string>('ai.openaiApiKey')?.trim());
        const model = config.get<string>('ai.openaiModel') || 'gpt-4o-mini';
        const baseUrl =
          config.get<string>('ai.openaiBaseUrl') || 'https://api.openai.com/v1';
        if (configured) {
          aiModuleLogger.log(
            `AI provider=openai model=${model} baseUrl=${baseUrl.replace(/\/$/, '')}`,
          );
          return openai;
        }
        aiModuleLogger.warn(
          'AI provider=unavailable — OPENAI_API_KEY / AI_API_KEY is not set',
        );
        return unavailable;
      },
    },
  ],
  exports: [ChatMembershipSyncService, ChatsService, ChatPresenceService, DirectChatRequestService, UserCryptoService],
})
export class ChatsModule {}
