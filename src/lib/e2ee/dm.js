import { chatsApi } from '@/api/chats.api';
import { cryptoApi } from '@/api/crypto.api';
import { cachePeerKey, getCachedPeerKey } from '@/lib/e2ee/vault';

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function normalizePeer(raw) {
  if (!raw) return null;
  const userId = pick(raw, 'userId', 'user_id');
  const publicKey = pick(raw, 'publicKey', 'public_key');
  if (!userId || !publicKey) return null;
  return {
    userId,
    publicKey,
    algorithm: pick(raw, 'algorithm') || 'x25519-aes256gcm-v1',
    keyVersion: pick(raw, 'keyVersion', 'key_version') || 1,
  };
}

/**
 * Resolve the other participant's public key for a Direct chat.
 * Uses chat E2EE metadata, then per-user public key, then cache.
 */
export async function resolveDirectPeerPublicKey(chatId, myUserId, peerUserIdHint) {
  if (peerUserIdHint) {
    const cached = getCachedPeerKey(peerUserIdHint);
    if (cached?.publicKey) {
      return {
        userId: peerUserIdHint,
        publicKey: cached.publicKey,
        keyVersion: cached.keyVersion || 1,
      };
    }
  }

  try {
    const info = await chatsApi.e2ee(chatId);
    const peers = Array.isArray(info?.peers) ? info.peers.map(normalizePeer).filter(Boolean) : [];
    for (const peer of peers) {
      cachePeerKey(peer.userId, peer.publicKey, peer.keyVersion || 1);
    }
    const other = peers.find((p) => p.userId !== myUserId);
    if (other?.publicKey) return other;
    if (peers.length === 1 && peers[0].publicKey) return peers[0];
  } catch {
    // Fall through to per-user public key.
  }

  const peerId =
    peerUserIdHint ||
    null;
  if (peerId && peerId !== myUserId) {
    const pub = await cryptoApi.publicKey(peerId);
    if (pub?.publicKey) {
      cachePeerKey(pub.userId, pub.publicKey, pub.keyVersion || 1);
      return pub;
    }
  }

  throw new Error(
    'Не удалось получить ключ шифрования собеседника. Попросите его один раз войти в CRM и обновите чат.',
  );
}
