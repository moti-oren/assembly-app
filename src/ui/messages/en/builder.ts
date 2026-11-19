import type { Widen } from '../widen';

/** The instruction builder: the groups of choices and the hints under the box. */
export const builder = {
  builderCommon: {
    filterInstructions: 'Type to filter instructions',
    filter: 'Type to filter',
    runOrAdd: 'Enter: run now · Shift+Enter: add to the program',
    pickLine: 'Pick a line to jump to, or type its number',
    jumpTo: 'Jump to program line',
    branchTo: 'Branch to program line',
    endOfProgram: 'end of program'
  },
  builderX86: {
    repeatPrefix: 'Repeat prefix',
    prefixHint: (description: string) => `${description}. Pick the string instruction next.`,
    addressInRegister: 'Address in a register',
    directAddress: 'Direct address',
    immediate: (bits: number) => `Immediate (${bits}-bit)`,
    count: 'Count',
    lineNumber: 'Number of a program line',
    byteRegisters: '8-bit registers',
    segmentRegisters: 'Segment registers',
    wordRegisters: '16-bit registers',
    memory: 'Memory',
    memoryHint: (bits: number) => `${bits}-bit value in memory`,
    pickString: 'Pick the string instruction to repeat',
    pickAddress: 'Pick a register or type an offset (e.g. 0x10)',
    tooBig: (text: string, bits: number) => `${text} does not fit in ${bits} bits`,
    typeNumber: 'Type a number: 42 (decimal), 0x2A or 2Ah (hex), 101010b (binary)'
  },
  builderRv32: {
    immediates: {
      imm12: '12-bit, -2048 to 2047',
      shamt: 'shift amount, 0 to 31',
      imm20: 'upper 20 bits, 0 to 0xFFFFF',
      imm32: 'any 32-bit value',
      mem: '12-bit offset, -2048 to 2047'
    },
    roles: {
      special: 'Special: zero, return address, stack, global and thread pointers',
      argument: 'Arguments and return values (a0–a7)',
      temporary: 'Temporaries (t0–t6)',
      saved: 'Saved across calls (s0–s11)'
    },
    withFormat: (description: string, format: string) => `${description} (${format}-type)`,
    pseudo: 'Pseudo-instructions: the assembler turns each into real ones',
    zero: 'x0: always reads as 0; writes to it are thrown away',
    offset: 'Offset from a base register',
    offsetHint: 'Then pick the register the offset is added to',
    immediate: (range: string) => `Immediate (${range})`,
    pickBase: 'Pick the base register the offset is added to',
    tooBig: (text: string, range: string) => `${text} does not fit: ${range}`,
    typeOffset: 'Type an offset (e.g. 8 or -4), or pick the base register',
    pickRegister: 'Pick a register, or type its name (a0, t1, sp…)',
    typeNumber: 'Type a number: 42 (decimal), -5, 0x2A or 101010b',
    becomes: (instructions: readonly string[]) => `becomes ${instructions.join(', then ')}`
  },
  builder6502: {
    cycles: (count: number, pageCross: boolean) =>
      `${count} cycles${pageCross ? ', +1 across a page' : ''}`,
    meanings: {
      imm: (value: string) => `the value ${value} itself`,
      zp: (address: string) =>
        `the byte at ${address}, in the zero page: one byte shorter than absolute`,
      zpx: (address: string) => `the byte at ${address} + X, wrapping around in the zero page`,
      zpy: (address: string) => `the byte at ${address} + Y, wrapping around in the zero page`,
      abs: (address: string) => `the byte at ${address}`,
      abx: (address: string) => `the byte at ${address} + X`,
      aby: (address: string) => `the byte at ${address} + Y`,
      ind: (address: string) => `jump to the address stored at ${address}`,
      izx: (address: string) => `the byte at the address stored at ${address} + X in the zero page`,
      izy: (address: string) => `the byte at the address stored at ${address}, plus Y`
    },
    accumulator: 'Accumulator',
    aItself: (cycles: string) => `A itself · ${cycles}`,
    fitsNone: (text: string, mnemonic: string) =>
      `${text} fits none of ${mnemonic}'s addressing modes`,
    pickLine: 'Pick a line, or type its number',
    typeNumber: (accumulator: boolean) =>
      `Type a number ($2A, 42, 0x2A): every addressing mode it fits is offered${accumulator ? ', or pick a for A' : ''}`,
    modes: (description: string, modes: string) => `${description}. Modes: ${modes}`,
    withOpcode: (description: string, mode: string, opcode: string, cycles: string) =>
      `${description} · ${mode}, opcode ${opcode}, ${cycles}`
  }
};

export type BuilderMessages = Widen<typeof builder>;
