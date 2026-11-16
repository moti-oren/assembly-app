import type { ExecutionRecord } from '@/core/execute';
import { FLAG_BITS } from '@/core/flags';
import { INSTRUCTIONS } from '@/core/instructions';
import type { WordRegister } from '@/core/registers';

/** What one executed instruction sounds like. Every register shares one sound on purpose. */
export type StepSound =
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
  | 'idle';

/** Sounds that are not one executed instruction. */
export type EventSound = 'undo' | 'ratchet' | 'error' | 'punch' | 'halt' | 'overflow';

export type SoundKind = StepSound | EventSound;

export interface CpuSnapshot {
  registers: Record<WordRegister, number>;
  flags: number;
}

const OF = 1 << FLAG_BITS.OF;

/** Picks the sound for an instruction from what it actually did, given the CPU right after it. */
export function stepSound(record: ExecutionRecord, after: CpuSnapshot): StepSound {
  const { mnemonic } = record.instruction;
  const { before } = record;

  if (mnemonic === 'call') return 'call';
  if (mnemonic === 'ret') return 'ret';
  if (INSTRUCTIONS[mnemonic].category === 'control') {
    // A line run directly leaves IP alone, so "not taken" means IP did not move.
    const from = record.line ?? before.registers.ip;
    const fallThrough = record.line === null ? before.registers.ip : record.line + 1;
    if (after.registers.ip === fallThrough) return 'no-jump';
    return after.registers.ip > from ? 'jump-forward' : 'jump-back';
  }
  if (mnemonic === 'push') return 'push';
  if (mnemonic === 'pop') return 'pop';
  if (record.memoryWrites.length > 0) return 'memory';

  const registers = Object.keys(before.registers) as WordRegister[];
  if (registers.some((name) => name !== 'ip' && before.registers[name] !== after.registers[name])) {
    return 'register';
  }
  if (before.flags !== after.flags) return 'flags';
  return 'idle';
}

/** True when this instruction is the one that raised OF: the moment a signed result broke. */
export function raisedOverflow(record: ExecutionRecord, after: CpuSnapshot): boolean {
  return (record.before.flags & OF) === 0 && (after.flags & OF) !== 0;
}
