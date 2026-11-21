import { describe, expect, it } from 'vitest';
import { execute } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import { createCpuState } from '@/core/x86/state';
import { useCpuHistory } from './useCpuHistory';

const nop: Instruction = { mnemonic: 'nop', operands: [] };

describe('lastAfter', () => {
  it('is the CPU as the last instruction left it, whatever moves IP afterwards', () => {
    const cpu = createCpuState();
    const history = useCpuHistory(cpu);
    history.record([execute(cpu, nop, 0)]);
    // An edit to the program (a line inserted above) moves IP; the step did not.
    cpu.registers.ip = 2;
    expect(history.lastAfter.value?.registers.ip).toBe(1);

    history.seek(0);
    expect(history.lastAfter.value).toBeNull();
    history.seek(1);
    expect(history.lastAfter.value?.registers.ip).toBe(1);
  });

  it('gives each record of a batch the CPU the next one found', () => {
    const cpu = createCpuState();
    const history = useCpuHistory(cpu);
    const first = execute(cpu, nop, 0);
    const second = execute(cpu, nop, 1);
    history.record([first, second]);
    expect(history.lastAfter.value?.registers.ip).toBe(2);
    history.seek(1);
    expect(history.lastAfter.value).toBe(second.before);
  });

  it('is gone once the history is cleared', () => {
    const cpu = createCpuState();
    const history = useCpuHistory(cpu);
    history.record([execute(cpu, nop, 0)]);
    history.clear();
    expect(history.lastAfter.value).toBeNull();
  });
});
