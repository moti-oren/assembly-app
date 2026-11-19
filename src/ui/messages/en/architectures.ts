import type { Widen } from '../widen';

/** The panels of one architecture: RISC-V's and the 6502's, and the comparison of all three. */
export const architectures = {
  rv32: {
    cycleIntro:
      'Every instruction is fetched, decoded, then executed. A RISC-V instruction is always one 4-byte word, so PC moves on by 4. Use the Fetch button below to walk a line through the three phases.',
    cycleView: {
      label: 'Cycle view',
      single: 'One by one',
      singleHint: "Show one instruction's cycle",
      pipeline: 'Pipeline',
      pipelineHint: 'Show the pipeline'
    },
    memoryIntro:
      'One flat space of 32-bit addresses: RAM from 0x00000000 (the code first), the devices at 0x10000000. Dots mark addresses with nothing wired to them.',
    noFlags: 'No flags',
    /** "RISC-V keeps no flags. A branch … (beq, blt, bltu…), and slt puts …" around the code. */
    noFlagsBefore: 'RISC-V keeps no flags. A branch compares two registers itself',
    noFlagsMiddle: ', and',
    noFlagsAfter: "puts a comparison's answer, 1 or 0, in a register.",
    compared: (how: string) => `compared ${how}`,
    comparedNothing: 'The last instruction compared nothing.',
    runBranch: 'Run a branch to see what it compares.',
    registerFile: 'Register file',
    stages: {
      fetch: 'Fetch',
      decode: 'Decode',
      execute: 'Execute',
      memory: 'Memory',
      writeBack: 'Write back',
      nextPc: 'Next PC'
    },
    encodingEmpty: 'Build an instruction or add one to the program to see the 32 bits it becomes.',
    bits: 'The 32 bits of the instruction',
    lowByteFirst: 'stored low byte first:',
    bitRange: (high: number, low: number) => `bits ${high === low ? high : `${high}–${low}`}`,
    roles: {
      special: 'Special',
      argument: 'Arguments',
      temporary: 'Temporaries',
      saved: 'Saved'
    },
    roleHints: {
      special: 'zero always reads 0; ra holds the return address, sp the top of the stack',
      argument: 'Arguments of a call, and its results in a0 and a1. A call may change them',
      temporary: 'Free to use; a call may change them',
      saved: 'A function that uses them must put them back before it returns'
    },
    unsigned: (value: number) => `${value} unsigned`,
    pcHint: 'Program counter: the address of the next instruction. Not one of the 32 registers.',
    pipeline: {
      title: 'Pipeline',
      about: 'About the pipeline',
      intro:
        'A pipelined CPU works on five instructions at once, each in a different stage. Step or run the program: every instruction shows up here, cycle by cycle, with the stalls and flushes the overlap costs.',
      stages: {
        IF: 'fetch the instruction',
        ID: 'decode it and read its registers',
        EX: 'compute in the ALU; branches decide',
        MEM: 'load or store',
        WB: 'write the result to a register'
      },
      forwardingHint: 'Hand a result straight to the next instruction, before it is written back',
      forwarding: (on: boolean) => `Forwarding ${on ? 'on' : 'off'}`,
      cycle: 'Cycle',
      flushed: '(flushed)',
      waiting: '(waiting)',
      newest: 'The last instruction run'
    }
  },
  mos6502: {
    cycleIntro:
      'Every instruction is fetched, decoded, then executed. The opcode, one byte, says both the instruction and its addressing mode; the 6502 then reads 0 to 2 more bytes. Use the Fetch button below to walk a line through.',
    memoryIntro:
      '64K of 16-bit addresses: the zero page at $0000, the stack in page $01, the code from $0600, the devices at $D000 and the vectors at $FFFA.',
    eightBit: '8-bit',
    pcNote: 'program counter',
    addressUnit: 'Address unit',
    dataBus: 'Data bus',
    dataBusTag: 'memory · devices',
    cycles: 'Cycles',
    clock: 'clock',
    encodingEmpty: 'Build an instruction or add one to the program to see the bytes it becomes.',
    fields: {
      opcode: 'Opcode',
      value: 'Immediate',
      address: 'Address',
      low: 'Low byte',
      high: 'High byte',
      offset: 'Distance',
      signature: 'Signature'
    },
    flagsIntro:
      'P, the status register. Bit 5 always reads 1; B is only in the copy BRK and PHP push.',
    flagsList: 'The flags in P, bit 7 to bit 0',
    because: 'because',
    noFlagSet: (instruction: string) => `${instruction} set no flag.`,
    runForFlags: 'Run an instruction to see why it set its flags as it did.',
    nextFree: 'next free slot',
    registerHints: {
      a: 'Accumulator: the only register the ALU adds, ANDs and compares into',
      x: 'Index register: counts, and is added to an address ($nn,X, ($nn,X))',
      y: 'Index register: counts, and is added to an address ($nn,Y, ($nn),Y)',
      sp: 'Stack pointer: the low byte of the next free slot in page $01',
      pc: 'Program counter: the 16-bit address of the next instruction'
    }
  },
  compare: {
    title: 'Compare the CPUs',
    description:
      'One task, written for each CPU: how big its program is, and what running it takes.',
    task: 'Task',
    measure: 'Measure',
    fewest: '(the fewest)',
    program: (architecture: string) => `${architecture} program`,
    leaves: 'Leaves',
    load: (architecture: string) => `Load into ${architecture}`,
    loadNote:
      "Loading a program replaces that CPU's program and clears its history, as an example does."
  }
};

export type ArchitectureMessages = Widen<typeof architectures>;
