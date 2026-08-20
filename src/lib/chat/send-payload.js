import { resolveDirectPeerPublicKey } from '@/lib/e2ee/dm';
import { encryptDirectMessage } from '@/lib/e2ee/message';
import { getMyKeyVersion, getMyPrivateKey } from '@/lib/e2ee/vault';

export async function buildChatTextPayload({
  chat,
  userId,
  text,
  replyToMessageId,
}) {
  if (chat?.kind !== 'direct') {
    const payload = { body: text };
    if (replyToMessageId) payload.replyToMessageId = replyToMessageId;
    return payload;
  }
  const peerHint = (chat.memberUserIds || chat.member_user_ids || []).find(
    (id) => id && id !== userId,
  );
  const peer = await resolveDirectPeerPublicKey(chat.id, userId, peerHint);
  const payload = await encryptDirectMessage({
    plaintext: text,
    myPrivateKey: getMyPrivateKey(),
    peerPublicKeyB64: peer.publicKey,
    chatId: chat.id,
    keyVersion: getMyKeyVersion(),
  });
  if (replyToMessageId) payload.replyToMessageId = replyToMessageId;
  return payload;
}
