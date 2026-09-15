import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_IDLE_MS = 5000;

/**
 * Video-call chrome idle visibility.
 *
 * activity → show → reset timer → idleMs of quiet → hide.
 * Keeps the panel mounted; only toggles visibility.
 * Cleans timers + listeners on unmount / when disabled.
 */
export function useVideoControlsIdle({
  enabled = true,
  idleMs = DEFAULT_IDLE_MS,
  /** While true, controls stay visible (popover/dialog open, etc.). */
  holdOpen = false,
} = {}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);
  const holdOpenRef = useRef(holdOpen);
  holdOpenRef.current = holdOpen;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimer();
    if (!enabled) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (holdOpenRef.current) return;
      setVisible(false);
    }, idleMs);
  }, [clearTimer, enabled, idleMs]);

  const bump = useCallback(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }
    setVisible(true);
    if (holdOpenRef.current) {
      clearTimer();
      return;
    }
    scheduleHide();
  }, [clearTimer, enabled, scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setVisible(true);
      return undefined;
    }
    bump();
    return () => {
      clearTimer();
    };
  }, [enabled, bump, clearTimer]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (holdOpen) {
      setVisible(true);
      clearTimer();
      return undefined;
    }
    scheduleHide();
    return undefined;
  }, [holdOpen, enabled, clearTimer, scheduleHide]);

  return {
    controlsVisible: visible,
    bumpControls: bump,
    showControls: useCallback(() => {
      setVisible(true);
      if (!holdOpenRef.current) scheduleHide();
    }, [scheduleHide]),
  };
}
