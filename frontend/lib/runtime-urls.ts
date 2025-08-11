// Helpers to compute correct Gateway URLs depending on runtime

const isBrowser = (): boolean => typeof window !== 'undefined';

const trimSlashes = (value: string): string => value.replace(/\/$/, '');
const ensureLeadingSlash = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

// HTTP base URL for the Gateway
export const getBackendUrl = (): string => {
  if (isBrowser()) {
    return trimSlashes(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000');
  }
  return trimSlashes(process.env.INTERNAL_BACKEND_URL || 'http://gateway:3000');
};

// WebSocket base URL for the Gateway
export const getWebSocketUrl = (): string => {
  if (isBrowser()) {
    const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
    if (fromEnv) return trimSlashes(fromEnv);
    // Derive from backend if WS not provided
    return trimSlashes(getBackendUrl().replace(/^http(s?):\/\//, (_m, s) => (s ? 'wss://' : 'ws://')));
  }
  return trimSlashes(process.env.INTERNAL_WS_URL || 'ws://gateway:3000');
};

export const buildApiUrl = (path: string): string => {
  return `${getBackendUrl()}${ensureLeadingSlash(path)}`;
};

export const buildWsUrl = (path = '/ws'): string => {
  return `${getWebSocketUrl()}${ensureLeadingSlash(path)}`;
};

export default {
  getBackendUrl,
  getWebSocketUrl,
  buildApiUrl,
  buildWsUrl,
};


