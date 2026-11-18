import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { isFlagSet } from '@/core/x86/flags';
import { INSTRUCTIONS } from '@/core/x86/instructions';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuSnapshot } from '@/core/x86/state';

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
