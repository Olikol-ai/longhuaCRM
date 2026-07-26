import { Component } from 'react';

/**
 * Catches render errors so one broken page does not blank the whole SPA.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message ? String(error.message) : 'Неизвестная ошибка',
    };
  }

  componentDidCatch(error, info) {
    // Keep console for operators; do not crash the tree.
    console.error('AppErrorBoundary', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
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
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                Попробовать снова
              </button>
              <button
                type="button"
                onClick={this.handleReload}
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
