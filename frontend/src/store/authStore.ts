import axios from 'axios';
import { create } from 'zustand';

import { getMe } from '../api/authApi';
import { refreshSession } from '../api/session';
import type { User } from '../types/auth';

export type InitError = 'network' | 'rate_limited' | 'unavailable' | null;

interface AuthStore {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  /** True while startup initialization (refresh + profile restore) is running. */
  isLoading: boolean;
  /** Why initialization could not confirm the session without invalidating it. */
  initError: InitError;
  hasInitialized: boolean;
  setAuth: (token: string, user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  initializeAuth: () => Promise<void>;
}

/** Single-flight init: StrictMode double-mount and late callers share one run. */
let initPromise: Promise<void> | null = null;

/**
 * Classify an initialization failure.
 * Returns null when credentials are definitively invalid/revoked (401/403) —
 * in that case the session must be cleared. Any other outcome is temporary:
 * the HttpOnly refresh cookie stays intact and a reload can recover.
 */
function classifyInitError(error: unknown): InitError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'network'; // backend unreachable
    }
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return null; // invalid/expired/revoked refresh token
    }
    if (status === 429) {
      return 'rate_limited';
    }
    return 'unavailable'; // 5xx
  }
  return 'network';
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  initError: null,
  hasInitialized: false,

  setAuth: (token, user) =>
    set({
      accessToken: token,
      user,
      isAuthenticated: true,
      initError: null,
    }),

  setAccessToken: (token) =>
    set({ accessToken: token }),

  clearAuth: () =>
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    }),

  initializeAuth: () => {
    if (!initPromise) {
      initPromise = (async () => {
        set({ isLoading: true, initError: null });
        try {
          // Cookie-based refresh: the refresh token never touches JS storage.
          const token = await refreshSession();
          set({ accessToken: token });
          const me = await getMe();
          set({
            accessToken: token,
            user: me.data,
            isAuthenticated: true,
          });
        } catch (error) {
          const classified = classifyInitError(error);
          if (classified) {
            // Temporary failure: do NOT erase valid credentials (the cookie is
            // untouched) — surface the reason; protected pages stay locked out
            // until a retry/reload succeeds.
            set({ initError: classified, isAuthenticated: false });
          } else {
            // Definitively invalid or revoked refresh credentials.
            set({ accessToken: null, user: null, isAuthenticated: false });
          }
        } finally {
          set({ isLoading: false, hasInitialized: true });
        }
      })();
    }
    return initPromise;
  },
}));
