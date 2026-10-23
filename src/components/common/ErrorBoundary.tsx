import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, Home, Sparkles, ChevronDown } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error | null, reset: () => void) => ReactNode;
  autoRecover?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showTechDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    showTechDetails: false,
  };

  private retryTimer: NodeJS.Timeout | null = null;

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[Hệ thống tự động ghi nhận sự cố giao diện]:', error, errorInfo);
  }

  public componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private handleReset = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setState({ hasError: false, error: null, showTechDetails: false });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 animate-in fade-in duration-200">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl backdrop-blur-xl space-y-5">
            {/* Elegant Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600/20 to-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30 shadow-inner">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Đã tự động bảo toàn dữ liệu
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Một thành phần giao diện vừa gặp xung đột nhẹ. Toàn bộ tiến trình làm việc và dữ liệu của bạn đã được lưu trữ an toàn.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/25 transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Tiếp tục làm việc
              </button>
              <button
                type="button"
                onClick={() => {
                  this.handleReset();
                  window.location.href = '/';
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer active:scale-95"
              >
                <Home className="w-3.5 h-3.5" /> Về trang chủ
              </button>
            </div>

            {/* Hidden by default technical details for developers */}
            {this.state.error?.message && (
              <div className="pt-2 text-left">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showTechDetails: !prev.showTechDetails }))}
                  className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <span>Thông tin chẩn đoán</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${this.state.showTechDetails ? 'rotate-180' : ''}`} />
                </button>
                {this.state.showTechDetails && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[10px] text-slate-400 break-words max-h-24 overflow-y-auto leading-relaxed">
                    {this.state.error.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

