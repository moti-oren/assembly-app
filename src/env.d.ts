/** The package version, with the commit it was built from when the deploy built it. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Where feedback is posted; unset in development, where nothing is sent. */
  readonly VITE_FEEDBACK_ENDPOINT?: string;
  /** The Umami site the usage events belong to; unset, nothing is loaded or sent. */
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  /** Where Umami's script is served from, when it is not Umami Cloud. */
  readonly VITE_UMAMI_SCRIPT_URL?: string;
  /** The host names that are counted, comma separated; a copy served elsewhere is not. */
  readonly VITE_UMAMI_DOMAINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
