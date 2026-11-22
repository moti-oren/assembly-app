import { describe, expect, it } from 'vitest';
import { tap, type AluCircuit } from '@/core/aluLink';
import { solve, type AluRequest } from '@/core/logic/alu';
import { flagRows } from './logicFlags';

const circuit = (request: AluRequest, overrides: Partial<AluCircuit>): AluCircuit => ({
  request,
  taps: [],
  cleared: [],
  resultKept: true,
  note: null,
  ...overrides
});

describe('flagRows', () => {
  const add: AluRequest = { kind: 'add', width: 16, a: 0x7fff, b: 1, carryIn: 0 };

  it('gives each flag its value and the wire it comes from', () => {
    const rows = flagRows(
      circuit(add, { taps: [tap('CF', 'carryOut'), tap('OF', 'overflow')] }),
      solve(add)
    );
    expect(rows).toEqual([
      {
        flag: 'CF',
        value: 0,
        tap: 'carryOut',
        source: 'the carry out of bit 15, the top adder',
        working: null
      },
      {
        flag: 'OF',
        value: 1,
        tap: 'overflow',
        source: 'the carry into bit 15 XOR the carry out of it',
        working: '1 ⊕ 0'
      }
    ]);
  });

  it('puts a NOT in front of a wire the flag inverts', () => {
    const subtract: AluRequest = { kind: 'subtract', width: 8, a: 3, b: 5, carryIn: 1 };
    const [row] = flagRows(
      circuit(subtract, { taps: [tap('CF', 'carryOut', true)] }),
      solve(subtract)
    );
    expect(row).toMatchObject({ value: 1, source: 'NOT (the carry out of bit 7, the top adder)' });
  });

  it('says "not zero" without a double negative', () => {
    const subtract: AluRequest = { kind: 'subtract', width: 32, a: 8, b: 0, carryIn: 1 };
    const [row] = flagRows(
      circuit(subtract, { taps: [tap('taken', 'zero', true)] }),
      solve(subtract)
    );
    expect(row).toMatchObject({ value: 1, source: 'any bit of the result is 1' });
  });

  it('lists the flags an operation always clears, after the connected ones', () => {
    const and: AluRequest = { kind: 'and', width: 8, a: 1, b: 1 };
    const rows = flagRows(circuit(and, { taps: [tap('ZF', 'zero')], cleared: ['CF'] }), solve(and));
    expect(rows.map((row) => [row.flag, row.value, row.tap])).toEqual([
      ['ZF', 0, 'zero'],
      ['CF', 0, null]
    ]);
  });
});
