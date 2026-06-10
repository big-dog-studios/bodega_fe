/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Map API (the Cloud Run Service for `api/`). */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
