import { solve, type AluSolution, type Width } from './alu';
import {
  bitOf,
  evaluate,
  numberFrom,
  type Bit,
  type Circuit,
  type Gate,
  type Signals
} from './gates';
import { solveRegister, type RegisterSolution } from './register';

/** What decides where a program counter goes at the end of an instruction. */
export interface PcRequest {
  width: Width;
  /** The address of the instruction that ran. */
  held: number;
  /** The size of an instruction, added to reach the one after it. */
  step: number;
  /** The distance the instruction carries, added to reach where a branch or a jump goes. */
  offset: number;
  /** An address worked out elsewhere (in the ALU), for a jump through a register. */
  computed: number;
  /** The instruction was fetched from the program, so the counter moves on whatever it does. */
  fetched: Bit;
  /** The instruction is a branch: it goes to the target only when `taken`. */
  branch: Bit;
  taken: Bit;
  /** The instruction always goes somewhere else. */
  jump: Bit;
  /** It goes to the computed address, not to the target. */
  jumpComputed: Bit;
}

/** The names of the wires that choose the next address. */
export const PC = {
  fetched: 'fetched',
  branch: 'branch',
  taken: 'taken',
  jump: 'jump',
  jumpComputed: 'jumpComputed',
  /** A branch that is taken. */
  branchTaken: 'branchTaken',
  /** 1 sends the counter to the target, 0 to the next instruction. */
  redirect: 'redirect',
  /** 1 lets the counter load at the clock edge. */
  load: 'load',
  next: (bit: number) => `next${bit}`,
  target: (bit: number) => `target${bit}`,
  computed: (bit: number) => `computed${bit}`,
  /** The next instruction or the target, chosen by `redirect`. */
  reached: (bit: number) => `reached${bit}`,
  /** What waits at the counter's input. */
  chosen: (bit: number) => `chosen${bit}`
};

function chooserBit(bit: number): Gate[] {
  return [
    { id: PC.reached(bit), kind: 'mux', inputs: [PC.redirect, PC.next(bit), PC.target(bit)] },
    {
      id: PC.chosen(bit),
      kind: 'mux',
      inputs: [PC.jumpComputed, PC.reached(bit), PC.computed(bit)]
    }
  ];
}

/** The gates that choose the next address: three lines, and two switches per bit. */
export function pcChooser(width: number): Circuit {
  const bits = Array.from({ length: width }, (_, bit) => bit);
  return {
    inputs: [
      PC.fetched,
      PC.branch,
      PC.taken,
      PC.jump,
      PC.jumpComputed,
      ...bits.map(PC.next),
      ...bits.map(PC.target),
      ...bits.map(PC.computed)
    ],
    gates: [
      { id: PC.branchTaken, kind: 'and', inputs: [PC.branch, PC.taken] },
      { id: PC.redirect, kind: 'or', inputs: [PC.branchTaken, PC.jump] },
      { id: PC.load, kind: 'or', inputs: [PC.fetched, PC.redirect] },
      ...bits.flatMap(chooserBit)
    ]
  };
}

/** A program counter taken through the end of one instruction, part by part. */
export interface PcSolution {
  request: PcRequest;
  /** The adder that works out the address of the next instruction. */
  next: AluSolution;
  /** The adder that works out where a branch or a jump goes. */
  target: AluSolution;
  chooser: Circuit;
  signals: Signals;
  /** The address the chooser put at the counter's input. */
  chosen: number;
  /** The counter itself, through one clock cycle. */
  register: RegisterSolution;
}

function chooserInputs(request: PcRequest, next: number, target: number): Record<string, Bit> {
  const inputs: Record<string, Bit> = {
    [PC.fetched]: request.fetched,
    [PC.branch]: request.branch,
    [PC.taken]: request.taken,
    [PC.jump]: request.jump,
    [PC.jumpComputed]: request.jumpComputed
  };
  for (let bit = 0; bit < request.width; bit++) {
    inputs[PC.next(bit)] = bitOf(next, bit);
    inputs[PC.target(bit)] = bitOf(target, bit);
    inputs[PC.computed(bit)] = bitOf(request.computed, bit);
  }
  return inputs;
}

/** Works out both addresses, chooses one, and clocks it into the counter. */
export function solvePc(request: PcRequest): PcSolution {
  const { width, held, step, offset } = request;
  const next = solve({ kind: 'add', width, a: held, b: step, carryIn: 0 });
  const target = solve({ kind: 'add', width, a: held, b: offset, carryIn: 0 });
  const chooser = pcChooser(width);
  const signals = evaluate(chooser, chooserInputs(request, next.result, target.result));
  const chosen = numberFrom(signals, PC.chosen, width);
  const enabled = signals[PC.load] ? 2 ** width - 1 : 0;
  return {
    request,
    next,
    target,
    chooser,
    signals,
    chosen,
    register: solveRegister({ width, held, input: chosen, enabled })
  };
}
