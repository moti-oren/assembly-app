import { formatHex } from '@/core/shared/numbers';
import { formatHex32 } from '@/core/rv32/bits';
import { DEVICE_BASE } from '@/core/rv32/state';
import { DEVICE_BASE as MOS6502_DEVICE_BASE } from '@/core/mos6502/state';

/** How a CPU reaches the devices: with I/O instructions and port numbers, or through memory. */
export interface DeviceAccess {
  /** The instruction that writes a device, and the one that reads it. */
  write: string;
  read: string;
  /** What a device's number is called. */
  noun: string;
  /** The number of one device register, as an instruction names it. */
  address: (port: number) => string;
  /** A byte a device holds, in the CPU's own notation: 80h, 0x80 or $80. */
  byte: (value: number) => string;
}

export const X86_DEVICE_ACCESS: DeviceAccess = {
  write: 'out',
  read: 'in',
  noun: 'port',
  address: (port) => `${formatHex(port, 8)}h`,
  byte: (value) => `${formatHex(value, 8)}h`
};

/** RISC-V has no I/O instructions: the devices are bytes of memory from DEVICE_BASE up. */
export const RV32_DEVICE_ACCESS: DeviceAccess = {
  write: 'sb',
  read: 'lbu',
  noun: 'device address',
  address: (port) => `0x${formatHex32(DEVICE_BASE + port)}`,
  byte: (value) => `0x${formatHex(value, 8)}`
};

/** Nor has the 6502: its devices are bytes of memory from $D000 up, reached with STA and LDA. */
export const MOS6502_DEVICE_ACCESS: DeviceAccess = {
  write: 'sta',
  read: 'lda',
  noun: 'device address',
  address: (port) => `$${formatHex(MOS6502_DEVICE_BASE + port, 16)}`,
  byte: (value) => `$${formatHex(value, 8)}`
};
