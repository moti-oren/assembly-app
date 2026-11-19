import type { Widen } from '../widen';
import type { RunSpeed } from '../../runSpeeds';

/** The app around the panels: header, settings, palette, dialogs and the transport bar. */
export const app = {
  language: {
    /** The language switch in the command palette. */
    switch: 'Switch the interface to Hebrew',
    /** The heading of the language choice in the settings menu. */
    label: 'Language'
  },
  header: {
    architecture: 'Architecture',
    commands: 'Commands',
    compare: 'Compare',
    compareLabel: 'Compare the CPUs',
    compareHint: 'The same task on all three CPUs, side by side',
    examples: 'Examples',
    examplesHint: 'Replaces your program and clears the CPU and its history',
    settings: 'Settings',
    sound: 'Sound',
    darkTheme: 'Dark theme',
    reduceAnimations: 'Reduce animations'
  },
  palette: {
    title: 'Commands',
    description: 'Search for something to do',
    search: 'Search commands',
    empty: 'No command matches.',
    move: 'move',
    run: 'run',
    close: 'close'
  },
  commandGroups: {
    program: 'Program',
    history: 'History',
    cpu: 'CPU',
    devices: 'Devices',
    runSpeed: 'Run speed',
    examples: 'Examples',
    preferences: 'Preferences'
  },
  /** Toggles are named for what choosing them does now, so they take the current state. */
  commands: {
    writeInstruction: 'Write an instruction',
    stepLine: 'Step one line',
    stepPhase: 'Step one phase (fetch, decode, execute)',
    pause: 'Pause',
    run: 'Run the program',
    addAtEnd: 'Add new lines at the end',
    clearProgram: 'Clear the program…',
    machineCode: (shown: boolean) => (shown ? 'Hide the machine code' : 'Show the machine code'),
    undo: 'Undo',
    redo: 'Redo',
    toStart: 'Go back to the start',
    toLatest: 'Go to the latest instruction',
    historyList: (shown: boolean) => (shown ? 'Hide the history list' : 'Show the history list'),
    reset: 'Reset the CPU and clear the history',
    stackTop: 'Show the top of the stack in memory',
    lastAccess: 'Show the last memory access',
    devices: (shown: boolean) => (shown ? 'Hide the I/O devices' : 'Show the I/O devices'),
    switchTo: (architecture: string) => `Switch to ${architecture}`,
    compare: 'Compare the CPUs on the same task…',
    loadExample: (name: string) => `Load "${name}"`,
    theme: (dark: boolean) => (dark ? 'Switch to light theme' : 'Switch to dark theme'),
    sound: (on: boolean) => (on ? 'Turn sound off' : 'Turn sound on'),
    motionBySystem: 'Animations are reduced by the system',
    motion: (reduced: boolean) => (reduced ? 'Use full animations' : 'Reduce animations'),
    resetCardOrder: 'Reset the card order',
    pipeline: (shown: boolean) => (shown ? 'Hide the pipeline' : 'Show the pipeline'),
    forwarding: (on: boolean) =>
      on ? 'Turn forwarding off in the pipeline' : 'Turn forwarding on in the pipeline'
  },
  cpuView: {
    label: 'CPU view',
    diagram: 'Show the CPU as a diagram',
    table: 'Show the CPU as tables'
  },
  speeds: {
    slow: 'Slow',
    normal: 'Normal',
    fast: 'Fast',
    instant: 'Instant'
  } satisfies Record<RunSpeed, string>,
  clearDialog: {
    title: (lines: number) => `Clear all ${lines} ${lines === 1 ? 'line' : 'lines'}?`,
    description: "The program can't be restored with Undo.",
    keep: 'Keep the program',
    confirm: 'Clear the program'
  },
  resetDialog: {
    title: 'Reset the CPU?',
    description: (instructions: number) =>
      `Registers, flags and memory go back to their start values, and the history is cleared (${instructions} ${instructions === 1 ? 'instruction' : 'instructions'}). The program is kept. This can't be undone.`,
    keep: 'Keep the current state',
    confirm: 'Reset the CPU'
  },
  appError: {
    title: 'Something went wrong inside the playground.',
    body: 'Undo or Reset to continue. Details:',
    dismiss: 'Dismiss'
  },
  transport: {
    controls: 'Program and history controls',
    step: 'Step',
    phaseLabel: (phase: string) => `Step: ${phase}`,
    phaseHint: 'Step one phase of the next line: fetch, decode, then execute',
    pause: 'Pause',
    run: 'Run',
    runProgram: 'Run program',
    speed: 'Speed:',
    speedLabel: (speed: string) => `Run speed: ${speed}`,
    reset: 'Reset',
    resetLabel: 'Reset the CPU',
    resetHint: 'Clears registers, flags, memory and the history. The program is kept.',
    undo: 'Undo the last instruction',
    redo: 'Redo the undone instruction',
    seek: 'Move through the executed instructions',
    position: (run: number, total: number) => `${run} of ${total} instructions run`,
    panels: 'Panels',
    history: 'History',
    devices: 'I/O',
    machineCode: 'Machine code'
  },
  panels: {
    names: {
      builder: 'Instruction',
      program: 'Program',
      history: 'History',
      encoding: 'Machine code',
      cpu: 'CPU',
      cycle: 'Cycle',
      registers: 'Registers',
      operation: 'Last operation',
      flags: 'Flags',
      devices: 'I/O devices',
      memory: 'Memory'
    },
    /** The 6502's and RISC-V's names for cards that show something else there. */
    mos6502Operation: 'ALU & cycles',
    rv32Operation: 'ALU',
    rv32Flags: 'No flags',
    moveCard: (card: string) => `Move the ${card} card`,
    dragHint: 'Drag to move this card within its column',
    keyHint: 'Drag it, or use the up and down arrow keys, to move it within this column.',
    moved: (card: string, position: number, count: number) =>
      `${card} moved to position ${position} of ${count}`
  }
};

export type AppMessages = Widen<typeof app>;
