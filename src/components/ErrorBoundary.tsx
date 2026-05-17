import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    let detailedInfo = '';
    try {
      // Try to parse if it's our JSON error info
      const parsed = JSON.parse(error.message);
      detailedInfo = JSON.stringify(parsed, null, 2);
    } catch (e) {
      detailedInfo = error.stack || error.message;
    }
    
    this.setState({ errorInfo: detailedInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden">
            <div className="p-8 sm:p-12 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6">
                <AlertTriangle size={40} />
              </div>
              
              <h1 className="text-2xl font-extrabold text-zinc-900 mb-4 tracking-tight">
                Đã xảy ra lỗi hệ thống
              </h1>
              
              <p className="text-zinc-500 mb-8 max-w-md">
                Chúng tôi rất tiếc vì sự cố này. Hệ thống gặp lỗi không mong muốn khi đang xử lý yêu cầu của bạn.
              </p>

              {this.state.errorInfo && (
                <div className="w-full bg-zinc-900 rounded-2xl p-6 mb-8 text-left overflow-hidden">
                  <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-3">Chi tiết lỗi:</p>
                  <pre className="text-red-400 text-xs font-mono overflow-auto max-h-48 custom-scrollbar">
                    {this.state.errorInfo}
                  </pre>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 active:scale-95"
                >
                  <RefreshCcw size={20} />
                  <span>Thử lại</span>
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                >
                  <Home size={20} />
                  <span>Về trang chủ</span>
                </button>
              </div>
            </div>
            
            <div className="bg-zinc-50 px-8 py-4 border-t border-zinc-100 text-center">
              <p className="text-zinc-400 text-xs">
                Nếu lỗi vẫn tiếp diễn, vui lòng liên hệ quản trị viên hệ thống.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
