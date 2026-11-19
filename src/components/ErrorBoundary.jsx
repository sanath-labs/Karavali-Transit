import React from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-black text-slate-900">Something went wrong</h2>
            <p className="text-xs text-slate-600">
              The application encountered an unexpected display issue. Please reload to restore live transit tracking.
            </p>
            {this.state.error && (
              <pre className="text-[11px] bg-slate-100 text-rose-800 p-3 rounded-xl overflow-x-auto text-left font-mono">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCw size={14} />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
export default ErrorBoundary
