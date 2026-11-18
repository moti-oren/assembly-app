import { formatHex } from '@/core/shared/numbers';
import { formatHex32 } from '@/core/rv32/bits';
import { DEVICE_BASE } from '@/core/rv32/state';

/** How a CPU reaches the devices: with I/O instructions and port numbers, or through memory. */
export interface DeviceAccess {
  /** The instruction that writes a device, and the one that reads it. */
  write: string;
  read: string;
  /** What a device's number is called. */
  noun: string;
  /** The number of one device register, as an instruction names it. */
  address: (port: number) => string;
}

export const X86_DEVICE_ACCESS: DeviceAccess = {
  write: 'out',
  read: 'in',
  noun: 'port',
  address: (port) => `${formatHex(port, 8)}h`
};

/** RISC-V has no I/O instructions: the devices are bytes of memory from DEVICE_BASE up. */
export const RV32_DEVICE_ACCESS: DeviceAccess = {
  write: 'sb',
  read: 'lbu',
  noun: 'device address',
  address: (port) => `0x${formatHex32(DEVICE_BASE + port)}`
};
