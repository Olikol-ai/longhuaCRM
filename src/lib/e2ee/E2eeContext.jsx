import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import {
  createAndWrapIdentity,
  unwrapPrivateKey,
  publicKeyToBase64,
  rewrapPrivateKeyWithNewPassword,
  rewrapWrappedPrivateKey,
  E2EE_KDF_ITERATIONS,
} from '@/lib/e2ee/keys.js';
import {
  clearPeerCache,
  getE2eeStatus,
  getMyKeyVersion,
  getMyPrivateKey,
  getMyPublicKeyB64,
  isE2eeReady,
  lockE2eeVault,
  setE2eeLockedFromServer,
  setE2eeMissing,
  setE2eeReady,
} from '@/lib/e2ee/vault.js';

const E2eeContext = createContext(null);

export function E2eeProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState(getE2eeStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refreshStatus = useCallback(() => {
    setStatus(getE2eeStatus());
  }, []);

  const loadServerState = useCallback(async () => {
    if (!isAuthenticated) {
      setE2eeMissing();
      clearPeerCache();
      refreshStatus();
      return null;
    }
    try {
      const me = await api.crypto.me();
      if (!me?.configured) {
        setE2eeMissing();
      } else if (!isE2eeReady()) {
        setE2eeLockedFromServer({
          publicKeyB64: me.publicKey,
          keyVersion: me.keyVersion,
        });
      }
      refreshStatus();
      return me;
    } catch {
      refreshStatus();
      return null;
    }
  }, [isAuthenticated, refreshStatus]);

  useEffect(() => {
    void loadServerState();
  }, [loadServerState, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      lockE2eeVault();
      setE2eeMissing();
      clearPeerCache();
      refreshStatus();
    }
  }, [isAuthenticated, refreshStatus]);

  const setupWithPassword = useCallback(
    async (password) => {
      setBusy(true);
      setError(null);
      try {
        const identity = await createAndWrapIdentity(password);
        await api.crypto.upsertMe({
          publicKey: identity.publicKeyB64,
          wrappedPrivateKey: identity.wrappedPrivateKey,
          wrapSalt: identity.wrapSalt,
          wrapIv: identity.wrapIv,
          algorithm: identity.algorithm,
          kdf: identity.kdf,
          kdfIterations: identity.kdfIterations,
          keyVersion: identity.keyVersion,
        });
        setE2eeReady({
          privateKey: identity.privateKey,
          publicKeyB64: identity.publicKeyB64,
          keyVersion: identity.keyVersion,
        });
        refreshStatus();
        return true;
      } catch (err) {
        setError(err?.message || 'Не удалось создать ключи шифрования');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshStatus],
  );

  const unlockWithPassword = useCallback(
    async (password) => {
      setBusy(true);
      setError(null);
      try {
        let me = await api.crypto.me();
        if (!me?.configured) {
          setBusy(false);
          return setupWithPassword(password);
        }
        if (me.needsActivation || me.kdf === 'server-hold-v1') {
          me = await api.crypto.activateMe(password);
        }
        const privateKey = await unwrapPrivateKey(
          me.wrappedPrivateKey,
          me.wrapSalt,
          me.wrapIv,
          password,
          me.kdfIterations,
        );
        setE2eeReady({
          privateKey,
          publicKeyB64: me.publicKey,
          keyVersion: me.keyVersion,
        });
        refreshStatus();
        return true;
      } catch (err) {
        setError(err?.message || 'Не удалось разблокировать ключ');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshStatus, setupWithPassword],
  );

  /**
   * Keep the same identity key; re-wrap private material with the new password.
   * Call this before Auth change-password so unlock still works.
   */
  const rewrapWithNewPassword = useCallback(
    async (oldPassword, newPassword) => {
      if (!oldPassword || !newPassword) {
        throw new Error('Не удалось обновить ключ шифрования');
      }
      const me = await api.crypto.me();
      if (!me?.configured || me.needsActivation || me.kdf === 'server-hold-v1') {
        return { ok: true, skipped: true };
      }
      const previousWrap = {
        publicKey: me.publicKey,
        wrappedPrivateKey: me.wrappedPrivateKey,
        wrapSalt: me.wrapSalt,
        wrapIv: me.wrapIv,
        algorithm: me.algorithm,
        kdf: me.kdf,
        kdfIterations: me.kdfIterations || E2EE_KDF_ITERATIONS,
        keyVersion: me.keyVersion || 1,
      };

      let privateKey = getMyPrivateKey();
      let wrapped;
      try {
        if (privateKey) {
          wrapped = await rewrapPrivateKeyWithNewPassword(
            privateKey,
            newPassword,
            previousWrap.kdfIterations,
          );
        } else {
          const restored = await rewrapWrappedPrivateKey({
            wrappedPrivateKey: me.wrappedPrivateKey,
            wrapSalt: me.wrapSalt,
            wrapIv: me.wrapIv,
            oldPassword,
            newPassword,
            iterations: previousWrap.kdfIterations,
          });
          privateKey = restored.privateKey;
          wrapped = restored;
        }
        await api.crypto.upsertMe({
          publicKey: me.publicKey,
          wrappedPrivateKey: wrapped.wrappedPrivateKey,
          wrapSalt: wrapped.wrapSalt,
          wrapIv: wrapped.wrapIv,
          algorithm: wrapped.algorithm,
          kdf: wrapped.kdf,
          kdfIterations: wrapped.kdfIterations,
          keyVersion: previousWrap.keyVersion,
        });
        setE2eeReady({
          privateKey,
          publicKeyB64: getMyPublicKeyB64() || me.publicKey,
          keyVersion: getMyKeyVersion() || previousWrap.keyVersion,
        });
        refreshStatus();
        return {
          ok: true,
          skipped: false,
          rollback: async () => {
            await api.crypto.upsertMe(previousWrap);
          },
        };
      } catch (err) {
        const message =
          err?.message?.includes('парол') || err?.message?.includes('ключ')
            ? err.message
            : 'Не удалось обновить ключ шифрования личных чатов. Разблокируйте чаты текущим паролем и повторите смену пароля.';
        throw new Error(message);
      }
    },
    [refreshStatus],
  );

  const value = useMemo(
    () => ({
      status,
      busy,
      error,
      ready: status === 'ready',
      locked: status === 'locked',
      missing: status === 'missing',
      unlockWithPassword,
      setupWithPassword,
      rewrapWithNewPassword,
      reload: loadServerState,
      publicKeyToBase64,
    }),
    [status, busy, error, unlockWithPassword, setupWithPassword, rewrapWithNewPassword, loadServerState],
  );

  return <E2eeContext.Provider value={value}>{children}</E2eeContext.Provider>;
}

export function useE2ee() {
  const ctx = useContext(E2eeContext);
  if (!ctx) throw new Error('useE2ee must be used within E2eeProvider');
  return ctx;
}
