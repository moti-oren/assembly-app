import type { Widen } from '../widen';

/** "a, b and c": a list as a sentence writes it. */
const list = (items: readonly string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** Wording every explanation shares, and the 8086's own: its cycle, diagram and machine code. */
export const explainX86 = {
  common: {
    list,
    /** Code inside a sentence: an instruction, written as the program writes it. */
    code: (text: string) => text,
    /** Sentences one after another; a language may need more than a space between them. */
    sentences: (parts: readonly (string | false | null)[]) =>
      parts.filter((part) => typeof part === 'string' && part !== '').join(' '),
    bytes: (count: number) => `${count} byte${count === 1 ? '' : 's'}`,
    /** Where the instruction in the machine code panel comes from. */
    where: {
      draft: 'as the next line of the program',
      line: (line: string) => `line ${line}`,
      lastLine: (line: string) => `line ${line}, the last one run`,
      last: 'the last instruction run'
    }
  },
  x86Encoding: {
    summary: (bytes: string, offset: string, where: string) =>
      `${bytes} at offset ${offset}, ${where}`,
    fields: {
      prefix: 'Prefix',
      opcode: 'Opcode',
      modrm: 'ModR/M',
      displacement: 'Displacement',
      immediate: 'Immediate',
      relative: 'Distance'
    }
  },
  x86Cycle: {
    fetch: (line: string, next: string) =>
      `IP points at ${line}. That line is read out of the program, and IP moves on to ${next} before anything runs.`,
    kind: (category: string, size: number | null, description: string) =>
      `${category}${size ? `, ${size}-bit` : ''}: ${description}.`,
    roles: {
      destination: 'destination',
      source: 'source',
      count: 'count',
      target: 'target',
      vector: 'vector',
      operand: 'operand'
    },
    operand: (text: string, role: string, kind: string) => `${text} is the ${role} (${kind})`,
    here: (operands: string) => `Here ${operands}.`,
    willRead: (items: string) => `It will read ${items}.`,
    willWrite: (items: string) => `It will write ${items}.`,
    memory: 'memory',
    port: 'an I/O port',
    flags: 'the flags',
    changed: (items: string) => `It changed ${items}.`,
    changedNothing: 'It changed no register, flag or memory.',
    interrupt: (vector: string) => `It entered interrupt ${vector}.`,
    direct: 'Run directly, so nothing was fetched from the program.',
    jumped: (next: string) => `It jumped: IP is now ${next}.`,
    nextLine: (next: string) => `IP is at ${next}, the next line.`
  },
  x86Notes: {
    aluFetching: 'Waiting: the instruction is still being fetched.',
    aluSelected: 'Selected. The operands go in when the instruction executes.',
    notNeeded: (mnemonic: string) => `Not needed by ${mnemonic}.`,
    aluIdle: 'Run an instruction to see how its result is computed.',
    aluComputed: 'Computed here. The result is in the highlighted registers.',
    notUsed: (mnemonic: string) => `Not used by ${mnemonic}.`,
    adderFetching:
      'Idle: the program is not stored in memory here, so fetching a line forms no address.',
    adderSelected: 'Selected. It will turn segment:offset into a 20-bit address.',
    portNotNeeded: 'Not needed: a port number goes onto the bus as it is.',
    adderIdle: 'Turns segment:offset into the 20-bit address that goes onto the bus.',
    portNotUsed: 'Not used: a port number goes onto the bus as it is.',
    noMemory: (mnemonic: string) => `Not used: ${mnemonic} did not touch memory.`,
    readWritten: 'will be read and written',
    written: 'will be written',
    read: 'will be read',
    unused: 'not used',
    busMemory: (address: string, data: string) => `address ${address}, data ${data}`,
    busPort: (port: string, data: string) => `port ${port}, data ${data}`
  }
};

export type ExplainX86Messages = Widen<typeof explainX86>;
