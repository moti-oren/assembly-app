import { PORTS } from '@/core/shared/devices';
import type { ExecutionRecord as SharedRecord } from '@/core/shared/executionRecord';
import type { Program } from '@/core/shared/program';
import type { ExecutionRecord as Mos6502Record } from '@/core/mos6502/executionContext';
import { flagBit, type CpuState as Mos6502State } from '@/core/mos6502/state';
import type { ExecutionRecord as Rv32Record } from '@/core/rv32/execute';
import type { Instruction as Rv32Instruction } from '@/core/rv32/instructions';
import { pipelineTiming, type PipelineTiming } from '@/core/rv32/pipeline';
import { RA, ZERO } from '@/core/rv32/registers';
import type { CpuState as Rv32State } from '@/core/rv32/state';
import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { isFlagSet } from '@/core/x86/flags';
import { INSTRUCTIONS } from '@/core/x86/instructions';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuSnapshot } from '@/core/x86/state';
import type { SoundName } from './soundPalette';

/** What one executed instruction sounds like. Every register shares one sound on purpose. */
export type StepSound = Extract<
  SoundName,
  | 'register'
  | 'memory'
  | 'push'
  | 'pop'
  | 'jump-forward'
  | 'jump-back'
  | 'no-jump'
  | 'call'
  | 'ret'
  | 'flags'
  | 'idle'
>;

/** Picks the sound for an instruction from what it actually did, given the CPU right after it. */
export function stepSound(record: ExecutionRecord, after: CpuSnapshot): StepSound {
  const { mnemonic } = record.instruction;
  const { before } = record;

  if (mnemonic === 'call' || record.interrupt !== null) return 'call';
  if (mnemonic === 'ret' || mnemonic === 'iret') return 'ret';
  if (INSTRUCTIONS[mnemonic].category === 'control') {
    // A line run directly leaves IP alone, so "not taken" means IP did not move.
    const from = record.line ?? before.registers.ip;
    const fallThrough = record.line === null ? before.registers.ip : record.line + 1;
    if (after.registers.ip === fallThrough) return 'no-jump';
    return after.registers.ip > from ? 'jump-forward' : 'jump-back';
  }
  const { stack } = decode(record.instruction);
  if (stack) return stack;
  if (record.memoryWrites.length > 0 || record.portWrites.length > 0) return 'memory';

  if (changedRegisters(before.registers, after.registers).some((name) => name !== 'ip')) {
    return 'register';
  }
  if (before.flags !== after.flags) return 'flags';
  return 'idle';
}

/** True when this instruction is the one that raised OF: the moment a signed result broke. */
export function raisedOverflow(record: ExecutionRecord, after: CpuSnapshot): boolean {
  return !isFlagSet(record.before.flags, 'OF') && isFlagSet(after.flags, 'OF');
}

/** What one RISC-V instruction sounds like: JAL with ra is a call, JALR to ra a return. */
export function rv32StepSound(record: Rv32Record, after: Rv32State): StepSound {
  const { mnemonic, operands } = record.instruction;
  const [first, second] = operands;
  if (mnemonic === 'jal' && first.type === 'reg' && first.index === RA) return 'call';
  const returns =
    mnemonic === 'jalr' && first.type === 'reg' && first.index === ZERO && second.type === 'mem';
  if (returns && second.base === RA) return 'ret';
  const { pc } = after.registers;
  const from = record.before.registers.pc;
  const fallThrough = record.line === null ? from : from + 4;
  if (record.comparison && !record.comparison.taken) return 'no-jump';
  if (pc !== fallThrough) return pc > from ? 'jump-forward' : 'jump-back';
  if (record.access?.write) return 'memory';
  const changed = Object.keys(after.registers).some(
    (key) => key !== 'pc' && after.registers[key as 'x1'] !== record.before.registers[key as 'x1']
  );
  return changed ? 'register' : 'idle';
}

/** What one 6502 instruction sounds like: JSR is a call, RTS and RTI returns, PHA and PLA the stack. */
export function mos6502StepSound(record: Mos6502Record, after: Mos6502State): StepSound {
  const { mnemonic } = record.instruction;
  if (mnemonic === 'jsr' || mnemonic === 'brk') return 'call';
  if (mnemonic === 'rts' || mnemonic === 'rti') return 'ret';
  if (mnemonic === 'pha' || mnemonic === 'php') return 'push';
  if (mnemonic === 'pla' || mnemonic === 'plp') return 'pop';
  if (record.branch) {
    if (!record.branch.taken) return 'no-jump';
    return after.registers.pc > record.before.registers.pc ? 'jump-forward' : 'jump-back';
  }
  if (mnemonic === 'jmp') {
    return after.registers.pc > record.before.registers.pc ? 'jump-forward' : 'jump-back';
  }
  if (record.access?.write) return 'memory';
  const changed = (['a', 'x', 'y', 'sp'] as const).some(
    (name) => after.registers[name] !== record.before.registers[name]
  );
  if (changed) return 'register';
  return after.flags !== record.before.flags ? 'flags' : 'idle';
}

/** What the output devices sound like when an instruction changed them: each kind at most once. */
export function deviceSounds(record: SharedRecord): SoundName[] {
  const sounds = new Set<SoundName>();
  for (const write of record.portWrites) {
    if (write.port === PORTS.terminal) sounds.add('terminal');
    else if (write.before !== write.after) sounds.add('led');
  }
  return [...sounds];
}

/** One executed instruction: what it did, and anything laid over that. */
export interface StepSounds {
  step: SoundName;
  layers: SoundName[];
}

export function x86Sounds(record: ExecutionRecord, after: CpuSnapshot): StepSounds {
  return {
    step: stepSound(record, after),
    layers: raisedOverflow(record, after) ? ['overflow'] : []
  };
}

export function mos6502Sounds(record: Mos6502Record, after: Mos6502State): StepSounds {
  const raisedV = !(record.before.flags & flagBit('V')) && (after.flags & flagBit('V')) !== 0;
  return { step: mos6502StepSound(record, after), layers: raisedV ? ['overflow'] : [] };
}

/**
 * What the newest instruction cost or saved in RISC-V's pipeline: a wait in ID or a flush behind
 * a taken branch is a stall, and an operand handed over early is a forward.
 */
function pipelineCue(timing: PipelineTiming): 'stall' | 'forward' | null {
  const row = [...timing.rows].reverse().find((candidate) => candidate.step !== null);
  if (!row) return null;
  if (row.hazard || row.taken) return 'stall';
  return row.forwards.length > 0 ? 'forward' : null;
}

/**
 * A RISC-V instruction on its own, or as the pipeline chart shows it: there every instruction
 * is one tick of the clock, and only what the overlap did to it stands out.
 */
export function rv32Sounds(
  history: readonly Rv32Record[],
  after: Rv32State,
  program: Program<Rv32Instruction>,
  pipeline: { shown: boolean; forwarding: boolean }
): StepSounds {
  const record = history.at(-1);
  if (!record) return { step: 'idle', layers: [] };
  if (!pipeline.shown) return { step: rv32StepSound(record, after), layers: [] };
  const cue = pipelineCue(pipelineTiming(history, program, { forwarding: pipeline.forwarding }));
  return { step: 'pipeline-tick', layers: cue ? [cue] : [] };
}
