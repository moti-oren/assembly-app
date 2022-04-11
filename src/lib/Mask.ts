export default class Mask {
  static asLow8Bit (value: number): number {
    return value & 0xff;
  }

  static asHigh8Bit (value: number): number {
    return this.asLow8Bit(value >> 8);
  }

  static join8Bit (high: number, low: number): number {
    return this.asLow8Bit((high << 4) | low);
  }

  static asLow16Bit (value: number): number {
    return value & 0xffff;
  }

  static asHigh16Bit (value: number): number {
    return this.asLow16Bit(value >> 16);
  }

  static join16Bit (high: number, low: number): number {
    return this.asLow16Bit((high << 8) | low);
  }
}
