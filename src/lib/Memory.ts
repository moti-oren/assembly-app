enum SegmentsName {
  stack = 'stack',
  data = 'data',
  bss = 'bss',
  code = 'code'
};

enum MemoryUnit {
  byte = 'b',
  word = 'w',
  doubleword = 'd',
  quadword = 'q'
};

type Segments = {
  [key in SegmentsName]: DataView;
};

export default class Memory {
  constructor(public segments: Segments, private littleEndian: boolean = true) { }

  set (segment: SegmentsName, val: number, position: number, unit: MemoryUnit, sign: boolean) {
    const segmentData = this.segments[segment];
    switch (unit) {
      case MemoryUnit.byte:
        if (sign) {
          segmentData.setInt8(position, val);
        } else {
          segmentData.setUint8(position, val);
        }
        break;
      case MemoryUnit.word:
        if (sign) {
          segmentData.setInt16(position, val, this.littleEndian);
        } else {
          segmentData.setUint16(position, val, this.littleEndian);
        }
        break;
      case MemoryUnit.doubleword:
        if (sign) {
          segmentData.setInt32(position, val, this.littleEndian);
        } else {
          segmentData.setUint32(position, val, this.littleEndian);
        }
        break;
      case MemoryUnit.quadword:
        if (sign) {
          segmentData.setFloat32(position, val, this.littleEndian);
        } else {
          segmentData.setFloat64(position, val, this.littleEndian);
        }
        break;
      default:
        throw new Error('Unknown memory unit');
    }
  }

  get (segment: SegmentsName, val: number, position: number, unit: MemoryUnit, sign: boolean): number {
    const segmentData = this.segments[segment];
    switch (unit) {
      case MemoryUnit.byte:
        if (sign) {
          return segmentData.getInt8(position);
        } else {
          return segmentData.getUint8(position);
        }
      case MemoryUnit.word:
        if (sign) {
          return segmentData.getInt16(position, this.littleEndian);
        } else {
          return segmentData.getUint16(position, this.littleEndian);
        }
      case MemoryUnit.doubleword:
        if (sign) {
          return segmentData.getInt32(position, this.littleEndian);
        } else {
          return segmentData.getUint32(position, this.littleEndian);
        }
      case MemoryUnit.quadword:
        if (sign) {
          return segmentData.getFloat32(position, this.littleEndian);
        } else {
          return segmentData.getFloat64(position, this.littleEndian);
        }
      default:
        throw new Error('Unknown memory unit');
    }
  }
}
