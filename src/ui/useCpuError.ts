import { ref } from 'vue';
import { CpuError } from '@/core/shared/cpuError';

/** What raised the error on show: the builder's own instruction, or the program. */
export type ErrorSource = 'builder' | 'program';

/** The error the CPU raised last, if any, and where it came from. Each source shows its own. */
export function useCpuError() {
  const error = ref<string | null>(null);
  const errorFrom = ref<ErrorSource>('builder');

  /** Shows `message` as the error of `from`, or clears the error when it is null. */
  function report(from: ErrorSource, message: string | null): void {
    error.value = message;
    errorFrom.value = from;
  }

  /** Runs a CPU operation, turning a CpuError into the visible error message. */
  function attempt(from: ErrorSource, operation: () => void): boolean {
    try {
      operation();
      error.value = null;
      return true;
    } catch (caught) {
      if (caught instanceof CpuError) {
        report(from, caught.message);
        return false;
      }
      throw caught;
    }
  }

  function clearError(): void {
    error.value = null;
  }

  return { error, errorFrom, attempt, report, clearError };
}
