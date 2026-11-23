import type { NoControlView } from './controlLink';

/** The 6502's control unit is not one this topic can draw as two decoders. */
export function mos6502ControlLink(): NoControlView {
  return {
    unavailable:
      'The 6502 decodes an instruction with a table that is read again on every cycle the instruction takes, so its control lines change from one cycle to the next. That is not shown yet; the control unit here is the one of RISC-V.'
  };
}
