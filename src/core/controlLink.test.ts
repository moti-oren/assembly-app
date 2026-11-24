import { describe, expect, it } from 'vitest';
import { solveControl } from './controlLink';
import { activeLines } from './logic/decoder';
import { RV32_CONTROL } from './rv32Control';

/** `add a0, a0, a1` and `lw a0, 8(sp)`. */
const ADD = 0x00b50533;
const LW = 0x00812503;

const lines = (word: number, faults = {}) => {
  const { main, alu } = solveControl(RV32_CONTROL, word, faults);
  return [...activeLines(main), ...activeLines(alu)];
};

describe('solveControl with a broken line', () => {
  it('changes nothing when no line is broken', () => {
    expect(solveControl(RV32_CONTROL, ADD, {})).toEqual(solveControl(RV32_CONTROL, ADD));
  });

  it('holds a line at 0 whatever the word asks for', () => {
    expect(lines(ADD)).toContain('regWrite');
    expect(lines(ADD, { regWrite: 0 })).toEqual(lines(ADD).filter((id) => id !== 'regWrite'));
  });

  it('holds a line at 1 for a word that leaves it at 0', () => {
    expect(lines(ADD, { memWrite: 1 }).sort()).toEqual([...lines(ADD), 'memWrite'].sort());
  });

  it('breaks a line of the ALU decoder', () => {
    expect(lines(ADD, { aluSub: 1 })).toContain('aluSub');
  });

  it('carries a fault of the main decoder into the ALU decoder that reads it', () => {
    // A load adds because ALUAdd says so; without it the ALU decoder recognises nothing.
    expect(lines(LW)).toContain('aluSum');
    expect(lines(LW, { aluAdd: 0 })).not.toContain('aluSum');
    // And an ADD told to work out an address still adds, with two terms on.
    expect(lines(ADD, { aluAdd: 1 })).toContain('aluSum');
  });

  it('refuses a name that is no control line', () => {
    expect(() => solveControl(RV32_CONTROL, ADD, { OP: 1 })).toThrow('No control line');
  });
});
