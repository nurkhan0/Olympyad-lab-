/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional explicit WebSocket origin for submission status (ws:// or wss://...). */
  readonly VITE_WS_URL?: string;

  /**
   * Optional API base for split deployments (e.g. `https://api.example.com/api/v1`).
   * Empty/undefined = relative `/api/v1` (same-origin via the Vercel rewrite).
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
