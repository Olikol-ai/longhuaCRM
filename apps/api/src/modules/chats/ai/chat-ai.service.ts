import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AiConversationEntity,
  AiConversationTurnEntity,
  ChatEntity,
  ChatMessageEntity,
} from '../entities';
import { ChatKind } from '../enums/chat.enums';
import { ChatMessagesService } from '../services/chat-messages.service';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';

@Injectable()
export class ChatAiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly messages: ChatMessagesService,
    private readonly access: ChatAccessService,
    @InjectRepository(ChatEntity)
    private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(AiConversationEntity)
    private readonly conversationRepo: Repository<AiConversationEntity>,
    @InjectRepository(AiConversationTurnEntity)
    private readonly turnRepo: Repository<AiConversationTurnEntity>,
  ) {}

  complete(prompt: string): Promise<string> {
    return this.provider.complete(prompt);
  }

  /**
   * Explicit one-shot explanation — never reads DM history from the server.
   * Client sends already-decrypted text after user consent.
   */
  async explainEphemeral(
    _actor: DomainAccessActor,
    text: string,
  ): Promise<{ reply: string }> {
    const trimmed = text?.trim();
    if (!trimmed) throw new BadRequestException('text is required');
    const reply = await this.provider.complete(
      `Кратко объясни или перефразируй следующее сообщение пользователю на русском:\n\n${trimmed}`,
    );
    return { reply };
  }

  async ask(
    actor: DomainAccessActor,
    chatId: string,
    prompt: string,
  ): Promise<{ userMessage: ChatMessageEntity; aiMessage: ChatMessageEntity }> {
    const chat = await this.access.assertCanWrite(actor, chatId);
    if (chat.kind === ChatKind.Direct) {
      throw new ForbiddenException(
        'Longhua AI не имеет доступа к личной переписке. Используйте «Объяснить через AI» для выбранного сообщения.',
      );
    }

    const userMessage = await this.messages.createText(actor, chatId, prompt);
    const reply = await this.provider.complete(prompt);
    const aiMessage = await this.messages.createAiResponse(chatId, reply);

    let conversation = await this.conversationRepo.findOne({
      where: { chatId, userId: actor.sub },
      order: { createdAt: 'DESC' },
    });
    if (!conversation) {
      conversation = await this.conversationRepo.save({
        chatId,
        userId: actor.sub,
        provider: 'mock',
      });
    }

    await this.turnRepo.save([
      {
        conversationId: conversation.id,
        role: 'user',
        messageId: userMessage.id,
        content: prompt,
      },
      {
        conversationId: conversation.id,
        role: 'assistant',
        messageId: aiMessage.id,
        content: reply,
      },
    ]);

    return { userMessage, aiMessage };
  }
}
