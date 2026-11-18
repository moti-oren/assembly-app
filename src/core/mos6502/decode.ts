import {
  formatInstruction,
  getSpec,
  modeOfInstruction,
  opcodeOf,
  type Category,
  type Instruction,
  type Mnemonic
} from './instructions';
import { instructionSize } from './layout';
import { MODE_NAMES, type Mode } from './operands';
import type { FlagName, RegisterName } from './state';

/** What a control unit works out from an instruction before it runs. */
export interface Decoded {
  mnemonic: Mnemonic;
  text: string;
  category: Category;
  description: string;
  mode: Mode;
  modeName: string;
  /** Bytes, the opcode included. */
  size: number;
  /** Cycles before any page crossing or taken branch adds to them. */
  cycles: number;
  /** The registers it reads and writes, the index of an indexed mode included. */
  reads: RegisterName[];
  writes: RegisterName[];
  memory: { read: boolean; write: boolean };
  stack: 'push' | 'pull' | null;
  flagsWritten: FlagName[];
  nextPc: 'next' | 'branch' | 'jump';
}

type Use = { reads?: RegisterName[]; writes?: RegisterName[]; flags?: FlagName[] };

const NZ: FlagName[] = ['N', 'Z'];
const ARITHMETIC: FlagName[] = ['N', 'V', 'Z', 'C'];
const COMPARE: FlagName[] = ['N', 'Z', 'C'];
const STACK: Use = { reads: ['sp'], writes: ['sp'] };

// prettier-ignore
const USES: Record<Mnemonic, Use> = {
  lda: { writes: ['a'], flags: NZ }, ldx: { writes: ['x'], flags: NZ }, ldy: { writes: ['y'], flags: NZ },
  sta: { reads: ['a'] }, stx: { reads: ['x'] }, sty: { reads: ['y'] },
  tax: { reads: ['a'], writes: ['x'], flags: NZ }, tay: { reads: ['a'], writes: ['y'], flags: NZ },
  txa: { reads: ['x'], writes: ['a'], flags: NZ }, tya: { reads: ['y'], writes: ['a'], flags: NZ },
  tsx: { reads: ['sp'], writes: ['x'], flags: NZ }, txs: { reads: ['x'], writes: ['sp'] },
  pha: { reads: ['a', 'sp'], writes: ['sp'] }, php: STACK,
  pla: { reads: ['sp'], writes: ['a', 'sp'], flags: NZ }, plp: { ...STACK, flags: ['N', 'V', 'D', 'I', 'Z', 'C'] },
  adc: { reads: ['a'], writes: ['a'], flags: ARITHMETIC }, sbc: { reads: ['a'], writes: ['a'], flags: ARITHMETIC },
  cmp: { reads: ['a'], flags: COMPARE }, cpx: { reads: ['x'], flags: COMPARE }, cpy: { reads: ['y'], flags: COMPARE },
  inc: { flags: NZ }, dec: { flags: NZ },
  inx: { reads: ['x'], writes: ['x'], flags: NZ }, iny: { reads: ['y'], writes: ['y'], flags: NZ },
  dex: { reads: ['x'], writes: ['x'], flags: NZ }, dey: { reads: ['y'], writes: ['y'], flags: NZ },
  and: { reads: ['a'], writes: ['a'], flags: NZ }, ora: { reads: ['a'], writes: ['a'], flags: NZ },
  eor: { reads: ['a'], writes: ['a'], flags: NZ }, bit: { reads: ['a'], flags: ['N', 'V', 'Z'] },
  asl: { flags: COMPARE }, lsr: { flags: COMPARE }, rol: { flags: COMPARE }, ror: { flags: COMPARE },
  jmp: {}, jsr: STACK, rts: STACK,
  bcc: {}, bcs: {}, beq: {}, bne: {}, bmi: {}, bpl: {}, bvc: {}, bvs: {},
  clc: { flags: ['C'] }, sec: { flags: ['C'] }, cli: { flags: ['I'] }, sei: { flags: ['I'] },
  cld: { flags: ['D'] }, sed: { flags: ['D'] }, clv: { flags: ['V'] },
  brk: { ...STACK, flags: ['I'] }, rti: { ...STACK, flags: ['N', 'V', 'D', 'I', 'Z', 'C'] }, nop: {}
};

const INDEX_OF: Partial<Record<Mode, RegisterName>> = {
  zpx: 'x',
  abx: 'x',
  izx: 'x',
  zpy: 'y',
  aby: 'y',
  izy: 'y'
};

const MEMORY_MODES = new Set<Mode>(['zp', 'zpx', 'zpy', 'abs', 'abx', 'aby', 'izx', 'izy']);
const STORES = new Set<Mnemonic>(['sta', 'stx', 'sty']);
/** Instructions that read a byte, change it and write it back. */
const READ_MODIFY_WRITE = new Set<Mnemonic>(['inc', 'dec', 'asl', 'lsr', 'rol', 'ror']);

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function decode(instruction: Instruction): Decoded {
  const { mnemonic } = instruction;
  const { category, description } = getSpec(mnemonic);
  const mode = modeOfInstruction(instruction);
  const use = USES[mnemonic];
  const index = INDEX_OF[mode];
  const onA = mode === 'acc';
  const inMemory = MEMORY_MODES.has(mode);
  const reads = [...(use.reads ?? []), ...(index ? [index] : []), ...(onA ? ['a' as const] : [])];
  const writes = [...(use.writes ?? []), ...(onA ? ['a' as const] : [])];
  return {
    mnemonic,
    text: formatInstruction(instruction),
    category,
    description,
    mode,
    modeName: MODE_NAMES[mode],
    size: instructionSize(instruction),
    cycles: opcodeOf(instruction)!.cycles,
    reads: unique(reads),
    writes: unique(writes),
    memory: {
      read: inMemory && !STORES.has(mnemonic),
      write: inMemory && (STORES.has(mnemonic) || READ_MODIFY_WRITE.has(mnemonic))
    },
    stack: ['pha', 'php', 'jsr', 'brk'].includes(mnemonic)
      ? 'push'
      : ['pla', 'plp', 'rts', 'rti'].includes(mnemonic)
        ? 'pull'
        : null,
    flagsWritten: use.flags ?? [],
    nextPc:
      category === 'branch'
        ? 'branch'
        : category === 'jump' || mnemonic === 'brk' || mnemonic === 'rti'
          ? 'jump'
          : 'next'
  };
}
