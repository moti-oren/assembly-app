/** Bit positions inside the 8086 FLAGS register. */
const FLAG_BITS = {
  CF: 0,
  PF: 2,
  AF: 4,
  ZF: 6,
  SF: 7,
  TF: 8,
  IF: 9,
  DF: 10,
  OF: 11
} as const;

export type FlagName = keyof typeof FLAG_BITS;

export const FLAG_NAMES = Object.keys(FLAG_BITS) as FlagName[];

/** The mask of one flag inside FLAGS. */
export function flagBit(flag: FlagName): number {
  return 1 << FLAG_BITS[flag];
}

/** Whether `flag` is set in a FLAGS value. */
export function isFlagSet(flags: number, flag: FlagName): boolean {
  return (flags & flagBit(flag)) !== 0;
}

/** Bit 1 and bits 12-15 of FLAGS are reserved and always read as 1 on the 8086. */
export const FLAGS_RESERVED = 0xf002;

/** The bits of FLAGS that are real flags; POPF and IRET can load no others. */
export const FLAGS_MASK = FLAG_NAMES.reduce((bits, name) => bits | flagBit(name), 0);

export const FLAG_INFO: Record<FlagName, { label: string; description: string }> = {
  CF: {
    label: 'Carry',
    description: 'Unsigned overflow: a carry out of, or a borrow into, the top bit'
  },
  PF: { label: 'Parity', description: 'The low byte of the result has an even number of 1 bits' },
  AF: { label: 'Aux carry', description: 'Carry out of bit 3 (used for BCD arithmetic)' },
  ZF: { label: 'Zero', description: 'The result is zero' },
  SF: { label: 'Sign', description: 'The top bit of the result is 1 (negative as signed)' },
  TF: { label: 'Trap', description: 'Single-step mode' },
  IF: { label: 'Interrupt', description: 'Maskable interrupts are enabled' },
  DF: { label: 'Direction', description: 'String instructions count down' },
  OF: {
    label: 'Overflow',
    description: 'Signed overflow: the result does not fit as a signed number'
  }
};
