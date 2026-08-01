import { Component } from 'react';
import FrontendUpdateScreen from '@/components/common/FrontendUpdateScreen';
import {
  claimChunkAutoReload,
  clearClientModuleCaches,
  hardReloadForStaleChunks,
  isChunkLoadError,
  logChunkLoadError,
  recordFrontendUpdateEvent,
  saveNavigationStateForUpdate,
} from '@/lib/frontendUpdate';

/**
 * Thin boundary: chunk/deploy failures → FrontendUpdateScreen.
 * All other errors → generic friendly fallback (no stack / no technical text).
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      isChunkError: false,
      updatePhase: 'updating',
    };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = isChunkLoadError(error);
    return {
      hasError: true,
      isChunkError,
      updatePhase: isChunkError ? 'updating' : 'idle',
    };
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) {
      logChunkLoadError(error, info);
      saveNavigationStateForUpdate({ reason: 'boundary' });
      if (!claimChunkAutoReload()) {
        recordFrontendUpdateEvent({
          type: 'frontend_update_manual_required',
          reason: 'auto_reload_already_claimed',
        });
        this.setState({ updatePhase: 'manual' });
        return;
      }
      this.setState({ updatePhase: 'updating' });
      return;
    }

    console.error('AppErrorBoundary', error, info?.componentStack);
  }

  handleGoHome = async () => {
    if (this.state.isChunkError) {
      await clearClientModuleCaches();
    }
    window.location.assign('/');
  };

  handleReloadNow = async () => {
    this.setState({ updatePhase: 'updating' });
    await hardReloadForStaleChunks('manual');
  };

  handleAutoReload = async () => {
    await hardReloadForStaleChunks('boundary');
  };

  handleRetry = () => {
    this.setState({ hasError: false, isChunkError: false, updatePhase: 'idle' });
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
          onAutoReload={this.handleAutoReload}
          onReloadNow={this.handleReloadNow}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return (
      <div className="min-h-app flex items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
          <p className="text-sm text-muted-foreground">
            Произошла ошибка. Попробуйте обновить страницу или вернуться на главную.
          </p>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }
}
