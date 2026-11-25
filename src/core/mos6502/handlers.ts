import { add, compare, shift, subtract, type ShiftMnemonic } from './alu';
import type { Run } from './executionContext';
import type { Mnemonic } from './instructions';
import { addressOfLine } from './layout';
import { hex, type Operand } from './operands';
import {
  FLAG_BREAK,
  FLAG_UNUSED,
  flagBit,
  getFlag,
  IRQ_VECTOR,
  loadedFlags,
  setFlag,
  setNZ,
  type FlagName
} from './state';

type Handler = (run: Run, operand: Operand | undefined) => void;

type Register = 'a' | 'x' | 'y';

const load =
  (register: Register): Handler =>
  (run, operand) => {
    const value = run.value(operand!);
    run.set(register, value);
    setNZ(run.state, value);
  };

const store =
  (register: Register): Handler =>
  (run, operand) =>
    run.store(run.address(operand!), run.get(register));

/** A register-to-register copy; every one sets N and Z except TXS, which loads SP. */
const transfer =
  (from: Register | 'sp', to: Register | 'sp'): Handler =>
  (run) => {
    const value = run.get(from);
    run.set(to, value);
    if (to !== 'sp') setNZ(run.state, value);
  };

const step =
  (register: Register, by: 1 | -1): Handler =>
  (run) => {
    const before = run.get(register);
    const result = (before + by) & 0xff;
    run.alu(
      { operation: 'step', a: before, b: 1, carryIn: false, decimal: false },
      {
        result,
        carry: false,
        zero: result === 0,
        negative: (result & 0x80) !== 0,
        overflow: false
      },
      'NZ'
    );
    run.set(register, result);
  };

/** INC and DEC on memory: read the byte, change it, write it back. */
const stepMemory =
  (by: 1 | -1): Handler =>
  (run, operand) => {
    const address = run.address(operand!);
    const before = run.readByte(address);
    const result = (before + by) & 0xff;
    run.alu(
      { operation: 'step', a: before, b: 1, carryIn: false, decimal: false },
      {
        result,
        carry: false,
        zero: result === 0,
        negative: (result & 0x80) !== 0,
        overflow: false
      },
      'NZ'
    );
    run.rewrite(address, before, result);
  };

const arithmetic =
  (kind: 'add' | 'subtract'): Handler =>
  (run, operand) => {
    const a = run.get('a');
    const b = run.value(operand!);
    const carryIn = getFlag(run.state, 'C');
    const decimal = getFlag(run.state, 'D');
    const result = (kind === 'add' ? add : subtract)(a, b, carryIn, decimal);
    run.alu({ operation: kind, a, b, carryIn, decimal }, result, 'NZCV');
    run.set('a', result.result);
  };

const comparison =
  (register: Register): Handler =>
  (run, operand) => {
    const a = run.get(register);
    const b = run.value(operand!);
    run.alu({ operation: 'compare', a, b, carryIn: true, decimal: false }, compare(a, b), 'NZC');
  };

const logic =
  (combine: (a: number, b: number) => number): Handler =>
  (run, operand) => {
    const a = run.get('a');
    const b = run.value(operand!);
    const result = combine(a, b) & 0xff;
    run.alu(
      { operation: 'logic', a, b, carryIn: false, decimal: false },
      {
        result,
        carry: false,
        zero: result === 0,
        negative: (result & 0x80) !== 0,
        overflow: false
      },
      'NZ'
    );
    run.set('a', result);
  };

/** BIT: Z from A AND the byte, but N and V straight from the byte's bits 7 and 6. */
const bit: Handler = (run, operand) => {
  const a = run.get('a');
  const b = run.value(operand!);
  run.alu(
    { operation: 'bit', a, b, carryIn: false, decimal: false },
    {
      result: a & b,
      carry: false,
      zero: (a & b) === 0,
      negative: (b & 0x80) !== 0,
      overflow: (b & 0x40) !== 0
    },
    'NZV'
  );
};

const shiftOperation =
  (mnemonic: ShiftMnemonic): Handler =>
  (run, operand) => {
    const carryIn = getFlag(run.state, 'C');
    const onA = !operand || operand.type === 'acc';
    const address = onA ? null : run.address(operand);
    const value = address === null ? run.get('a') : run.readByte(address);
    const result = run.alu(
      { operation: 'shift', a: value, b: 1, carryIn, decimal: false },
      shift(mnemonic, value, carryIn),
      'NZC'
    );
    if (address === null) run.set('a', result.result);
    else run.rewrite(address, value, result.result);
  };

const branch =
  (flag: FlagName, when: boolean): Handler =>
  (run, operand) =>
    run.branch(flag, getFlag(run.state, flag) === when, (operand as { target: number }).target);

const flagTo =
  (flag: FlagName, on: boolean): Handler =>
  (run) =>
    setFlag(run.state, flag, on);

function pushWord(run: Run, value: number): void {
  run.push(value >> 8);
  run.push(value & 0xff);
}

function pullWord(run: Run): number {
  const low = run.pull();
  return low | (run.pull() << 8);
}

export const HANDLERS: Record<Mnemonic, Handler> = {
  lda: load('a'),
  ldx: load('x'),
  ldy: load('y'),
  sta: store('a'),
  stx: store('x'),
  sty: store('y'),
  tax: transfer('a', 'x'),
  tay: transfer('a', 'y'),
  txa: transfer('x', 'a'),
  tya: transfer('y', 'a'),
  tsx: transfer('sp', 'x'),
  txs: transfer('x', 'sp'),
  pha: (run) => run.push(run.get('a')),
  php: (run) => run.push(run.state.flags | FLAG_BREAK | FLAG_UNUSED),
  pla: (run) => {
    const value = run.pull();
    run.set('a', value);
    setNZ(run.state, value);
  },
  plp: (run) => {
    run.state.flags = loadedFlags(run.pull());
  },
  adc: arithmetic('add'),
  sbc: arithmetic('subtract'),
  cmp: comparison('a'),
  cpx: comparison('x'),
  cpy: comparison('y'),
  inc: stepMemory(1),
  dec: stepMemory(-1),
  inx: step('x', 1),
  iny: step('y', 1),
  dex: step('x', -1),
  dey: step('y', -1),
  and: logic((a, b) => a & b),
  ora: logic((a, b) => a | b),
  eor: logic((a, b) => a ^ b),
  bit,
  asl: shiftOperation('asl'),
  lsr: shiftOperation('lsr'),
  rol: shiftOperation('rol'),
  ror: shiftOperation('ror'),
  jmp: (run, operand) =>
    run.jump(
      operand!.type === 'label'
        ? addressOfLine(run.program, operand!.target)
        : run.address(operand!)
    ),
  // JSR pushes the address of its own last byte, one short of the next instruction.
  jsr: (run, operand) => {
    pushWord(run, (run.next - 1) & 0xffff);
    run.jump(addressOfLine(run.program, (operand as { target: number }).target));
  },
  // JSR kept the address of its own last byte: RTS adds the 1, so both numbers are named.
  rts: (run) => {
    const pulled = pullWord(run);
    const address = (pulled + 1) & 0xffff;
    run.jump(
      address,
      `RTS pulled $${hex(pulled, 4)} from the stack and added 1, $${hex(address, 4)}`
    );
  },
  bcc: branch('C', false),
  bcs: branch('C', true),
  beq: branch('Z', true),
  bne: branch('Z', false),
  bmi: branch('N', true),
  bpl: branch('N', false),
  bvc: branch('V', false),
  bvs: branch('V', true),
  clc: flagTo('C', false),
  sec: flagTo('C', true),
  cli: flagTo('I', false),
  sei: flagTo('I', true),
  cld: flagTo('D', false),
  sed: flagTo('D', true),
  clv: flagTo('V', false),
  // BRK pushes the address two bytes on, past its signature byte, and P with B set.
  brk: (run) => {
    pushWord(run, (run.here + 2) & 0xffff);
    run.push(run.state.flags | FLAG_BREAK | FLAG_UNUSED);
    run.state.flags |= flagBit('I');
    const vector = run.readByte(IRQ_VECTOR) | (run.readByte(IRQ_VECTOR + 1) << 8);
    run.jump(vector, `BRK read $${hex(vector, 4)} from its vector at $${hex(IRQ_VECTOR, 4)}`);
  },
  rti: (run) => {
    run.state.flags = loadedFlags(run.pull());
    const address = pullWord(run);
    run.jump(address, `RTI took its return address from the stack, $${hex(address, 4)}`);
  },
  nop: () => {}
};
