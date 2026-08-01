import { Component } from 'react';
import FrontendUpdateScreen from '@/components/common/FrontendUpdateScreen';
import {
  claimChunkAutoReload,
  clearClientModuleCaches,
  hardReloadForStaleChunks,
  isChunkLoadError,
  logChunkLoadError,
} from '@/lib/lazyRetry';

/**
 * Catches render errors so one broken page does not blank the whole SPA.
 * Deploy / chunk failures use a dedicated update screen — never technical text.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      recovering: false,
      isChunkError: false,
      updatePhase: 'updating',
    };
    this.autoReloadTimer = null;
    this.autoRecoverStarted = false;
  }

  static getDerivedStateFromError(error) {
    const isChunkError = isChunkLoadError(error);
    return {
      hasError: true,
      // Never surface raw error.message for chunk failures in UI state consumers.
      message: isChunkError
        ? ''
        : error?.message
          ? String(error.message)
          : 'Неизвестная ошибка',
      recovering: isChunkError,
      isChunkError,
      updatePhase: isChunkError ? 'updating' : 'idle',
    };
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) {
      logChunkLoadError(error, info);
      if (this.autoRecoverStarted) return;
      if (!claimChunkAutoReload()) {
        // Auto-reload already tried recently — show manual actions only.
        this.setState({ recovering: false, updatePhase: 'manual' });
        return;
      }
      this.autoRecoverStarted = true;
      this.setState({ recovering: true, isChunkError: true, updatePhase: 'updating' });
      this.autoReloadTimer = window.setTimeout(() => {
        void hardReloadForStaleChunks('boundary');
      }, 800);
      return;
    }

    console.error('AppErrorBoundary', error, info?.componentStack);
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

  handleReloadNow = async () => {
    if (this.autoReloadTimer) {
      window.clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
    this.setState({ recovering: true, updatePhase: 'updating' });
    await hardReloadForStaleChunks('retry');
  };

  handleRetry = async () => {
    if (this.autoReloadTimer) {
      window.clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
    this.setState({ recovering: true });
    this.setState({ hasError: false, message: '', recovering: false, isChunkError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.isChunkError) {
      return (
        <FrontendUpdateScreen
          phase={this.state.updatePhase === 'manual' ? 'manual' : 'updating'}
          onReloadNow={this.handleReloadNow}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return (
      <div className="min-h-app flex items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
          <p className="break-words text-sm text-muted-foreground">
            Произошла ошибка. Попробуйте обновить страницу или вернуться на главную.
          </p>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }
}
