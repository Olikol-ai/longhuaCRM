import { Component } from 'react';
import {
  claimChunkAutoReload,
  clearClientModuleCaches,
  hardReloadForStaleChunks,
  isChunkLoadError,
} from '@/lib/lazyRetry';

/**
 * Catches render errors so one broken page does not blank the whole SPA.
 * Chunk/MIME failures need a hard reload (and cache clear) — setState alone
 * cannot recover a failed dynamic import.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '', recovering: false, isChunkError: false };
    this.autoRecoverStarted = false;
  }

  static getDerivedStateFromError(error) {
    const message = error?.message ? String(error.message) : 'Неизвестная ошибка';
    return {
      hasError: true,
      recovering: false,
      message,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary', error, info?.componentStack);
    if (isChunkLoadError(error) && !this.autoRecoverStarted && claimChunkAutoReload()) {
      this.autoRecoverStarted = true;
      void this.recoverFromStaleChunk();
    }
  }

  recoverFromStaleChunk = async () => {
    this.setState({ recovering: true });
    try {
      await hardReloadForStaleChunks('boundary');
    } catch {
      this.setState({ recovering: false });
    }
  };

  handleGoHome = async () => {
    this.setState({ recovering: true });
    if (this.state.isChunkError || isChunkLoadError({ message: this.state.message })) {
      await clearClientModuleCaches();
    }
    window.location.assign('/');
  };

  handleRetry = async () => {
    if (this.state.recovering) return;
    this.setState({ recovering: true });

    const hardReload =
      this.state.isChunkError || isChunkLoadError({ message: this.state.message });
    if (hardReload) {
      // Manual retry always clears caches and reloads (bypass auto-reload gate).
      await hardReloadForStaleChunks('retry');
      return;
    }

    this.setState({ hasError: false, message: '', recovering: false, isChunkError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-app flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.isChunkError
                ? 'Приложение обновилось на сервере. Нажмите «Попробовать снова», чтобы загрузить актуальную версию.'
                : this.state.message}
            </p>
            {this.state.isChunkError ? (
              <p className="text-xs text-muted-foreground break-words">{this.state.message}</p>
            ) : null}
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
