import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getTranslation } from '../translations';
import { readStoredLanguage } from '../hooks/useLanguage';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches a crash in one part of the page and offers a reset, without exposing internals. */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] A component crashed:', error, errorInfo.componentStack);
  }

  private reset = () => this.setState({ hasError: false });

  public render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    const t = getTranslation(readStoredLanguage());
    return (
      <div role="alert" className="m-13 p-21 border border-cyber-red/34 bg-cyber-red/5 rounded-13 text-parchment font-sans">
        <div className="flex items-center gap-8 mb-8 text-cyber-red">
          <AlertTriangle className="w-21 h-21" aria-hidden />
          <h2 className="text-13 font-bold uppercase tracking-widest">{t.errorTitle}</h2>
        </div>
        <p className="text-13 text-parchment/89 mb-13 leading-relaxed">{t.errorBody}</p>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-8 px-13 py-8 border border-neon-cyan/55 text-neon-cyan rounded-8 text-[11px] font-bold uppercase tracking-widest hover:bg-neon-cyan/13 transition-colors"
        >
          <RotateCcw className="w-13 h-13" aria-hidden />
          {t.tryAgain}
        </button>
      </div>
    );
  }
}
