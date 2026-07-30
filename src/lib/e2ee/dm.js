import { chatsApi } from '@/api/chats.api';
import { cachePeerKey } from '@/lib/e2ee/vault';

/**
 * Resolve the other participant's public key for a Direct chat.
 */
export async function resolveDirectPeerPublicKey(chatId, myUserId) {
  const info = await chatsApi.e2ee(chatId);
  const peers = Array.isArray(info?.peers) ? info.peers : [];
  for (const peer of peers) {
    if (peer?.userId && peer?.publicKey) {
      cachePeerKey(peer.userId, peer.publicKey, peer.keyVersion || 1);
    }
  }
  const other = peers.find((p) => p?.userId && p.userId !== myUserId && p.publicKey);
  if (other) return other;
  const any = peers.find((p) => p?.publicKey);
  if (any) return any;
  throw new Error('Не удалось получить ключ собеседника');
}
