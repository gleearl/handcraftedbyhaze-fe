/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Laravel API. Empty (the default) means same-origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
