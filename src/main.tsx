import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/theme.css';
import './index.css';

const API_BASE_STORAGE_KEY = 'neuro_shield_api_base';

const normalizeApiBase = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const resolveRuntimeApiBase = (): string | null => {
  const queryBase = normalizeApiBase(new URLSearchParams(window.location.search).get('apiBase'));
  if (queryBase) {
    try {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, queryBase);
    } catch {
      // no-op when localStorage is blocked
    }
    return queryBase;
  }

  try {
    const storedBase = normalizeApiBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
    if (storedBase) return storedBase;
  } catch {
    // no-op when localStorage is blocked
  }

  return normalizeApiBase(import.meta.env.VITE_API_BASE_URL as string | undefined);
};

const rewriteApiUrl = (targetUrl: string, apiBase: string): string => {
  try {
    const parsed = new URL(targetUrl, window.location.origin);
    if (parsed.pathname.startsWith('/api') && parsed.origin === window.location.origin) {
      return `${apiBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    if (targetUrl.startsWith('/api')) {
      return `${apiBase}${targetUrl}`;
    }
  }
  return targetUrl;
};

const applyRuntimeApiBase = (apiBase: string | null): void => {
  if (!apiBase) return;
  const originalFetch = window.fetch.bind(window);

  const patchedFetch: typeof window.fetch = (input, init) => {
    if (typeof input === 'string') {
      return originalFetch(rewriteApiUrl(input, apiBase), init);
    }
    if (input instanceof URL) {
      return originalFetch(rewriteApiUrl(input.toString(), apiBase), init);
    }

    const rewrittenUrl = rewriteApiUrl(input.url, apiBase);
    if (rewrittenUrl === input.url) {
      return originalFetch(input, init);
    }

    return originalFetch(new Request(rewrittenUrl, input), init);
  };

  window.fetch = patchedFetch;
};

applyRuntimeApiBase(resolveRuntimeApiBase());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
