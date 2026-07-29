import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CHAT_ENTITIES } from './entities';
import { AI_PROVIDER } from './ai/ai-provider.interface';
import { ChatAiService } from './ai/chat-ai.service';
import { MockAiProvider } from './ai/mock-ai.provider';
import { OpenAiProvider } from './ai/openai-ai.provider';
import { ChatsController } from './controllers/chats.controller';
import { SubjectsController } from './controllers/subjects.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { ChatAttachmentsService } from './services/chat-attachments.service';
import { ChatDirectoryService } from './services/chat-directory.service';
import { ChatMembershipSyncService } from './services/chat-membership-sync.service';
import { ChatMessagesService } from './services/chat-messages.service';
import { ChatsService } from './services/chats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...CHAT_ENTITIES,
      UserEntity,
      StudentEntity,
      CourseTemplateEntity,
    ]),
    AuthModule,
  ],
  controllers: [ChatsController, SubjectsController],
  providers: [
    ChatMembershipSyncService,
    ChatsService,
    ChatMessagesService,
    ChatAttachmentsService,
    ChatDirectoryService,
    ChatGateway,
    ChatAiService,
    MockAiProvider,
    OpenAiProvider,
    { provide: AI_PROVIDER, useExisting: MockAiProvider },
  ],
  exports: [ChatMembershipSyncService, ChatsService],
})
export class ChatsModule {}
