import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { createIo } from '@/core/shared/state';
import { deviceByte, formatAddress, memoryRows } from './flatMemory';

describe('flat memory', () => {
  it('writes addresses as each architecture does', () => {
    expect(formatAddress({ prefix: '0x', digits: 8 }, 0x10000)).toBe('0x00010000');
    expect(formatAddress({ prefix: '$', digits: 4 }, 0x200)).toBe('$0200');
  });

  it('shows what an input device presents and what an output device was given', () => {
    const io = createIo();
    io.in[PORTS.switches] = 0x42;
    io.out[PORTS.switches] = 0x99;
    io.out[PORTS.leds] = 0x81;
    expect(deviceByte(io, PORTS.switches)).toBe(0x42);
    expect(deviceByte(io, PORTS.leds)).toBe(0x81);
  });

  it('starts at the row the address falls in', () => {
    const rows = memoryRows((address) => ({ address, value: 0, region: 'ram' }), 0x213, 2);
    expect(rows.map((row) => row[0].address)).toEqual([0x210, 0x220]);
    expect(rows[1].at(-1)?.address).toBe(0x22f);
  });
});
