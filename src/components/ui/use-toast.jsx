// Inspired by react-hot-toast library
import { useState, useEffect } from "react";

const TOAST_LIMIT = 20;
/** How long a toast stays visible before auto-dismiss (ms). */
const TOAST_DURATION = 10_000;
/** Delay before removing dismissed toast from DOM (ms). */
const TOAST_REMOVE_DELAY = 1_000;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
};

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

const toastTimeouts = new Map();

const addToRemoveQueue = (toastId) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

const _clearFromRemoveQueue = (toastId) => {
  const timeout = toastTimeouts.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(toastId);
  }
};

export const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners = [];

let memoryState = { toasts: [] };

function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/** Per-toast auto-dismiss timers (pause on hover). */
const autoDismissTimers = new Map();

function clearAutoDismiss(toastId) {
  const entry = autoDismissTimers.get(toastId);
  if (!entry) return;
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  autoDismissTimers.delete(toastId);
}

function pauseAutoDismiss(toastId) {
  const entry = autoDismissTimers.get(toastId);
  if (!entry || entry.paused) return;
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  entry.timeoutId = null;
  entry.paused = true;
}

function resumeAutoDismiss(toastId, dismiss) {
  const entry = autoDismissTimers.get(toastId);
  if (!entry || !entry.paused) return;
  entry.paused = false;
  entry.startedAt = Date.now();
  entry.timeoutId = setTimeout(() => {
    clearAutoDismiss(toastId);
    dismiss();
  }, entry.remaining);
}

function toast({ duration = TOAST_DURATION, ...props }) {
  const id = genId();

  const update = (nextProps) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...nextProps, id },
    });

  const dismiss = () => {
    clearAutoDismiss(id);
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });
  };

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      duration,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
      onPause: () => pauseAutoDismiss(id),
      onResume: () => resumeAutoDismiss(id, dismiss),
    },
  });

  if (typeof duration === "number" && duration > 0 && duration !== Infinity) {
    autoDismissTimers.set(id, {
      remaining: duration,
      startedAt: Date.now(),
      paused: false,
      timeoutId: setTimeout(() => {
        clearAutoDismiss(id);
        dismiss();
      }, duration),
    });
  }

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast, TOAST_DURATION };
