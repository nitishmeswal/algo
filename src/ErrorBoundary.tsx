import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'

type Props = { children: ReactNode }

type State = { hasError: boolean; message?: string }

/**
 * Catches render-phase errors so the whole tree doesn’t go to a blank page without UI.
 * (Effect/async errors still need their own handling.)
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.message}
            extra={
              <Button type="primary" onClick={() => window.location.reload()}>
                Reload
              </Button>
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}
