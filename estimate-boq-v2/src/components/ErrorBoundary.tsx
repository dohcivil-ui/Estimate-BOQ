/**
 * ErrorBoundary — กันหน้าขาวจาก runtime error ใน React subtree
 *
 * Usage:
 *   <ErrorBoundary scope="app">
 *     <App />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary scope="AI panel" fallback={CustomFallback}>
 *     <AIPanel />
 *   </ErrorBoundary>
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** ป้ายชื่อ section ที่ครอบ — แสดงใน console + UI */
  scope?: string;
  /** custom fallback ถ้าไม่ใช้ default UI */
  fallback?: (err: Error, reset: () => void) => ReactNode;
  /** กรณีที่ error หาย ให้ reset อัตโนมัติ (เช่น เปลี่ยน analysisId แล้ว retry) */
  resetKey?: string | number | null;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const scope = this.props.scope ?? 'unknown';
    console.error(`[ErrorBoundary:${scope}]`, error);
    if (info.componentStack) {
      console.error(`[ErrorBoundary:${scope}] componentStack:`, info.componentStack);
    }
    this.setState({ errorInfo: info });
  }

  componentDidUpdate(prevProps: Props): void {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey &&
      this.props.resetKey != null
    ) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    const scope = this.props.scope ?? '';
    return (
      <div
        className="m-4 rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-ink-primary"
        role="alert"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="font-semibold text-danger">
            ⚠️ เกิดข้อผิดพลาด{scope && ` ที่ ${scope}`}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={this.reset}
              className="rounded border border-bg-border bg-bg-raised px-2.5 py-1 text-xs hover:bg-bg-hover"
            >
              ลองอีกครั้ง
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-ink-inverse hover:bg-accent-hover"
            >
              🔄 โหลดใหม่
            </button>
          </div>
        </div>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-bg-base/60 p-2 font-mono text-[11px] text-ink-secondary">
          {error.message || String(error)}
        </pre>
        {import.meta.env.DEV && error.stack && (
          <details className="mt-2 text-[10px] text-ink-muted">
            <summary className="cursor-pointer">📜 stack trace</summary>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-bg-base/40 p-2 font-mono">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
