export default class Mask {
  static asLow8Bit (value: number): number {
    return value & 0xff;
  }

  static asHigh8Bit (value: number): number {
    return (value >> 8) & 0xff;
  }

  static join8Bit (high: number, low: number): number {
    return (high << 4) | low;
  }

  static asLow16Bit (value: number): number {
    return value & 0xffff;
  }

  static asHigh16Bit (value: number): number {
    return (value >> 16) & 0xffff;
  }

  static join16Bit (high: number, low: number): number {
    return (high << 8) | low;
  }
}
