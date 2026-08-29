import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { lessonVideoPath } from '@/lib/lesson-video';
import { videoDiag, videoDiagWarn } from '@/lib/video-diagnostics';
import { setVideoSessionBlocksReload } from '@/lib/pwa/reloadGate';

/**
 * Global video-lesson session — lives across CRM routes.
 * Jitsi stays mounted until the user explicitly ends the call.
 */

const VideoSessionContext = createContext(null);

const MINI_STORAGE_KEY = 'lh-crm-video-mini-pos';
const CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

/** Adaptive PiP size: ~16:9, capped for phones and large desktops. */
export function computeMiniSize(vw = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  const w = Math.min(360, Math.max(240, Math.round(vw * (vw < 640 ? 0.72 : 0.22))));
  const h = Math.round((w * 9) / 16);
  return { w, h };
}

const MINI_SIZE = computeMiniSize(1280);

function clampMiniPos(pos, size = computeMiniSize()) {
  if (typeof window === 'undefined') {
    return { x: 24, y: 24, corner: pos?.corner || 'bottom-right' };
  }
  const gap = 16;
  const bottomSafe = 72;
  const maxX = Math.max(gap, window.innerWidth - size.w - gap);
  const maxY = Math.max(gap, window.innerHeight - size.h - bottomSafe);
  return {
    x: Math.min(maxX, Math.max(gap, Number(pos?.x) || gap)),
    y: Math.min(maxY, Math.max(gap, Number(pos?.y) || gap)),
    corner: CORNERS.includes(pos?.corner) ? pos.corner : null,
  };
}

function cornerCoords(corner, size = computeMiniSize()) {
  const gap = 24;
  const bottomSafe = 72;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let x = gap;
  let y = gap;
  if (String(corner).includes('right')) x = Math.max(gap, vw - size.w - gap);
  if (String(corner).includes('bottom')) y = Math.max(gap, vh - size.h - bottomSafe);
  return { x, y, corner };
}

function defaultMiniPos() {
  const size = computeMiniSize();
  return clampMiniPos(cornerCoords('bottom-right', size), size);
}

function loadMiniPos() {
  if (typeof window === 'undefined') return defaultMiniPos();
  try {
    const raw = window.localStorage.getItem(MINI_STORAGE_KEY);
    if (!raw) return defaultMiniPos();
    const parsed = JSON.parse(raw);
    const size = computeMiniSize();
    if (parsed?.corner && CORNERS.includes(parsed.corner)) {
      return clampMiniPos(cornerCoords(parsed.corner, size), size);
    }
    return clampMiniPos(parsed, size);
  } catch {
    return defaultMiniPos();
  }
}

function saveMiniPos(pos) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      MINI_STORAGE_KEY,
      JSON.stringify({
        x: pos.x,
        y: pos.y,
        corner: pos.corner || null,
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function VideoSessionProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const jitsiRef = useRef(null);
  const [session, setSession] = useState(null);
  /** @type {'idle'|'full'|'mini'|'pip'} — `pip` = Document Picture-in-Picture window */
  const [mode, setMode] = useState('idle');
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [linkQuality, setLinkQuality] = useState('unknown');
  const [participantCount, setParticipantCount] = useState(null);
  const [livePresence, setLivePresence] = useState([]);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatToast, setChatToast] = useState(null);
  const [railTab, setRailTab] = useState('chat');
  const [desktopRailOpen, setDesktopRailOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shareBarPinned, setShareBarPinned] = useState(false);
  const [miniPos, setMiniPosState] = useState(loadMiniPos);
  const [miniPinned, setMiniPinned] = useState(() => Boolean(loadMiniPos().corner));
  const [miniSize, setMiniSize] = useState(() => computeMiniSize());
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveAction, setLeaveAction] = useState(null);
  const [reconnectRestoredFlash, setReconnectRestoredFlash] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  const prevConnectionRef = useRef('idle');
  const suppressAutoMiniRef = useRef(false);

  const setMiniPos = useCallback((next) => {
    setMiniPosState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      const size = computeMiniSize();
      const clamped = clampMiniPos(value, size);
      saveMiniPos(clamped);
      return clamped;
    });
  }, []);

  const active = Boolean(session?.lessonId && session?.jwt);
  const lessonId = session?.lessonId || null;

  useEffect(() => {
    setVideoSessionBlocksReload(active);
    return () => setVideoSessionBlocksReload(false);
  }, [active]);

  const isOnLessonVideoRoute = useMemo(() => {
    if (!lessonId) return false;
    const path = lessonVideoPath(lessonId);
    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  }, [location.pathname, lessonId]);

  // Leaving the full lesson route while in a call → mini/fallback (keep WebRTC).
  // Document PiP (`pip`) is entered explicitly — do not downgrade it here.
  useEffect(() => {
    if (!active || mode !== 'full') return;
    if (suppressAutoMiniRef.current) return;
    if (!isOnLessonVideoRoute) {
      setMode('mini');
    }
  }, [active, mode, isOnLessonVideoRoute]);

  // Expanding: if user opens the lesson route while mini, restore full shell.
  // Document PiP stays until the user returns / closes the floating window.
  useEffect(() => {
    if (!active || mode !== 'mini') return;
    if (isOnLessonVideoRoute) {
      setMode('full');
    }
  }, [active, mode, isOnLessonVideoRoute]);

  useEffect(() => {
    const prev = prevConnectionRef.current;
    prevConnectionRef.current = connectionStatus;
    if (prev === 'reconnecting' && connectionStatus === 'connected') {
      setReconnectRestoredFlash(true);
      const t = window.setTimeout(() => setReconnectRestoredFlash(false), 3500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [connectionStatus]);

  // Warn on tab close while in a live conference (browser native dialog).
  useEffect(() => {
    if (!active) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  // Keep PiP size/position inside the viewport (no overlap of CRM chrome).
  useEffect(() => {
    const sync = () => {
      const size = computeMiniSize();
      setMiniSize(size);
      setMiniPosState((prev) => {
        const next =
          prev.corner && CORNERS.includes(prev.corner)
            ? clampMiniPos(cornerCoords(prev.corner, size), size)
            : clampMiniPos(prev, size);
        saveMiniPos(next);
        return next;
      });
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const executeCommand = useCallback((command, ...args) => {
    try {
      jitsiRef.current?.executeCommand?.(command, ...args);
    } catch {
      // ignore
    }
  }, []);

  const resize = useCallback(() => {
    jitsiRef.current?.resize?.();
  }, []);

  /**
   * Start or replace a live conference session (Jitsi mounts in VideoSessionLayer).
   */
  const startSession = useCallback((payload) => {
    if (!payload?.lessonId || !payload?.jwt) return;
    const expiresAt =
      payload.tokenExpiresAt ??
      payload.token_expires_at ??
      payload.access?.token_expires_at ??
      null;
    videoDiag('session_start', {
      lessonId: String(payload.lessonId),
      tokenExpiresAt: expiresAt,
      domain: payload.domain || null,
    });
    setSession({
      lessonId: String(payload.lessonId),
      jwt: payload.jwt,
      tokenExpiresAt: expiresAt != null ? Number(expiresAt) : null,
      domain: payload.domain,
      roomName: payload.roomName,
      roomUrl: payload.roomUrl || null,
      displayName: payload.displayName || 'Участник',
      subject: payload.subject || null,
      externalApiUrl: payload.externalApiUrl || null,
      access: payload.access || null,
      isHost: Boolean(payload.isHost),
      isStudent: Boolean(payload.isStudent),
      viewerRole: payload.viewerRole || null,
      materialsPath: payload.materialsPath || null,
      homeworkPath: payload.homeworkPath || null,
      backPath: payload.backPath || '/',
      crmUserId: payload.crmUserId || null,
      crmEmail: payload.crmEmail || null,
    });
    setAudioMuted(false);
    setVideoMuted(false);
    setScreenSharing(false);
    setConnectionStatus('connecting');
    setLinkQuality('unknown');
    setParticipantCount(null);
    setLivePresence([]);
    setAudioUnlockNeeded(false);
    setChatUnread(0);
    setChatToast(null);
    setRailTab('chat');
    setDesktopRailOpen(true);
    setMode('full');
    setEmbedKey((k) => k + 1);
  }, []);

  /**
   * Refresh JWT in the background. Does NOT remount the iframe — External API
   * cannot swap JWT mid-call. Fresh token is kept for emergency remount only.
   */
  const refreshSessionToken = useCallback(
    async ({ remount = false } = {}) => {
      const id = session?.lessonId;
      if (!id) return null;
      try {
        const res = await api.video.refreshToken(id);
        const token = res?.token;
        const expiresAt = res?.token_expires_at ?? res?.tokenExpiresAt ?? null;
        if (!token) {
          videoDiagWarn('jwt_refresh_empty', { lessonId: id });
          return null;
        }
        videoDiag('jwt_refreshed', {
          lessonId: id,
          tokenExpiresAt: expiresAt,
          remount,
        });
        setSession((prev) =>
          prev
            ? {
                ...prev,
                jwt: token,
                tokenExpiresAt:
                  expiresAt != null ? Number(expiresAt) : prev.tokenExpiresAt,
                access: res || prev.access,
              }
            : prev,
        );
        if (remount) {
          videoDiagWarn('jwt_remount', {
            lessonId: id,
            reason: 'fatal_auth_or_expiry',
          });
          setEmbedKey((k) => k + 1);
        }
        return token;
      } catch (err) {
        videoDiagWarn('jwt_refresh_failed', {
          lessonId: id,
          message: err?.message || String(err),
        });
        return null;
      }
    },
    [session?.lessonId],
  );

  // Proactively refresh JWT well before expiry (buffer for emergency remount).
  useEffect(() => {
    if (!active || !session?.lessonId) return undefined;
    const expiresAt = Number(session.tokenExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      const hourly = window.setInterval(() => {
        refreshSessionToken({ remount: false });
      }, 60 * 60 * 1000);
      return () => window.clearInterval(hourly);
    }
    const msUntilRefresh = Math.max(
      30_000,
      expiresAt * 1000 - Date.now() - 10 * 60 * 1000,
    );
    const timer = window.setTimeout(() => {
      refreshSessionToken({ remount: false });
    }, msUntilRefresh);
    return () => window.clearTimeout(timer);
  }, [active, session?.lessonId, session?.tokenExpiresAt, refreshSessionToken]);

  const endSession = useCallback(() => {
    videoDiag('session_end', { lessonId: session?.lessonId || null });
    try {
      jitsiRef.current?.executeCommand?.('hangup');
    } catch {
      // ignore
    }
    try {
      jitsiRef.current?.dispose?.();
    } catch {
      // ignore
    }
    setSession(null);
    setMode('idle');
    setAudioMuted(false);
    setVideoMuted(false);
    setScreenSharing(false);
    setConnectionStatus('idle');
    setLinkQuality('unknown');
    setParticipantCount(null);
    setLivePresence([]);
    setAudioUnlockNeeded(false);
    setChatUnread(0);
    setChatToast(null);
    setLeaveOpen(false);
    setLeaveAction(null);
    setSheetOpen(false);
    setEmbedKey((k) => k + 1);
  }, [session?.lessonId]);

  const minimize = useCallback((navigateTo) => {
    if (!active) return;
    setMode((prev) => (prev === 'pip' ? 'pip' : 'mini'));
    setSheetOpen(false);
    if (navigateTo) {
      suppressAutoMiniRef.current = true;
      navigate(navigateTo);
      window.setTimeout(() => {
        suppressAutoMiniRef.current = false;
      }, 0);
    }
  }, [active, navigate]);

  /** Enter Document Picture-in-Picture presentation mode (Jitsi stays mounted). */
  const enterPipMode = useCallback((navigateTo) => {
    if (!active) return;
    setMode('pip');
    setSheetOpen(false);
    if (navigateTo) {
      suppressAutoMiniRef.current = true;
      navigate(navigateTo);
      window.setTimeout(() => {
        suppressAutoMiniRef.current = false;
      }, 0);
    }
  }, [active, navigate]);

  /** Leave Document PiP presentation without ending the conference. */
  const exitPipMode = useCallback((nextMode = 'mini') => {
    if (!active) return;
    setMode(nextMode === 'full' ? 'full' : 'mini');
  }, [active]);

  const expand = useCallback(() => {
    if (!active || !lessonId) return;
    suppressAutoMiniRef.current = true;
    setMode('full');
    setSheetOpen(false);
    navigate(lessonVideoPath(lessonId));
    window.setTimeout(() => {
      suppressAutoMiniRef.current = false;
      resize();
    }, 50);
  }, [active, lessonId, navigate, resize]);

  const requestEnd = useCallback((onConfirm) => {
    if (!active) {
      onConfirm?.();
      return;
    }
    setLeaveAction(() => onConfirm || endSession);
    setLeaveOpen(true);
  }, [active, endSession]);

  const confirmLeave = useCallback(() => {
    setLeaveOpen(false);
    const action = leaveAction;
    setLeaveAction(null);
    if (typeof action === 'function') action();
    else endSession();
  }, [leaveAction, endSession]);

  const pinMiniCorner = useCallback((corner) => {
    const c = CORNERS.includes(corner) ? corner : 'bottom-right';
    const size = computeMiniSize();
    setMiniSize(size);
    const next = clampMiniPos(cornerCoords(c, size), size);
    setMiniPosState(next);
    saveMiniPos(next);
    setMiniPinned(true);
  }, []);

  const value = useMemo(
    () => ({
      active,
      session,
      mode,
      jitsiRef,
      embedKey,
      audioMuted,
      videoMuted,
      screenSharing,
      connectionStatus,
      linkQuality,
      participantCount,
      livePresence,
      audioUnlockNeeded,
      chatUnread,
      chatToast,
      railTab,
      desktopRailOpen,
      sheetOpen,
      shareBarPinned,
      miniPos,
      miniPinned,
      miniSize,
      leaveOpen,
      reconnectRestoredFlash,
      setAudioMuted,
      setVideoMuted,
      setScreenSharing,
      setConnectionStatus,
      setLinkQuality,
      setParticipantCount,
      setLivePresence,
      setAudioUnlockNeeded,
      setChatUnread,
      setChatToast,
      setRailTab,
      setDesktopRailOpen,
      setSheetOpen,
      setShareBarPinned,
      setMiniPos,
      setMiniPinned,
      setLeaveOpen,
      startSession,
      endSession,
      refreshSessionToken,
      minimize,
      enterPipMode,
      exitPipMode,
      expand,
      requestEnd,
      confirmLeave,
      executeCommand,
      resize,
      pinMiniCorner,
    }),
    [
      active,
      session,
      mode,
      embedKey,
      audioMuted,
      videoMuted,
      screenSharing,
      connectionStatus,
      linkQuality,
      participantCount,
      livePresence,
      audioUnlockNeeded,
      chatUnread,
      chatToast,
      railTab,
      desktopRailOpen,
      sheetOpen,
      shareBarPinned,
      miniPos,
      miniPinned,
      miniSize,
      leaveOpen,
      reconnectRestoredFlash,
      setMiniPos,
      startSession,
      endSession,
      refreshSessionToken,
      minimize,
      enterPipMode,
      exitPipMode,
      expand,
      requestEnd,
      confirmLeave,
      executeCommand,
      resize,
      pinMiniCorner,
    ],
  );

  return (
    <VideoSessionContext.Provider value={value}>
      {children}
    </VideoSessionContext.Provider>
  );
}

export function useVideoSession() {
  const ctx = useContext(VideoSessionContext);
  if (!ctx) {
    throw new Error('useVideoSession must be used within VideoSessionProvider');
  }
  return ctx;
}

/** Safe hook when provider may be absent (public routes). */
export function useVideoSessionOptional() {
  return useContext(VideoSessionContext);
}

export { MINI_SIZE, CORNERS, MINI_STORAGE_KEY };
