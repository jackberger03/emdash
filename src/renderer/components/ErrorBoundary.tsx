import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-full w-full items-center justify-center bg-red-50 p-8">
            <div className="max-w-2xl rounded-lg border border-red-200 bg-white p-6 shadow-lg">
              <h1 className="mb-4 text-2xl font-bold text-red-600">Something went wrong</h1>
              <div className="mb-4 rounded bg-red-50 p-4 font-mono text-sm">
                <div className="font-bold text-red-800">Error:</div>
                <div className="text-red-700">{this.state.error?.message}</div>
              </div>
              <div className="rounded bg-gray-50 p-4 font-mono text-xs">
                <div className="font-bold text-gray-800">Stack:</div>
                <pre className="whitespace-pre-wrap text-gray-600">{this.state.error?.stack}</pre>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Reload App
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
