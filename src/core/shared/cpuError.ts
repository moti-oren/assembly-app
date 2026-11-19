import { CPU_ERROR_TEXTS, type CpuErrorKey } from './cpuErrorTexts';
import { fillText, type Said, type TextParams } from './text';

/** An error the CPU itself would raise (e.g. divide error), or an invalid instruction. */
export class CpuError extends Error {
  override name = 'CpuError';

  /** Which sentence the message is and what fills it, so another language can word it. */
  readonly said: Said<CpuErrorKey> | null;

  constructor(message: string, said: Said<CpuErrorKey> | null = null) {
    super(message);
    this.said = said;
  }
}

/** The CPU refuses with one of its sentences: English in the message, and the key beside it. */
export function cpuError(key: CpuErrorKey, params: TextParams = {}): CpuError {
  return new CpuError(fillText(CPU_ERROR_TEXTS[key], params), { key, params });
}
