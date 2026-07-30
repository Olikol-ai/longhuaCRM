import { SubjectEntity } from './subject.entity';
import { UserSubjectEntity } from './user-subject.entity';
import { CourseSubjectEntity } from './course-subject.entity';
import { UserChatProfileEntity } from './user-chat-profile.entity';
import { ChatEntity } from './chat.entity';
import { ChatMemberEntity } from './chat-member.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { ChatAttachmentEntity } from './chat-attachment.entity';
import { ChatVoiceMessageEntity } from './chat-voice-message.entity';
import { ChatDirectPairEntity } from './chat-direct-pair.entity';
import { ChatReadReceiptEntity } from './chat-read-receipt.entity';
import { ChatPinnedMessageEntity } from './chat-pinned-message.entity';
import { ChatMessageReactionEntity } from './chat-message-reaction.entity';
import { AiConversationEntity } from './ai-conversation.entity';
import { AiConversationTurnEntity } from './ai-conversation-turn.entity';
import { DirectChatRequestEntity } from './direct-chat-request.entity';
import { UserPrivacySettingsEntity } from './user-privacy-settings.entity';
import { UserBlockEntity } from './user-block.entity';
import { UserCryptoEntity } from './user-crypto.entity';

export const CHAT_ENTITIES = [
  SubjectEntity,
  UserSubjectEntity,
  CourseSubjectEntity,
  UserChatProfileEntity,
  ChatEntity,
  ChatMemberEntity,
  ChatMessageEntity,
  ChatAttachmentEntity,
  ChatVoiceMessageEntity,
  ChatDirectPairEntity,
  ChatReadReceiptEntity,
  ChatPinnedMessageEntity,
  ChatMessageReactionEntity,
  AiConversationEntity,
  AiConversationTurnEntity,
  DirectChatRequestEntity,
  UserPrivacySettingsEntity,
  UserBlockEntity,
  UserCryptoEntity,
] as const;

export {
  SubjectEntity,
  UserSubjectEntity,
  CourseSubjectEntity,
  UserChatProfileEntity,
  ChatEntity,
  ChatMemberEntity,
  ChatMessageEntity,
  ChatAttachmentEntity,
  ChatVoiceMessageEntity,
  ChatDirectPairEntity,
  ChatReadReceiptEntity,
  ChatPinnedMessageEntity,
  ChatMessageReactionEntity,
  AiConversationEntity,
  AiConversationTurnEntity,
  DirectChatRequestEntity,
  UserPrivacySettingsEntity,
  UserBlockEntity,
  UserCryptoEntity,
};
