import React from 'react';
import { trackEvent } from '../telemetry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('App crashed in render tree:', error);
    trackEvent('app_error_boundary_catch', { message: error.message });
  }

  handleReload = () => {
    trackEvent('app_error_boundary_reload');
    window.location.reload();
  };

  handleResetStorage = () => {
    trackEvent('app_error_boundary_reset_storage');
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center shadow-xl">
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-300 mb-6">
              The app hit an unexpected error. You can reload, or reset local app data if this keeps happening.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReload} className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold">
                Reload App
              </button>
              <button onClick={this.handleResetStorage} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-100">
                Reset Data
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
