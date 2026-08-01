import { Component } from 'react';
import {
  CHUNK_UPDATE_MESSAGE,
  claimChunkAutoReload,
  clearClientModuleCaches,
  hardReloadForStaleChunks,
  isChunkLoadError,
} from '@/lib/lazyRetry';

/**
 * Catches render errors so one broken page does not blank the whole SPA.
 * Chunk/MIME failures show an update message and hard-reload once automatically.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      recovering: false,
      isChunkError: false,
    };
    this.autoReloadTimer = null;
    this.autoRecoverStarted = false;
  }

  static getDerivedStateFromError(error) {
    const isChunkError = isChunkLoadError(error);
    return {
      hasError: true,
      recovering: isChunkError,
      message: error?.message ? String(error.message) : 'Неизвестная ошибка',
      isChunkError,
    };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary', error, info?.componentStack);
    if (!isChunkLoadError(error) || this.autoRecoverStarted) return;
    if (!claimChunkAutoReload()) {
      // Already auto-reloaded recently — show manual retry only.
      this.setState({ recovering: false });
      return;
    }
    this.autoRecoverStarted = true;
    this.setState({ recovering: true, isChunkError: true });
    this.autoReloadTimer = window.setTimeout(() => {
      void hardReloadForStaleChunks('boundary');
    }, 900);
  }

  componentWillUnmount() {
    if (this.autoReloadTimer) {
      window.clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
  }

  handleGoHome = async () => {
    if (this.autoReloadTimer) {
      window.clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
    this.setState({ recovering: true });
    if (this.state.isChunkError) {
      await clearClientModuleCaches();
    }
    window.location.assign('/');
  };

  handleRetry = async () => {
    if (this.state.recovering && this.state.isChunkError) {
      // Second click while waiting — force reload immediately.
    }
    if (this.autoReloadTimer) {
      window.clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
    this.setState({ recovering: true });

    if (this.state.isChunkError || isChunkLoadError({ message: this.state.message })) {
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
            <h1 className="text-xl font-semibold">
              {this.state.isChunkError ? 'Обновление приложения' : 'Что-то пошло не так'}
            </h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.isChunkError ? CHUNK_UPDATE_MESSAGE : this.state.message}
            </p>
            {this.state.isChunkError && this.state.recovering ? (
              <p className="text-xs text-muted-foreground">Перезагрузка…</p>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                {this.state.isChunkError
                  ? this.state.recovering
                    ? 'Перезагрузить сейчас'
                    : 'Попробовать снова'
                  : this.state.recovering
                    ? 'Обновление…'
                    : 'Попробовать снова'}
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
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
