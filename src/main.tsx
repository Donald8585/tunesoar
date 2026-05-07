import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey="pk_live_Y2xlcmsudHVuZXNvYXIuY29tJA">
      <App />
    </ClerkProvider>
  </StrictMode>,
)
