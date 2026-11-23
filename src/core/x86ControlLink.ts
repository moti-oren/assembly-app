import type { NoControlView } from './controlLink';

/** The 8086's control unit is not one this topic can draw as two decoders. */
export function x86ControlLink(): NoControlView {
  return {
    unavailable:
      'The 8086 decodes most instructions with microcode: a small program inside the chip that takes several steps for each instruction. That is not shown yet; the control unit here is the one of RISC-V.'
  };
}
