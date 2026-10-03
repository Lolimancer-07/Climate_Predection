import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import App from './App'
import { api } from './api/client'
import './index.css'

if (import.meta.env.VITE_STATIC_DEMO === 'true') {
  const blockedRequest = () => Promise.reject(new Error('Backend actions are unavailable in this public preview.'))
  axios.interceptors.request.use((config) => {
    void config
    return blockedRequest()
  })
  api.interceptors.request.use((config) => {
    void config
    return blockedRequest()
  })

  const nativeFetch = window.fetch.bind(window)
  const apiPath = /^\/(?:api\/)?(?:v1|risk|insurance|advisory|pipeline|structural|damage-assessment|scenarios|storms|notifications)(?:\/|$)/
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.toString()
        : input
    const url = new URL(requestUrl, window.location.href)
    const isLoopbackBackend = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && (!url.port || url.port === '8000')
    const isSameOriginApi = url.origin === window.location.origin && apiPath.test(url.pathname)
    if (isLoopbackBackend || isSameOriginApi) {
      return Promise.reject(new Error('Backend requests are disabled in this public preview.'))
    }
    return nativeFetch(input, init)
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
