import React from 'react';
import { trackEvent } from '../telemetry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  /** Reset Data was tapped once: waiting for the person to confirm or back out. */
  confirmingReset: boolean;
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  state: State = { hasError: false, confirmingReset: false };

  static getDerivedStateFromError(): Partial<State> {
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

  askToReset = () => this.setState({ confirmingReset: true });

  keepData = () => this.setState({ confirmingReset: false });

  handleResetStorage = () => {
    trackEvent('app_error_boundary_reset_storage');
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const confirming = this.state.confirmingReset;
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
          <div role="alert" className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center shadow-xl">
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            {confirming ? (
              <>
                <p className="text-sm text-slate-300 mb-6">
                  This erases all your counts, history, routines and settings on this device. It cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={this.keepData} className="min-h-11 px-4 py-2 rounded-lg bg-emerald-500 text-on-brand font-semibold">
                    Keep my data
                  </button>
                  <button onClick={this.handleResetStorage} className="min-h-11 px-4 py-2 rounded-lg border border-rose-500 text-rose-300 font-semibold">
                    Erase everything
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300 mb-6">
                  The app hit an unexpected error. Reload first: your data is safe. Reset local app data only if reloading does not help.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={this.handleReload} className="min-h-11 px-4 py-2 rounded-lg bg-emerald-500 text-on-brand font-semibold">
                    Reload App
                  </button>
                  <button onClick={this.askToReset} className="min-h-11 px-4 py-2 rounded-lg border border-slate-700 text-slate-100">
                    Reset Data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
