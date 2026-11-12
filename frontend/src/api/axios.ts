import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { refreshSession } from './session';

/**
 * API base URL: relative `/api/v1` by default (same-origin deployments behind
 * a reverse proxy). For split deployments — frontend on Vercel, backend on a
 * separate HTTPS host — set VITE_API_BASE_URL at build time, e.g.
 * `https://api.example.com/api/v1`. No hostname is hardcoded.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim() || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Auth lifecycle endpoints: never receive an Authorization header (a stale
 * access token must not break login/refresh) and never trigger the refresh
 * flow (a 401 from these endpoints is a meaningful answer, not a token lapse).
 */
const AUTH_PATHS = [
  '/auth/login/',
  '/auth/refresh/',
  '/auth/register/',
  '/auth/logout/',
];

function isAuthPath(url?: string): boolean {
  return !!url && AUTH_PATHS.some((path) => url.includes(path));
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.request.use(async (config) => {
  if (isAuthPath(config.url)) {
    return config;
  }
  const { useAuthStore } = await import('../store/authStore');
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (
      !original ||
      error.response?.status !== 401 ||
      original._retry ||
      isAuthPath(original.url)
    ) {
      return Promise.reject(error);
    }

    // Every request is refreshed/replayed at most once.
    original._retry = true;

    try {
      // Single-flight: concurrent 401s share one refresh POST; the newest
      // token is picked up by the request interceptor on replay.
      const token = await refreshSession();
      const { useAuthStore } = await import('../store/authStore');
      const store = useAuthStore.getState();
      if (store.user) {
        store.setAuth(token, store.user);
      } else {
        store.setAccessToken(token);
      }
      return api(original);
    } catch (refreshError) {
      const status = axios.isAxiosError(refreshError)
        ? refreshError.response?.status
        : undefined;
      if (status === 401 || status === 403) {
        // Definitively invalid/revoked refresh credentials: clear local state
        // (the backend already revoked/rotated) and return to login.
        const { useAuthStore } = await import('../store/authStore');
        useAuthStore.getState().clearAuth();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login');
        }
      }
      // Network failure / 429 / 5xx: keep authentication state — the refresh
      // cookie is untouched and a retry can recover. Surface the original error.
      return Promise.reject(error);
    }
  },
);

export default api;
