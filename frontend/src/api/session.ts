/**
 * Single-flight refresh-token exchange.
 *
 * Shared by authStore.initializeAuth() and the axios response interceptor so
 * that concurrent 401s / StrictMode double-initialization trigger exactly one
 * POST /auth/refresh/. Rotation on the backend revokes the presented jti, so
 * parallel refresh calls would otherwise destroy a valid session.
 *
 * The call deliberately uses a bare axios instance: it must not carry a stale
 * Authorization header (backend treats invalid access tokens as anonymous, but
 * clean requests are cheaper) and must never re-enter the api instance's
 * response interceptor (no recursive refresh loops).
 */
import axios from 'axios';

const refreshClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string> | null = null;

export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ access_token?: string }>('/auth/refresh/')
      .then((res) => {
        refreshPromise = null;
        const token = res.data?.access_token;
        if (!token) {
          throw new Error('Refresh response is missing access_token');
        }
        return token;
      })
      .catch((err) => {
        refreshPromise = null;
        throw err;
      });
  }
  return refreshPromise;
}
