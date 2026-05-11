import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './features/landing/HomePage'
import PrimeBlotterApp from './PrimeBlotterApp'
import CryptoAgentPage from './features/crypto-agent/CryptoAgentPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/app" element={<PrimeBlotterApp />} />
        <Route path="/agent" element={<CryptoAgentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
