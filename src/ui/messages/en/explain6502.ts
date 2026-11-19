import type { Widen } from '../widen';

/** The 6502's explanations: the cycle, addressing, the ALU and its flags, and the diagram. */
export const explain6502 = {
  mos6502Explain: {
    encodingSummary: (bytes: string, address: string, where: string, cycles: string) =>
      `${bytes} at ${address}, ${where} · cycles: ${cycles}`,
    pastEnd: (pc: string) => `PC is ${pc}, past the last line.`,
    fetch: (
      pc: string,
      line: string,
      opcode: string,
      mnemonic: string,
      mode: string,
      bytes: string,
      next: string
    ) =>
      `PC is ${pc}, where ${line} starts. The CPU reads the opcode there, ${opcode}: ${mnemonic} in the ${mode} mode, ${bytes} in all, so PC moves on to ${next}.`,
    kind: (category: string, mode: string, description: string) =>
      `${category}, ${mode}: ${description}.`,
    reads: (items: string) => `It reads ${items}.`,
    readsMemory: 'It will read a byte from memory.',
    writesMemory: 'It will write a byte to memory.',
    writes: (items: string) => `It writes ${items}.`,
    sets: (flags: string) => `It sets ${flags}.`,
    takes: (cycles: number, pageCross: boolean, branch: boolean) =>
      `It takes ${cycles} cycles${pageCross ? ', one more if indexing crosses a page' : ''}${branch ? ', more if it branches' : ''}.`,
    extraPage: '1 for crossing a page',
    extraBranch: '1 for taking the branch',
    extraBranchPage: '2 for taking the branch into another page',
    cycles: (count: number) => `${count} cycles`,
    cyclesPlus: (count: number, base: number, extras: string) =>
      `${count} cycles: ${base}, plus ${extras}`,
    flags: 'the flags',
    memory: 'memory',
    device: 'a device',
    changed: (items: string) => `It changed ${items}.`,
    changedNothing: 'It changed nothing.',
    direct: 'Run directly, so nothing was fetched.',
    jumpedTo: (pc: string) => `It jumped to ${pc}.`,
    jumped: (pc: string) => `It jumped: PC is now ${pc}.`,
    nextLine: (pc: string) => `PC is at ${pc}, the next line.`,
    zeroPage: (base: string) => `${base}, in the zero page`,
    zeroPageIndexed: (sum: string, address: string) =>
      `${sum} = ${address}, wrapping within the zero page`,
    intoPage: (page: string) => `, into page ${page}`,
    indexedIndirect: (sum: string, at: string, address: string) =>
      `${sum} = ${at}; the pointer there holds ${address}`,
    indirectIndexed: (base: string, pointer: string, rest: string) =>
      `The pointer at ${base} holds ${pointer}${rest}`,
    indirectBug: (page: string) => `, its high byte read from ${page}: the NMOS bug`,
    indirect: (base: string, address: string, bug: string) =>
      `The address stored at ${base} is ${address}${bug}`,
    devices: {
      leds: 'the LEDs',
      switches: 'the switches',
      leftDigit: 'the left digit',
      rightDigit: 'the right digit',
      terminal: 'the terminal',
      other: 'a device'
    },
    inCode: 'in the code',
    wrote: (value: string, where: string) => `Wrote ${value} to ${where}`,
    read: (value: string, where: string) => `Read ${value} from ${where}`
  },
  mos6502Alu: {
    flagsOnly: 'only the flags are kept',
    into: (register: string) => `into ${register}`,
    backTo: (address: string) => `back to ${address}`,
    decimal: 'decimal (BCD) digits',
    borrow: 'the carry in is 1 − C, the borrow',
    bitNote: 'N and V come from the byte itself',
    rotate: (carry: number) => `C goes in (was ${carry})`,
    carryAlone: 'C is left alone',
    borrowMark: '(borrow)',
    direct: {
      clc: 'CLC cleared C',
      sec: 'SEC set C',
      cli: 'CLI cleared I: interrupts can come in',
      sei: 'SEI set I: interrupts are held off',
      cld: 'CLD cleared D: binary arithmetic',
      sed: 'SED set D: ADC and SBC work in decimal',
      clv: 'CLV cleared V',
      brk: 'BRK set I, so another interrupt waits',
      plp: 'PLP pulled P from the stack',
      rti: 'RTI pulled P from the stack'
    },
    bit7OfByte: (bit: number) => `bit 7 of the byte is ${bit}`,
    decimalNV:
      'in decimal mode the NMOS 6502 takes N from the sum before its high digit is adjusted',
    bit7Of: (value: string, bit: number) => `bit 7 of ${value} is ${bit}`,
    andByte: (value: string, zero: boolean) => `A AND the byte is ${value}${zero ? ': zero' : ''}`,
    decimalZ: (value: string) =>
      `in decimal mode the NMOS 6502 takes Z from the binary sum, not from ${value}`,
    zero: (value: string) => `the result ${value} is zero`,
    notZero: (value: string) => `the result ${value} is not zero`,
    atLeast: (a: string, b: string) => `${a} ≥ ${b} (unsigned)`,
    below: (a: string, b: string) => `${a} < ${b} (unsigned)`,
    noBorrow: 'no borrow was needed',
    borrowed: 'a borrow was needed',
    shiftedOut: (bit: number) => `the bit shifted out was ${bit}`,
    carried: 'the sum carried out of bit 7',
    fit: 'the sum fit in 8 bits',
    bit6: (bit: number) => `bit 6 of the byte is ${bit}`,
    decimalV:
      'in decimal mode the NMOS 6502 takes V from the sum before its high digit is adjusted',
    overflowed: 'as signed numbers the result does not fit: it overflowed',
    fits: 'as signed numbers the result fits'
  },
  mos6502Diagram: {
    idle: 'idle',
    readOpcode: (opcode: string, address: string) => `Read the opcode ${opcode} from ${address}`,
    willSet: (flags: string) => `will set ${flags}`,
    willAddress: 'will work out the address',
    willWrite: 'will write a byte',
    willRead: 'will read a byte'
  },
  mos6502Flags: {
    N: { label: 'Negative', description: 'Bit 7 of the result' },
    V: { label: 'Overflow', description: 'The signed result does not fit, or bit 6 for BIT' },
    D: { label: 'Decimal', description: 'ADC and SBC add and subtract decimal digits' },
    I: { label: 'Interrupt disable', description: 'Interrupt requests are held off' },
    Z: { label: 'Zero', description: 'The result is zero' },
    C: { label: 'Carry', description: 'A carry out of bit 7; for SBC and CMP, no borrow' }
  }
};

export type Explain6502Messages = Widen<typeof explain6502>;
