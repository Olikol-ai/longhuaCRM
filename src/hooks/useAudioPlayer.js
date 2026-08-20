import { useCallback, useEffect, useRef, useState } from 'react';
import {
  claimLearningAudio,
  releaseLearningAudio,
} from '@/lib/learning-audio-runtime';
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEEDS,
  SEEK_NUDGE_SECONDS,
  clampSeekSeconds,
  commitSeekToMedia,
  isFiniteDuration,
  previewSeekRatio,
  seekRatioFromClientX,
} from '@/lib/audio/audioPlayerUtils';

function defaultSpeedIndex(rates) {
  const idx = rates.indexOf(DEFAULT_PLAYBACK_SPEED);
  return idx >= 0 ? idx : 0;
}

/**
 * Shared HTMLMediaElement controller for LonghuaAudioPlayer.
 * Seek is queued until metadata, drag only previews UI, commit on pointer up.
 */
export function useAudioPlayer({ src, playbackRates = PLAYBACK_SPEEDS } = {}) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const pendingSeekRef = useRef(null);
  const rafRef = useRef(null);
  const lastVolumeRef = useRef(1);

  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(() => defaultSpeedIndex(playbackRates));
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const speed = playbackRates[speedIndex] ?? DEFAULT_PLAYBACK_SPEED;

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const syncFromElement = useCallback(() => {
    const el = audioRef.current;
    if (!el || draggingRef.current) return;
    const dur = el.duration;
    if (isFiniteDuration(dur)) {
      setDurationSec(dur);
      setProgress(dur ? el.currentTime / dur : 0);
      setReady(true);
    }
    setCurrentSec(el.currentTime || 0);
  }, []);

  const startRaf = useCallback(() => {
    stopRaf();
    const tick = () => {
      syncFromElement();
      const el = audioRef.current;
      if (el && !el.paused && !el.ended) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf, syncFromElement]);

  const applyPendingIfPossible = useCallback(() => {
    const el = audioRef.current;
    if (!el || pendingSeekRef.current == null) return;
    const result = commitSeekToMedia(el, pendingSeekRef.current);
    if (result.applied) {
      pendingSeekRef.current = null;
      setCurrentSec(result.currentTime);
      if (isFiniteDuration(el.duration)) {
        setProgress(el.duration ? result.currentTime / el.duration : 0);
        setDurationSec(el.duration);
      }
    }
  }, []);

  const commitSeek = useCallback((seconds) => {
    const el = audioRef.current;
    if (!el) return;
    const result = commitSeekToMedia(el, seconds);
    setEnded(false);
    if (!result.applied) {
      pendingSeekRef.current = result.pending;
      const dur = isFiniteDuration(el.duration) ? el.duration : durationSec;
      if (isFiniteDuration(dur) && dur > 0) {
        setProgress(result.pending / dur);
      }
      setCurrentSec(result.pending);
      return;
    }
    pendingSeekRef.current = null;
    setCurrentSec(result.currentTime);
    if (isFiniteDuration(el.duration)) {
      setProgress(el.duration ? result.currentTime / el.duration : 0);
      setDurationSec(el.duration);
    }
  }, [durationSec]);

  const previewRatio = useCallback((ratio) => {
    const dur = isFiniteDuration(audioRef.current?.duration)
      ? audioRef.current.duration
      : durationSec;
    const preview = previewSeekRatio(ratio, dur);
    setProgress(preview.ratio);
    if (preview.seconds || isFiniteDuration(dur)) {
      setCurrentSec(preview.seconds);
    }
    pendingSeekRef.current = isFiniteDuration(dur) ? preview.seconds : pendingSeekRef.current;
  }, [durationSec]);

  useEffect(() => {
    setFailed(false);
    setReady(false);
    setPlaying(false);
    setProgress(0);
    setCurrentSec(0);
    setDurationSec(0);
    setBuffering(false);
    setEnded(false);
    pendingSeekRef.current = null;
    draggingRef.current = false;
    stopRaf();
  }, [src, retryToken, stopRaf]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed, src, retryToken]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = muted ? 0 : volume;
    el.muted = muted;
  }, [volume, muted, src, retryToken]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return undefined;

    const onLoaded = () => {
      setFailed(false);
      if (isFiniteDuration(el.duration)) {
        setDurationSec(el.duration);
        setReady(true);
      }
      applyPendingIfPossible();
      syncFromElement();
    };
    const onWaiting = () => setBuffering(true);
    const onPlayingEv = () => {
      setBuffering(false);
      setPlaying(true);
      setEnded(false);
      startRaf();
    };
    const onPlay = () => {
      claimLearningAudio(el);
      setPlaying(true);
      setEnded(false);
      startRaf();
    };
    const onPause = () => {
      setPlaying(false);
      stopRaf();
      syncFromElement();
    };
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      stopRaf();
      if (isFiniteDuration(el.duration)) {
        setProgress(1);
        setCurrentSec(el.duration);
      }
    };
    const onSeeked = () => {
      applyPendingIfPossible();
      if (!draggingRef.current) syncFromElement();
    };
    const onError = () => {
      setFailed(true);
      setReady(false);
      setPlaying(false);
      stopRaf();
    };

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('durationchange', onLoaded);
    el.addEventListener('canplay', onLoaded);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('playing', onPlayingEv);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('error', onError);

    if (el.readyState >= 1) onLoaded();

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('durationchange', onLoaded);
      el.removeEventListener('canplay', onLoaded);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('playing', onPlayingEv);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('error', onError);
    };
  }, [src, retryToken, applyPendingIfPossible, syncFromElement, startRaf, stopRaf]);

  useEffect(() => {
    return () => {
      stopRaf();
      releaseLearningAudio(audioRef.current);
    };
  }, [stopRaf]);

  const toggle = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !src || failed) return;
    try {
      if (el.paused) {
        applyPendingIfPossible();
        claimLearningAudio(el);
        await el.play();
      } else {
        el.pause();
      }
    } catch {
      setFailed(true);
    }
  }, [src, failed, applyPendingIfPossible]);

  const seekTo = useCallback(
    (seconds) => {
      commitSeek(seconds);
    },
    [commitSeek],
  );

  const seekByRatio = useCallback(
    (ratio) => {
      const dur = isFiniteDuration(audioRef.current?.duration)
        ? audioRef.current.duration
        : durationSec;
      const preview = previewSeekRatio(ratio, dur);
      commitSeek(preview.seconds);
    },
    [commitSeek, durationSec],
  );

  const nudge = useCallback(
    (deltaSec = SEEK_NUDGE_SECONDS) => {
      const el = audioRef.current;
      const dur = isFiniteDuration(el?.duration) ? el.duration : durationSec;
      const from = draggingRef.current ? currentSec : el?.currentTime || currentSec;
      commitSeek(clampSeekSeconds(from + deltaSec, dur));
    },
    [commitSeek, currentSec, durationSec],
  );

  const onTrackPointerDown = useCallback(
    (event) => {
      if (event.button != null && event.button !== 0) return;
      const track = trackRef.current;
      if (!track || !src) return;
      event.preventDefault();
      event.stopPropagation();
      draggingRef.current = true;
      track.setPointerCapture?.(event.pointerId);
      previewRatio(seekRatioFromClientX(track, event.clientX));
    },
    [previewRatio, src],
  );

  const onTrackPointerMove = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      event.preventDefault();
      previewRatio(seekRatioFromClientX(trackRef.current, event.clientX));
    },
    [previewRatio],
  );

  const endDrag = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        trackRef.current?.releasePointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }
      if (pendingSeekRef.current != null) {
        commitSeek(pendingSeekRef.current);
        return;
      }
      const ratio = seekRatioFromClientX(trackRef.current, event.clientX);
      seekByRatio(ratio);
    },
    [commitSeek, seekByRatio],
  );

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((index) => (index + 1) % playbackRates.length);
  }, [playbackRates.length]);

  const setVolume = useCallback((next) => {
    const v = Math.min(1, Math.max(0, Number(next) || 0));
    lastVolumeRef.current = v || lastVolumeRef.current;
    setVolumeState(v);
    if (v > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((was) => {
      if (was) {
        setVolumeState(lastVolumeRef.current || 1);
        return false;
      }
      lastVolumeRef.current = volume || lastVolumeRef.current || 1;
      return true;
    });
  }, [volume]);

  const retry = useCallback(() => {
    setFailed(false);
    setReady(false);
    setRetryToken((n) => n + 1);
  }, []);

  return {
    audioRef,
    trackRef,
    src,
    retryToken,
    playing,
    ready,
    failed,
    buffering,
    ended,
    progress,
    currentSec,
    durationSec,
    speed,
    volume,
    muted,
    toggle,
    seekTo,
    seekByRatio,
    nudge,
    onTrackPointerDown,
    onTrackPointerMove,
    endDrag,
    cycleSpeed,
    setVolume,
    toggleMute,
    retry,
    SEEK_NUDGE_SECONDS,
  };
}
