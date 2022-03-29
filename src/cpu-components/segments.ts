const dataSegmentBuffer = new Uint8Array(0x10000);
const codeSegmentBuffer = new Uint8Array(0x10000);
const stackSegmentBuffer = new Uint8Array(0x10000);
const bssSegmentBuffer = new Uint8Array(0x10000);

export const segmentsBuffer = {
  data: dataSegmentBuffer,
  code: codeSegmentBuffer,
  stack: stackSegmentBuffer,
  bss: bssSegmentBuffer
};

const dataSegment = new DataView(dataSegmentBuffer.buffer);
const codeSegment = new DataView(codeSegmentBuffer.buffer);
const stackSegment = new DataView(stackSegmentBuffer.buffer);
const bssSegment = new DataView(bssSegmentBuffer.buffer);

export const segments = {
  data: dataSegment,
  code: codeSegment,
  stack: stackSegment,
  bss: bssSegment
};

// TODO: Check which segments are missing
