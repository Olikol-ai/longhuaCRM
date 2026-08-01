import { Component } from 'react';

function isChunkOrMimeLoadError(message) {
  return /MIME type|text\/html|Failed to fetch dynamically imported module|Loading chunk|error loading dynamically imported module|ChunkLoadError/i.test(
    String(message || ''),
  );
}

async function clearClientCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Catches render errors so one broken page does not blank the whole SPA.
 * Chunk/MIME failures need a hard reload (and cache clear) — setState alone
 * cannot recover a failed dynamic import.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '', recovering: false };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      recovering: false,
      message: error?.message ? String(error.message) : 'Неизвестная ошибка',
    };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary', error, info?.componentStack);
  }

  handleGoHome = async () => {
    if (isChunkOrMimeLoadError(this.state.message)) {
      await clearClientCaches();
    }
    window.location.assign('/');
  };

  handleRetry = async () => {
    if (this.state.recovering) return;
    this.setState({ recovering: true });

    const hardReload = isChunkOrMimeLoadError(this.state.message);
    if (hardReload) {
      await clearClientCaches();
      window.location.reload();
      return;
    }

    // Soft recovery for ordinary render errors, then remount via reload if needed.
    this.setState({ hasError: false, message: '', recovering: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-app flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                disabled={this.state.recovering}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {this.state.recovering ? 'Обновление…' : 'Попробовать снова'}
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                disabled={this.state.recovering}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                На главную
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
