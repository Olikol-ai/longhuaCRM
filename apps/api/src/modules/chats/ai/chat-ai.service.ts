import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { AiConversationEntity, AiConversationTurnEntity, ChatMessageEntity } from '../entities';
import { ChatMessageType } from '../enums/chat.enums';
import { ChatMessagesService } from '../services/chat-messages.service';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';

@Injectable()
export class ChatAiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly messages: ChatMessagesService,
    @InjectRepository(AiConversationEntity)
    private readonly conversationRepo: Repository<AiConversationEntity>,
    @InjectRepository(AiConversationTurnEntity)
    private readonly turnRepo: Repository<AiConversationTurnEntity>,
  ) {}

  complete(prompt: string): Promise<string> {
    return this.provider.complete(prompt);
  }

  async ask(
    actor: DomainAccessActor,
    chatId: string,
    prompt: string,
  ): Promise<{ userMessage: ChatMessageEntity; aiMessage: ChatMessageEntity }> {
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
