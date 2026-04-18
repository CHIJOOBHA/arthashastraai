import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in pipe/component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-4 m-4 border border-red-500/30 bg-red-500/10 rounded-lg text-red-400 font-mono text-sm">
          <h2>System Pipe Disconnected</h2>
          <p>A non-core component failed to load. The core system remains secure and operational.</p>
          <details className="mt-2 text-xs opacity-70">
            <summary>Error Details</summary>
            {this.state.error?.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
