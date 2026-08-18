/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORDER_BACKEND?: "sheet" | "laravel";
  readonly VITE_SHEET_CSV_URL?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
