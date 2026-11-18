import { ref } from 'vue';

/**
 * A bug in the app itself, as opposed to a CpuError, which the CPU raises on purpose and the
 * panels already show. Kept here so main.ts can report it before any component exists.
 */
const appError = ref<string | null>(null);

function reportAppError(error: unknown): void {
  console.error(error);
  appError.value = error instanceof Error ? error.message : String(error);
}

/** The one app-wide error; main.ts reports into it and AppErrorNotice shows it. */
export function useAppError() {
  return { appError, reportAppError };
}
