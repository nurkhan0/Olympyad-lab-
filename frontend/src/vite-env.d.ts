/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional explicit WebSocket origin for submission status (ws:// or wss://...). */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
