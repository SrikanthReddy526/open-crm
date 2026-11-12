import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './i18n'
import './index.css'
import { isElectron, isNativeApp } from './platform'

// Service worker only for the website served over http(s); the apps ship their files themselves.
const isWebsite = !isNativeApp && !isElectron && window.location.protocol.startsWith('http')
const PwaPrompt = lazy(() => import('./components/PwaPrompt').then((m) => ({ default: m.PwaPrompt })))

const queryClient = new QueryClient({
  defaultOptions: {
    // Always run requests, even when the browser says it is offline: the API helpers then fall back
    // to the copy saved on the device (src/offline). React Query's default would just pause them.
    mutations: { networkMode: 'always' },
    queries: {
      networkMode: 'always',
      staleTime: 30_000,
      // Retry network hiccups once, but never retry 4xx errors (not found, forbidden…)
      retry: (failureCount, error) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        return failureCount < 1 && (status === undefined || status >= 500)
      },
    },
  },
})

// file:// (fallback desktop builds) cannot use clean URLs, so use #/routes there.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <App />
        </Router>
        {isWebsite && (
          <Suspense fallback={null}>
            <PwaPrompt />
          </Suspense>
        )}
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
