/** The package version, with the commit it was built from when the deploy built it. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Where feedback is posted; unset in development, where nothing is sent. */
  readonly VITE_FEEDBACK_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
