import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-8 text-center space-y-4 backdrop-blur-xl">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <div>
            <h3 className="font-extrabold text-white text-base">Something went wrong</h3>
            <p className="text-xs text-slate-400 mt-1">{this.state.error?.message || 'An unexpected error occurred'}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
