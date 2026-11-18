/** An error the CPU itself would raise (e.g. divide error), or an invalid instruction. */
export class CpuError extends Error {
  override name = 'CpuError';
}

/** A divide error is interrupt 0; it only surfaces as an error when no handler is installed. */
export class DivideError extends CpuError {}
