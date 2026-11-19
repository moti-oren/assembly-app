/** An error the CPU itself would raise (e.g. divide error), or an invalid instruction. */
export class CpuError extends Error {
  override name = 'CpuError';
}
