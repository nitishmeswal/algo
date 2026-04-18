import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme as antdTheme } from 'antd'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    theme={{
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: '#4f46e5',
        colorInfo: '#6366f1',
        colorBgLayout: '#111111',
        colorBgContainer: '#161618',
        colorBgElevated: '#1c1c22',
        colorBorder: 'rgba(255, 255, 255, 0.08)',
        colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
        colorText: 'rgba(255, 255, 255, 0.92)',
        colorTextSecondary: 'rgba(255, 255, 255, 0.45)',
        colorTextTertiary: 'rgba(255, 255, 255, 0.35)',
      },
    }}
  >
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ConfigProvider>,
)
