/**
 * What the CPU says when it refuses an instruction, as templates (see `shared/text.ts`).
 * A key per sentence, so a translation is a table with the same keys.
 */
export const CPU_ERROR_TEXTS = {
  tooManyWrites:
    'Stopped after {count} memory writes, which usually means an endless loop. Use Step to see which jump keeps repeating.',
  tooManySteps:
    'Stopped after {count} steps, which usually means an endless loop. Use Step to see which jump keeps repeating.',
  endOfProgram: 'End of program: there is no line at the instruction pointer',
  invalidInstruction:
    "{instruction} isn't a valid {cpu} instruction. Remove the last word and pick again.",

  // The 8086
  numberDestination: "A number can't be a destination. Pick a register or memory first.",
  labelDestination: "A line label can't be a destination. Pick a register or memory first.",
  jumpNeedsLine: 'A jump needs a program line (L0, L1, …) as its target.',
  noHandler:
    'INT {type}h has no handler yet: its vector at 0000:{vector} is empty. Store the handler\'s line in that vector first (see the "Software interrupt" example).',

  // RISC-V
  misalignedJump:
    'Instruction address misaligned: every instruction is 4 bytes, so a jump target must be a multiple of 4, and {at} is not.',
  noLineAt: 'No program line at {at}: the code is 0x00000000 up to the end of the program.',
  misalignedLoadHalf:
    'Misaligned load: a half-word must start at a multiple of 2, and {at} is not. This CPU traps instead of splitting the access.',
  misalignedLoadWord:
    'Misaligned load: a word must start at a multiple of 4, and {at} is not. This CPU traps instead of splitting the access.',
  misalignedStoreHalf:
    'Misaligned store: a half-word must start at a multiple of 2, and {at} is not. This CPU traps instead of splitting the access.',
  misalignedStoreWord:
    'Misaligned store: a word must start at a multiple of 4, and {at} is not. This CPU traps instead of splitting the access.',
  deviceByteOnly: 'Access fault: the devices at {at} are one byte each. Use LB, LBU or SB.',
  nothingWired:
    'Access fault: nothing is wired at {at}. RAM is 0x00000000 to 0x000FFFFF, the devices start at 0x10000000.',
  storeIntoCode:
    'Store into code: {address} holds {line}. This playground runs the program as a list of lines, so a program cannot change its own code.',

  // The 6502
  noLineStarts:
    'No program line starts at {address}. The code runs from $0600, one line after another; a jump has to land on the first byte of a line.',
  writeIntoCodeLine:
    'Write into code: {address} is {line} of the program. This playground runs the program as a list of lines, so a program cannot change its own code.',
  writeIntoCodeMiddle:
    'Write into code: {address} is the middle of a line of the program. This playground runs the program as a list of lines, so a program cannot change its own code.'
} as const;

export type CpuErrorKey = keyof typeof CPU_ERROR_TEXTS;
