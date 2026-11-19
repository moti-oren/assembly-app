import type { Widen } from '../widen';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** RISC-V's explanations: the cycle, the ALU and branches, the datapath and the pipeline. */
export const explainRv32 = {
  rv32Explain: {
    encodingSummary: (format: string, address: string, where: string) =>
      `${format}-type, 4 bytes at ${address}, ${where}`,
    nothing: 'nothing',
    fetch: (pc: string, line: string, word: string, next: string) =>
      `PC is ${pc}, where ${line} starts. The CPU reads the 4-byte word there, ${word}, and PC moves on to ${next} before anything runs.`,
    sizes: { 1: 'byte', 2: 'half-word', 4: 'word' },
    kind: (category: string, format: string, description: string) =>
      `${category}, ${format}-type: ${description}.`,
    fields: (fields: string) => `The register fields say ${fields}.`,
    immediate: (hex: string, decimal: number) => `The immediate is ${hex} (${decimal}).`,
    willRead: (items: string) => `It will read ${items}.`,
    willAccess: (access: 'load' | 'store', size: string) => `It will ${access} a ${size}.`,
    willWrite: (items: string) => `It will write ${items}.`,
    branch: 'Whether it jumps depends on the comparison.',
    jump: 'It always jumps.',
    memory: 'memory',
    device: 'a device',
    changed: (items: string) => `It changed ${items}.`,
    changedNothing: 'It changed no register or memory.',
    direct: 'Run directly, so nothing was fetched from the program.',
    jumped: (pc: string) => `It jumped: PC is now ${pc}.`,
    nextLine: (pc: string) => `PC is at ${pc}, the next line.`,
    notes: {
      srl: 'filling with 0',
      sra: 'keeping the sign',
      slt: 'signed: 1 if true, else 0',
      sltu: 'unsigned: 1 if true, else 0',
      mul: 'low 32 bits',
      mulh: 'signed, high 32 bits',
      mulhsu: 'signed × unsigned, high 32 bits',
      mulhu: 'unsigned, high 32 bits',
      div: 'signed',
      divu: 'unsigned',
      rem: 'signed',
      remu: 'unsigned'
    },
    into: (register: string) => `into ${register}`,
    theAddress: 'the address',
    jumpTarget: 'the jump target',
    bitForBit: 'bit for bit',
    asSigned: 'as signed numbers',
    asUnsigned: 'as unsigned numbers',
    taken: (at: string) => `true: jumped to ${at}`,
    notTaken: (at: string) => `false: went on to ${at}`,
    devices: {
      leds: 'the LEDs',
      switches: 'the switches',
      leftDigit: 'the left digit',
      rightDigit: 'the right digit',
      terminal: 'the terminal',
      other: 'a device'
    },
    inCode: 'in the code',
    stored: (size: string, value: string, where: string) =>
      `Stored the ${size} ${value} at ${where}`,
    loaded: (size: string, value: string, where: string) =>
      `Loaded the ${size} ${value} from ${where}`
  },
  datapath: {
    idle: 'idle',
    direct: 'run directly: nothing fetched',
    sources: {
      alu: "the ALU's result",
      memory: 'the loaded value',
      link: 'the link, PC + 4',
      immediate: 'the upper immediate'
    },
    willAccess: (access: 'load' | 'store') => `will ${access}`,
    depends: 'depends on the comparison',
    jumps: 'jumps'
  },
  pipelineNotes: {
    pastEnd: 'past the end',
    load: (source: string) => `the load on ${source} has it only after MEM`,
    noForwarding: (source: string) => `forwarding is off, so ${source} must write it back first`,
    waits: (row: string, cycles: number, register: string, why: string) =>
      `${row} waits ${plural(cycles, 'cycle')} in ID for ${register}: ${why}.`,
    flushes: (row: string) =>
      `${row} changes PC in EX: the two instructions fetched behind it are flushed.`,
    instructions: (count: number) => plural(count, 'instruction'),
    fill: '4 to fill the pipeline',
    stalled: (count: number) => `${count} stalled`,
    flushed: (count: number) => `${count} lost to flushes`,
    summary: (cycles: number, parts: readonly string[], cpi: string) =>
      `${plural(cycles, 'cycle')} = ${parts.join(' + ')} · ${cpi} cycles per instruction`
  }
};

export type ExplainRv32Messages = Widen<typeof explainRv32>;
