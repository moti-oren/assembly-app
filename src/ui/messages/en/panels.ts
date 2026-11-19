import type { Widen } from '../widen';
import type { ByteRegion } from '../../flatMemory';

/** Whether a CPU reaches a device by a port number or by an address in memory. */
type DevicePlace = 'port' | 'address';
const placeName = (place: DevicePlace) => (place === 'port' ? 'port' : 'device address');

/** The panels every architecture shares: program, history, builder, cycle and change marks. */
export const panels = {
  program: {
    title: 'Program',
    empty: 'No lines yet',
    finished: 'Finished',
    next: (line: string) => `Next: ${line}`,
    clear: 'Clear the program',
    lines: 'Program lines',
    insertHere: 'new lines go here ·',
    addAtEnd: 'add at the end instead',
    ranLast: 'Ran last',
    offset: (value: string) => `offset ${value}`,
    address: (value: string) => `address ${value}`,
    codeAt: (place: string) => `Machine code at ${place}. Click to take it apart.`,
    insertAbove: 'Insert new lines above this one',
    remove: 'Delete this line',
    end: 'end of program',
    /** The empty program's prompt, around the keys and the link it holds. */
    startBefore: 'Build an instruction and press',
    startMiddle: 'to add it as a line, or',
    startLink: 'start from an example',
    startAfter: '.'
  },
  history: {
    title: 'History',
    about: 'About the history',
    intro:
      'Every instruction you run appears here. Pick one to go back to the moment after it ran.',
    empty: 'Nothing executed yet',
    executed: (count: number) => `${count} executed`,
    position: (at: number, total: number) => `At ${at} of ${total}`,
    hidden: (count: number) => `${count} earlier instructions are not shown.`,
    direct: 'direct',
    directHint: 'Run from the builder, not from the program'
  },
  builder: {
    title: 'Instruction',
    removeWord: 'Remove this word and the ones after it',
    ready: 'Ready to run',
    input: 'Instruction',
    clear: 'Clear the instruction',
    enterPicks: 'Enter picks this',
    /** "Nothing matches “x”. Press Backspace to edit it or Esc to start over." around the keys. */
    noMatchBefore: 'Nothing matches',
    noMatchPress: '. Press',
    noMatchEdit: 'to edit it or',
    noMatchAfter: 'to start over.',
    showChoices: 'Show the choices',
    complete: 'Complete. Run it now, or add it to the program at line',
    addAt: (line: string) => `Add at ${line}`,
    runNow: 'Run now',
    keys: {
      move: 'move',
      run: 'run now',
      add: 'add',
      pick: 'pick',
      clear: 'clear'
    }
  },
  cycle: {
    title: 'Cycle',
    about: 'About the instruction cycle',
    phases: 'Instruction cycle',
    idle: 'idle',
    nothingYet: 'Nothing has run yet.',
    x86Intro:
      'Every instruction is fetched, decoded, then executed. Use the Fetch button below to walk a program line through the three phases.'
  },
  changes: {
    none: 'Run an instruction to see what it changes',
    nothing: 'changed nothing',
    writtenSame: '(written, value unchanged)'
  },
  operation: {
    flagsOnly: 'only the flags are kept',
    into: (destination: string) => `into ${destination}`,
    none: 'Run an instruction to see how its result was computed.',
    aluUnused: 'The ALU was not used.'
  },
  flags: {
    title: 'Flags',
    value: (flag: string, value: number) => `${flag} flag is ${value}`,
    unchanged: (flag: string) => `${flag} unchanged`
  },
  memory: {
    title: 'Memory',
    about: 'About memory',
    x86Intro:
      'Point at a byte, or run an instruction that uses memory, to see how its address is formed.',
    segment: 'Segment',
    offset: 'Offset',
    offsetInput: 'Offset (hex)',
    stackTop: 'Stack top',
    badOffset: (text: string) =>
      `“${text}” isn't a hex offset (use 0–9 and A–F, e.g. 1F0). Showing 0000.`,
    thisByte: 'This byte',
    lastWrite: 'Last write',
    lastRead: 'Last read',
    shifted: (segment: string) => `${segment} shifted left by 4 bits`,
    wraps: 'wraps past 1MB to',
    wraps64k: (sum: string) => `${sum}, wraps at 64K`,
    showInTable: 'Show in table',
    physical: (address: string, value: number) => `Physical ${address}h = ${value}`,
    blue: 'blue',
    blueMeans: "the program's machine code,",
    amber: 'amber',
    amberMeans: 'device registers.',
    goTo: 'Go to',
    places: {
      code: 'Code',
      data: 'Data',
      stack: 'Stack',
      devices: 'Devices',
      zeroPage: 'Zero page',
      vectors: 'Vectors'
    },
    addressInput: 'Address (hex)',
    addressColumn: 'address',
    badAddress: (text: string, zero: string) =>
      `“${text}” isn't a hex address (use 0–9 and A–F). Showing ${zero}.`,
    unwired: (address: string) => `${address}: nothing is wired here`,
    byte: (address: string, value: number, region: ByteRegion | null) =>
      `${address} = ${value}${region === 'code' ? ', machine code' : region === 'device' ? ', a device' : ''}`
  },
  devices: {
    title: 'I/O devices',
    about: 'About the devices',
    writes: (place: DevicePlace) => `writes to a ${placeName(place)},`,
    reads: 'reads one.',
    leds: 'LEDs',
    led: (bit: number, on: boolean) => `LED ${bit} is ${on ? 'on' : 'off'}`,
    bit: (bit: number) => `Bit ${bit}`,
    switches: 'Switches',
    switch: (bit: number) => `Switch ${bit}`,
    display: '7-segment display',
    segments: '7-segment',
    digit: (place: DevicePlace, at: string, value: string) =>
      `Digit at ${placeName(place)} ${at} shows ${value}`,
    digitTitle: (value: string, place: DevicePlace, at: string) =>
      `${value}, written to ${placeName(place)} ${at}. Bits 0 to 7 light a, b, c, d, e, f, g and the dot.`,
    terminal: 'Terminal',
    terminalEmpty: 'Each byte written here is printed as a character.'
  },
  registers: {
    title: 'Registers',
    changed: 'changed by the last instruction',
    writtenSame: 'written, same value',
    name: 'Reg',
    hex: 'Hex',
    decimal: 'Decimal',
    unsigned: 'Unsigned',
    signed: 'Signed',
    binary: 'Binary',
    both: (unsigned: number, signed: number) => `${unsigned} unsigned, ${signed} signed`
  },
  encoding: {
    title: 'Machine code',
    fields: 'The fields of the instruction',
    x86Empty: 'Build an instruction or add one to the program to see the bytes it assembles to.'
  },
  diagram: {
    read: 'read',
    written: 'written',
    internalBus: 'Internal bus',
    /** A unit's short name beside its title: BIU, EU, IF. */
    unitTag: (tag: string) => tag,
    biu: 'Bus interface unit',
    eu: 'Execution unit',
    adder: 'Address adder',
    address20: '20-bit address',
    bus: 'Address / data bus',
    memory: 'Memory',
    ports: 'I/O ports',
    wrote: 'wrote',
    readValue: 'read',
    to: 'to',
    from: 'from',
    toPort: 'to port',
    fromPort: 'from port'
  }
};

export type PanelMessages = Widen<typeof panels>;
