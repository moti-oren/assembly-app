import { describe, expect, it } from 'vitest';
import { activeTerms } from './decoder';
import {
  addressDecoder,
  addressWidth,
  FILE,
  solveRegisterFile,
  type RegisterFileRequest
} from './registerFile';

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

const HELD = [0x10, 0x21, 0x32, 0x43, 0x54, 0x65, 0x76, 0x87];

const file = (over: Partial<RegisterFileRequest> = {}): RegisterFileRequest => ({
  width: 8,
  held: HELD,
  input: 0xee,
  address: 0,
  write: 1,
  zeroWired: false,
  ...over
});

/** What the registers should hold after the clock edge. */
function expected({ held, input, address, write, zeroWired }: RegisterFileRequest): number[] {
  return held.map((value, index) => {
    if (zeroWired && index === 0) return 0;
    return write && index === address ? input : value;
  });
}

describe('addressDecoder', () => {
  it('has a gate per register, each reading every address bit and the write line', () => {
    const shape = addressDecoder(8, false);
    expect(shape.inputs).toEqual(['a0', 'a1', 'a2', 'we']);
    expect(shape.terms).toHaveLength(8);
    expect(shape.terms[5].match).toEqual({ a0: 1, a1: 0, a2: 1, we: 1 });
  });

  it('has no gate for a register wired to 0', () => {
    const shape = addressDecoder(32, true);
    expect(shape.terms).toHaveLength(31);
    expect(shape.terms[0].id).toBe(FILE.load(1));
  });

  it('refuses a count that an address cannot name exactly', () => {
    expect(addressWidth(32)).toBe(5);
    expect(() => addressWidth(6)).toThrow();
  });
});

describe('solveRegisterFile', () => {
  it.each(HELD.map((_, address) => address))('address %i loads its register alone', (address) => {
    const solution = solveRegisterFile(file({ address }));
    expect(activeTerms(solution.decoder)).toEqual([FILE.load(address)]);
    expect(solution.loads.indexOf(1)).toBe(address);
    expect(solution.loads.filter((load) => load === 1)).toHaveLength(1);
    expect(solution.stored).toEqual(expected(solution.request));
  });

  it('loads no register while the write line is 0', () => {
    const solution = solveRegisterFile(file({ address: 3, write: 0 }));
    expect(solution.loads).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(solution.stored).toEqual(HELD);
  });

  it('loses a write to the register wired to 0', () => {
    const solution = solveRegisterFile(file({ zeroWired: true }));
    expect(solution.registers[0]).toBeNull();
    expect(solution.loads).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(solution.decoder.signals.none).toBe(1);
    expect(solution.stored).toEqual([0, ...HELD.slice(1)]);
  });

  it('agrees with the registers worked out directly, 32 of 32 bits', () => {
    const next = random(4099);
    for (let i = 0; i < 6; i++) {
      const request: RegisterFileRequest = {
        width: 32,
        held: Array.from({ length: 32 }, (_, index) => (index === 0 ? 0 : next())),
        input: next(),
        address: next() % 32,
        write: next() % 4 === 0 ? 0 : 1,
        zeroWired: true
      };
      expect(solveRegisterFile(request).stored).toEqual(expected(request));
    }
  });
});
