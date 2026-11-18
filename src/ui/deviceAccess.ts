import { formatHex } from '@/core/shared/numbers';

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
