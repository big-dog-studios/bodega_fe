/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Map API (the gateway in front of `api/`). */
  readonly VITE_API_BASE_URL: string;
  /** API key sent as `x-api-key` to the gateway. */
  readonly VITE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
