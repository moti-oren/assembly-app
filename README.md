# assembly-app

CPU Playground: build an instruction word by word, run it, and watch the registers, flags and
memory change. It has three CPUs, chosen at the top of the page: the **8086**, **RISC-V** (RV32I
with the M extension) and the **6502**. Each keeps its own program and history while another is
on show.

A second topic, **Logic**, shows the gates behind an operation the CPU just made: press **Gates**
beside the ALU's result and the same bits appear in an adder, a row of gates or a shifter. A
third, **Numbers**, shows what that operation means as numbers: press **Numbers** and the same
bits are read once as unsigned and once as signed, each on a wheel of its own. A fourth,
**Storage**, shows how a value is kept: press **Stored** in the registers panel and the register
the instruction wrote appears as a row of flip-flops, waiting for its clock. A fifth, **Control**,
shows what tells all of these what to do: the 32 bits of a RISC-V instruction go through two
decoders, and the lines they set pick the ALU's operation, turn on a register's write line and
choose where PC goes next.

Live version: https://moti-oren.github.io/assembly-app/

## Commands

```sh
npm install
npm run dev        # start the app
npm test           # unit tests for the CPU core
npm run typecheck  # vue-tsc
npm run lint
npm run check      # typecheck, lint, format check and tests in one go
npm run check:design # no colour outside the theme tokens and the palette
npm run verify:rv32 # check the RISC-V core against Capstone and Unicorn
npm run verify:6502 # check the 6502 core against py65
```

`npm run check:design` fails when a component or a style sheet writes a colour itself instead of
using a token from `src/ui/styles.css`, and when a colour is outside the palette (cool neutrals,
blue, orange, and red for an error): a Tailwind palette class, a named CSS colour, or a token of
another hue.

`npm run verify:rv32` needs Python with `pip install capstone unicorn`. It encodes every RISC-V
instruction with varied operands and has Capstone read the bytes back, then runs random programs
from their bytes in Unicorn and compares registers, PC and memory with the playground's. An
optional seed gives another set of cases: `npm run verify:rv32 -- 7`.

`npm run verify:6502` needs Python with `pip install py65`. It has py65's assembler assemble every
6502 opcode the playground encodes, and runs random programs from their bytes in py65's simulator,
comparing A, X, Y, SP, P, PC, memory and the cycle count. In decimal mode py65 does not reproduce
the NMOS chip's N, V and Z, so BCD sums are compared on A and the carry only.

## Layout

- `src/core/`: the CPU, with no Vue dependency. Each architecture has a folder of its own, built on
  `shared/`.
  - `shared/`: what every architecture is built on: the `Architecture` interface, the CPU state and
    the undo record, programs (stepping, running, and edits that keep jump targets on the right
    lines), and the devices behind the I/O ports.
  - `x86/`: the 8086.
    - `state.ts`: registers (8-bit registers are views into AX..DX), FLAGS, 1MB memory.
    - `instructions.ts`: the instruction set as data. Each mnemonic lists its legal operand forms.
    - `builder.ts`: given the words chosen so far, which operands may come next.
    - `execute.ts`: runs one instruction, computes flags, and returns an undo record.
    - `examples.ts`: the example programs.
    - `decode.ts`, `flagReasons.ts`, `address.ts`: explanations worked out from the core: what an
      instruction will read and write, why each flag ended up 0 or 1, and how `segment:offset`
      becomes a physical address.
    - `encode.ts`: the machine code each instruction assembles to. It is for display only.
  - `rv32/`: RISC-V (RV32I with the M extension), with the same kind of modules: registers, the
    instruction set, the memory map, execution, the 32-bit encoding, pseudo-instructions and
    examples.
  - `mos6502/`: the MOS 6502 (NMOS): the 56 instructions and their 13 addressing modes, decimal
    mode, cycle counts, the code layout (instructions of 1 to 3 bytes) and examples.
  - `comparisonTasks.ts` and `comparison.ts`: the same tasks written for all three CPUs, and what
    running each program takes (lines, bytes, instructions run, memory writes, cycles).
  - `logic/`: digital logic, with no knowledge of any CPU: gates and circuits that are really
    evaluated (`gates.ts`), a ripple-carry adder (`adder.ts`), a shifter built from rows of
    switches (`shifter.ts`), and `alu.ts`, which solves one ALU operation gate by gate. Circuits
    with a loop in them are run until they come to rest (`feedback.ts`): the latches and the
    flip-flop (`flipFlop.ts`), and a register taken through one clock cycle (`register.ts`). A
    circuit without a loop can be followed gate delay by gate delay as it comes to rest
    (`propagation.ts`), and any of its gates can be broken, its output stuck at 0 or at 1
    (`fault.ts`), or built from NAND gates alone (`nand.ts`). A
    decoder is two planes of gates, the ANDs that recognise a pattern and the ORs they feed
    (`decoder.ts`), and a program counter is two adders, the switches that choose between their
    sums, and a register (`programCounter.ts`).
  - `aluLink.ts` and `x86AluLink.ts`, `rv32AluLink.ts`, `mos6502AluLink.ts`: the link between the
    topics. Each turns an executed instruction into the circuit that worked it out and the wire
    every flag is read from. Their tests run real instructions and check that the circuit gives
    the CPU's own result and flags.
  - `representation/`: what bits mean as numbers, with no knowledge of any CPU: the readings of a
    value (`readings.ts`), a sum or difference worked out exactly on the unsigned and the signed
    scale (`arithmetic.ts`), a narrow value made wide (`extension.ts`) and a sum of packed decimal
    digits (`bcd.ts`).
  - `numberLink.ts` and `x86NumberLink.ts`, `rv32NumberLink.ts`, `mos6502NumberLink.ts`: the link
    into the number topic. Each turns an executed instruction into arithmetic on numbers and the
    question every flag answers about them. Their tests run real instructions and check that
    the numbers give the CPU's own result and flags.
  - `registerLink.ts` and `x86RegisterLink.ts`, `rv32RegisterLink.ts`, `mos6502RegisterLink.ts`:
    the link into the storage topic. Each turns an executed instruction into the registers it
    wrote: what each held, what was written, and which of its flip-flops were written. Their
    tests run real instructions and check that the flip-flops of every register, written or not,
    end up holding what the CPU holds.
  - `controlLink.ts` and `rv32ControlLink.ts`, `x86ControlLink.ts`, `mos6502ControlLink.ts`: the
    link into the control topic. RISC-V's turns an executed instruction into its 32-bit word, the
    two decoders that read it (`rv32Control.ts`: nine kinds of instruction, and the ALU's
    operations) and what decides the next PC; the other two say why they have nothing to show.
    The test runs every RV32IM instruction and checks the decoders against the CPU's own decoding
    and the clocked PC against the CPU's.
- `src/ui/`: Vue components and `useCpu`, which wraps a CPU core in Vue reactivity. Each
  architecture has a workbench (`X86Workbench`, `Rv32Workbench`, `Mos6502Workbench`) that lays
  out its panels: the shared ones (program, history, builder, devices, and `FlatMemory` for the
  flat address spaces of RISC-V and the 6502) and its own (`Rv32Diagram`, `Mos6502Diagram`, …).
  The builder asks each architecture's grammar (`x86Grammar.ts`, `rv32Grammar.ts`,
  `mos6502Grammar.ts`) what can come next. The logic, number, storage and control topics each have
  a page of their own (`LogicWorkbench`, `NumbersWorkbench`, `StorageWorkbench`,
  `ControlWorkbench`); `useTopic` holds which topic is on show.
- `src/components/ui/`: [shadcn-vue](https://www.shadcn-vue.com) components (Tailwind CSS v4 +
  reka-ui). They are generated by `npx shadcn-vue add <name>`, so they are not linted. The theme
  tokens, including the two app accents (`--changed` and `--pointer`), are in `src/ui/styles.css`.

## Model

- An instruction can run immediately (Enter) or be added to the program (Shift+Enter).
- In the instruction box, the arrow keys move through the choices below it (Left/Right one at a time, Up/Down by row) and Enter picks the highlighted one. Once the box holds words or text, hold Alt to use the arrows this way; without Alt, Left and Right move between the words and through the text, and Up and Down go to the start and the end of the box. The row of keys under the box shows the ones that work at that moment.
- Stepping or running the program folds those choices away, so the program
  below moves up and its current line stays in view. Click in the box, type, or press **Show the
  choices** to bring them back.
- The choices are grouped by family (transfers, arithmetic, logic, shifts, jumps and branches,
  the stack), each under its own heading. Colour is kept for what the CPU does: blue where it reads
  and where execution is, orange where it writes.
- **Reset**, in the bottom bar next to Undo, sets registers, flags and memory back to their start
  values and clears the history; the program is kept. When the history holds instructions it
  asks first, since Undo cannot bring them back. It does not ask when all of the history is the
  program run to its end, which running it again brings back.
- When the program has ended, **Step** becomes **Run again**: it resets the CPU and runs the
  program from its first line. The buttons that are off say why when you point at them.
- The bar has keys of its own: **F10** steps a line and **F8** runs or pauses, wherever the focus
  is; **Ctrl+Z** undoes the last instruction and **Ctrl+Shift+Z** (or Ctrl+Y) redoes it (Cmd on
  a Mac), except while a field holds text you typed, where they undo the typing. The command
  palette shows each shortcut beside its command.
- Each program line has **Edit** (the pencil, or the **⋯** menu on a touch screen): the line goes
  back into the instruction box, **Enter** or **Replace** puts the changed instruction in its
  place, and **Esc** or **Cancel** leaves the line as it was. The **⋯** menu also moves a line up
  or down, as do Alt+Up and Alt+Down while one of the line's buttons has the focus; jumps keep
  pointing at the instructions they pointed at. Its **Inspect machine code** takes the line's
  bytes apart in the Machine code panel, also where the panel is too narrow to show them.
- Moving, replacing or deleting a line of a program that has already run leaves what the CPU
  holds from that run, such as a return address on the stack, naming the old place. The program
  panel says so, with a **Reset** to run it from the start. The command palette can edit the line
  that runs next, or move it up or down.
- The program of each CPU is remembered in the browser. After a reload it is back, started
  afresh: registers, memory and the history are not kept.
- With every panel of the left column open, the program keeps about six of its lines in sight,
  and opening **History** folds the builder's choices away to make room.
- Loading an example shows its name and what it demonstrates above the program lines, until you
  edit the program. An example that uses no device closes the I/O panel again, if a program had
  opened it.
- After a conditional jump, the **Cycle** card says why it was taken or not, with the values it
  tested: `Not taken: JGE jumps when SF = OF, but SF is 1 and OF is 0.`
- A register the last instruction changed is filled in amber. One it wrote with the value it
  already held is outlined instead, e.g. `mov si, 0` while SI is 0, so a write is never invisible.
- Hovering over a register's name or value (or tapping its name) shows what the last instruction
  did to it, `Previous 0000 → Now 000A`. The same goes for a memory byte it wrote, which is outlined
  instead of filled when the byte kept its value. When IP or PC went anywhere but the next
  instruction, it says `(jump)`, and on RISC-V and the 6502 the PC line says where it jumped from.
- A program line can also be stepped one phase at a time with the phase button next to **Step**,
  which names the phase it runs next and its place (`Fetch · 1/3`): fetch, decode, then execute. Fetch and decode show what is about to happen in the **Cycle**
  card above the CPU and on the wires; the registers, flags and memory change only at execute.
- The CPU diagram is laid out like the 8086 itself. The **execution unit** (EU) holds the data,
  pointer and index registers, the ALU and the flags; the **bus interface unit** (BIU) holds the
  segment registers, IP and the **address adder**, which shows `segment × 10h + offset` for the
  last memory access. An internal bus joins the two units, and one external address/data bus
  leaves the adder for the memory and the I/O ports. Each wire lights up as read or written. A
  port number skips the adder, and fetching a line forms no address, because the program is not
  stored in memory. The registers are shown in hex and decimal; **BIN** in the CPU panel's header
  (or **Show the register bits** in the command palette) adds each one's 16 bits.
- Instructions are not run from bytes, so IP is the index of the next program line (L0, L1, …),
  and jump/call targets are lines. CALL pushes the next line onto the stack and RET pops it.
- The Program panel still shows the machine code each line would assemble to on a real 8086.
  The **Machine code** button in the bottom bar opens a panel that takes one instruction apart into
  prefix, opcode, ModR/M (with its mod, reg and r/m bits), displacement, immediate and jump
  distance: the instruction in the builder, or else the next program line. Click a line's bytes
  to take that line apart.
- Memory operands are `byte`/`word` `[bx]`, `[si]`, `[di]`, `[bp]` or `[offset]`. `[bp]` uses SS
  and everything else uses DS.
- The Memory panel works out how `segment:offset` becomes a 20-bit physical address
  (`segment × 10h + offset`, wrapping past 1MB) for the last memory access, or for any byte you
  point at. **Show in table** scrolls the table to the last access. Pointing at a byte also
  marks its character in the ascii column, and the other way round.
- Shift counts are `1` or `CL`, as on the 8086.
- String instructions (`movsb`/`movsw`, `stosb`/`stosw`, `lodsb`/`lodsw`, `scasb`/`scasw`,
  `cmpsb`/`cmpsw`) read from DS:SI, write to ES:DI and step by DF. Pick `rep`, `repe` or `repne`
  first to repeat one while CX ≠ 0; the whole repeat runs as a single step.
- `in` and `out` move AL or AX to and from I/O ports; the port is an 8-bit number or DX. The
  **I/O** button in the bottom bar shows the devices: LEDs (out 10h), switches (in 11h), two
  7-segment digits (out 12h and 13h, one bit per segment) and a terminal that prints every byte
  written to it (out 20h). The panel opens by itself when a program uses a port.
- The **Stack** button in the bottom bar (or **Show the stack** in the command palette) lists the
  stack of the CPU on show, from its top down: each value's address, what it is (a register's
  value, the line a `call` returns to, FLAGS) and the instruction that put it there. The value the
  last instruction pushed is marked as a write; one it took off stays in sight above the top,
  greyed, because only the stack pointer moved and memory still holds it. On the 6502 the two
  bytes `jsr` pushes are one row (the return address, kept less 1). RISC-V has no push: the list
  is the room the program made by lowering `sp`, with the register each word was stored from.
  **In memory** shows the same bytes in the memory panel.
- `int n` pushes FLAGS, CS and IP, clears IF and TF, and jumps to the handler stored in vector `n`
  (two words at `0000:n×4`: the handler's program line, then its CS). `iret` returns. `mov` takes a
  program line as its source (`mov word [0x84], L8`) to fill a vector. `into` is `int 4` when OF = 1,
  and a divide error is `int 0`. An empty vector is reported as an error instead of jumping to
  `0000:0000`. `pushf` and `popf` move FLAGS through the stack.
- Hover or focus a flag to see why the last instruction left it at 0 or 1, worked out with that
  instruction's own numbers (e.g. `7Fh + 01h` overflows as signed, so OF = 1). Hover or focus a register's
  name to see what it is for.
- The panels of the left column can be put in any order: drag a panel by its header (a plain
  click on the header folds it instead), or focus its arrow button and press Alt with the up or
  down arrow (Alt+Home and Alt+End move it to the top or bottom). The order is remembered, and
  **Reset the card order and sizes** in the command palette (Ctrl+K) puts it back. The panels of
  the right column stay where they are. On a wide screen each column scrolls on its own, so the
  program stays in view under a long CPU column, and the bottom bar sits below both.
- The page fits the screen it is on. On a tablet the right column takes the whole width, and the
  left one is a drawer that **Code**, at the top, slides over it (Esc closes it); Reset and the
  panel buttons move behind **⋯** at the end of the bottom bar, and the header keeps the topics,
  the CPU switch and the commands, with Share, Compare, Challenges, the examples and the settings
  in its own **⋯** menu. On a phone one view shows at a
  time, chosen under the header: **Code** (the left column), **CPU**, or **Memory & I/O**. The
  strip above them always shows the last instruction and what it changed, as `CX 0000 → 000A`,
  with the line that runs next, and a tap on it goes to the CPU. When more changed than fits, a
  `+N` at its end lists every change. The bottom bar keeps Step, the phase button, Run and Undo,
  and its **⋯** holds the rest; the topics, Share, Compare, Challenges, the examples and the settings
  are in the **⋯** menu of the header. A phone starts with the CPU as tables, and a row of its memory holds eight bytes.
  On a touch screen the panels are not dragged, and a tap on a register's name or on a flag shows
  what hovering shows with a mouse.
- The left column works like the side bar of an editor. Click a panel's header (or its arrow) to
  collapse it to the header and again to open it; **History** and **Machine code** also have a ✕
  that closes them, and their buttons in the bottom bar bring them back. Except on a phone, the open
  panels share the column's height, so the column itself never scrolls: each panel scrolls inside
  itself, no panel grows past its content, and dragging the line between two open panels (or
  focusing it and using the up and down arrows) moves room from one to the other. What is
  collapsed and how tall each panel is are remembered, and the palette can collapse or expand any
  of them. The left column is the same for all three CPUs: its order, what is collapsed, and which
  of History, Machine code and the I/O devices are on show carry over when you switch CPU, and
  are remembered between visits.
- The gear at the top right opens **Settings**, a window over the app (on a phone it is in the
  **⋯** menu and takes the whole screen). Its sections: **General** (sound, anonymous usage),
  **Appearance** (the theme: Light, Dark or System, which follows your device; **Reduce
  animations**), **CPU** (diagram or tables, the 8086's register bits, RISC-V's pipeline chart, its
  forwarding and its branch predictor; the same switches stay on their panels), **Running** (the run speed, which is
  remembered and shared by the three CPUs; whether the I/O panel opens by itself when a program
  uses a port; whether a reset asks first), **Keyboard** (the shortcuts, to read) and **Data**
  (reset the panel layout, or clear everything this browser saved: the programs, the settings and
  the layout). The command palette has the switches too, and **Open the settings…**. The app
  starts in the light theme until you pick one.
- With the sound on, the app plays short, quiet cues, all synthesized in the browser. Fetch,
  decode and execute climb three notes, and each instruction sounds like what it did: a register
  or memory write, the stack, a jump taken or not, a call or a return. The devices, undo and redo,
  the builder and edits to the program have lighter cues of their own. A fast run plays one soft
  pulse per line instead, and RISC-V's pipeline a tick per instruction, with a cue for a forward
  or a stall. Nothing plays while the tab is hidden.
- **Reduce animations** in the settings or the command palette turns off the values that fly between panels, the
  flashes and the glowing wires; the changed values stay marked. It is remembered, and it is on by
  itself when the system asks for reduced motion.
- A panel's explanation is behind the ⓘ button next to its name, so it is there when you want it
  and out of the way the rest of the time.

## RISC-V mode

- Switch with **8086 / RISC-V** at the top of the page, or **Switch to …** in the command
  palette. The choice is remembered.
- 32 registers, `x0` to `x31`, shown by their ABI names (`zero`, `ra`, `sp`, `a0`–`a7`, `t0`–`t6`,
  `s0`–`s11`). `x0` always reads 0, and writes to it are thrown away.
- PC is a real address. Every instruction is 4 bytes, so line `Ln` is at address `4n`. `jal` puts
  the address of the next instruction in its register (`ra` for a call), and `ret` is
  `jalr zero, 0(ra)`.
- Memory is one flat space of 32-bit addresses: 1MB of RAM from `0x00000000`, with the program's
  code at its start, and the devices from `0x10000000`. The code can be read (it is its machine
  code) but a store into it is an error: the program cannot change itself. An access that is not
  aligned to its size, or that goes where nothing is wired, is an error too.
- A memory operand is `offset(base)`. Type the offset, then pick the register; or pick the register
  straight away for an offset of 0.
- There is no I/O instruction: the devices are bytes of memory. LEDs at `0x10000010`, switches at
  `0x10000011`, the two digits at `0x10000012` and `0x10000013`, the terminal at `0x10000020`. Reach
  them with `lbu` and `sb` (one byte at a time).
- Pseudo-instructions (`li`, `mv`, `not`, `neg`, `nop`, `j`, `jr`, `ret`, `beqz`, `bnez`, `bgt`,
  `ble`, …) are listed after the real instructions. The line under the box says what one becomes,
  and adding it adds the real instructions. `li` with a value that does not fit in 12 bits becomes
  `lui` then `addi`.
- There are no flags. The **No flags** card shows what the last branch compared, and whether it
  compared signed or unsigned numbers; `slt` and `sltu` write their answer, 1 or 0, into a
  register.
- Dividing by zero does not trap: the quotient is all ones (-1) and the remainder is the dividend.
- The CPU diagram is the single-cycle datapath: the register file, the five stages (fetch,
  decode, execute in the ALU, memory, write back) and where the next PC comes from. Stepping by
  phase shows each stage's plan before it runs.
- **Pipeline** on the Cycle card (or **Show the pipeline** in the command palette) shows the
  instructions that ran as the classic five-stage pipeline would run them, IF, ID, EX, MEM and WB,
  up to five at once, cycle by cycle. A dashed cell is a cycle spent waiting: an instruction that
  needs a value a load has not brought yet waits one cycle in ID. A branch or jump changes PC in
  EX, two cycles after it was fetched, so what is fetched behind it until then is a guess; when
  the guess is wrong, the two instructions fetched behind it are struck out (flushed). **Branches**
  picks how a conditional branch is guessed: **Not taken** (the next lines are fetched), **Taken**
  (its target is), **1 bit** (what this branch did last time) or **2 bits** (what it mostly did:
  once the guess is sure, one wrong guess does not change it). A ✓ on a branch's EX is a guess that was right, a ✗ one
  that cost a flush; run a loop under each to see how much it loses. A jump is always resolved in
  EX. Turn
  **Forwarding** off to see every instruction wait in ID until the one before it has written its
  result back. With it on, a blue line down the chart joins an EX to the stage above it that handed
  it a result before that result was written back. The stages of the last instruction run are
  tinted blue. Under the chart, a sentence says why each stall and flush happened, and a line adds
  up the cycles and the branches guessed right, and below them is what the last instruction did, in the same words the one-by-one
  view uses. The CPU itself still runs one instruction at a time; the chart is worked out from
  the history.
- The **Machine code** panel shows the 32 bits of an instruction with each field over its bits:
  opcode, rd, funct3, rs1, rs2, funct7 and the pieces of the immediate, which B-type and J-type
  instructions split across the word.
- The Memory panel jumps to the **Code**, **Data**, **Stack** or **Devices**. Machine code is bold,
  device registers have a dotted underline, and dots mark addresses with nothing wired to them.

## 6502 mode

- 6502 is the third choice at the top of the page. It is the NMOS chip of the Apple II, the
  Commodore 64 and the NES's CPU core: three 8-bit registers (A, X, Y), an 8-bit stack pointer and
  a 16-bit PC.
- Only A does arithmetic and logic, and only with a byte from memory or an immediate. X and Y count
  and index; adding X to A means storing X first.
- After the mnemonic, type a number (`$10`, `16` or `0x10`): the box offers every addressing mode
  it fits, `#$10`, `$10`, `$10,x`, `$0010`, `$0010,x`, `($10,x)`, `($10),y` and so on. The line
  under the box says what the highlighted one means and how many cycles it takes. A shift also
  offers `a`, and a branch, JMP or JSR offers the program's lines.
- PC is a real address, and an instruction is 1 to 3 bytes, so each line's address depends on the
  lines before it. The code starts at `$0600`, the zero page is `$0000`–`$00FF`, the stack is page
  `$01`, the devices are at `$D000` (LEDs `$D010`, switches `$D011`, digits `$D012` and `$D013`,
  terminal `$D020`), and the BRK vector is at `$FFFE`.
- The CPU diagram shows the registers and the flags, the ALU's sum, the **address unit** (how the
  addressing mode formed the address: `$02F0 + X ($20) = $0310`, or the pointer read from the zero
  page) and the cycles the instruction took, the extra one for crossing a page or taking a branch
  included.
- The Flags card says why the last instruction set each flag. In decimal mode (after `sed`) the
  NMOS chip takes N, V and Z from intermediate sums, and the app shows that too.
- JSR pushes the address of its own last byte, and RTS adds 1 to it; the memory panel's **Stack**
  shows the two bytes. `JMP ($xxFF)` reads its high byte from `$xx00`, as the original chip does.
  BRK is two bytes (the CPU skips the one after it), so RTI returns to the next line.

## Challenges

- **Challenges** at the top of the page (in the **⋯** menu on a phone), or **Open the challenges…**
  in the command palette, lists five small tasks for the CPU on show: set the overflow flag without
  the carry, multiply by ten with no multiply instruction, swap two registers with nothing to
  spare, and others. **Start** replaces that CPU's program with the task's given lines, as an
  example does.
- A **Challenge** panel opens at the top of the sidebar with the task, what the program must do and
  what it must keep to (a number of lines, instructions it may not use). The given lines are locked, with a lock beside
  each in the program: they are not edited, moved or deleted, new lines go under them, and
  clearing the program keeps them. Each is ticked as soon as
  the program meets it: the program is run again on a CPU of its own after every edit, so the CPU
  on show is never touched and you can still step through your attempt. A task with given lines is
  run with other values in them too, so writing the answer down does not pass.
- Under the list a line says where the program stands, and once it passes, how many lines it took
  against par. **Show a hint** gives a nudge, **Start over** brings the task back as it began, and
  closing the panel (or loading an example) leaves the challenge. Solved challenges are ticked in
  the list with the fewest lines they took, and remembered between visits.

## Comparing the CPUs

- **Compare** at the top of the page (in the **⋯** menu on a phone), or **Compare the CPUs on the same task…**
  in the command palette, opens the same task written for all three CPUs: adding 1 to 10, a 16-bit
  sum, multiplying, filling memory, calling a function, and lighting the LEDs.
- A table sets side by side the program's lines and machine code bytes, the instructions it runs,
  the bytes it writes to memory (the stack included), and on the 6502 its clock cycles. The fewest
  in each row stands out. A paragraph says where the difference comes from: REP STOSB against a
  loop, a return address on the stack or in `ra`, a multiply instruction or none.
- Each CPU's program is listed with its machine code and what it leaves behind. **Load into …**
  replaces that CPU's program with it, as an example does, and switches to it.

## Guessing before it runs

- **Guess** in the bar at the bottom (in **⋯** on a phone and a tablet), **Guess before it runs** in the
  settings under Running, or the same in the command palette, turns prediction mode on. It is off
  until you turn it on.
- Before an instruction runs you are asked one thing about it, above the bar: whether a conditional
  jump or branch is taken, the value a register will hold (typed in hex; `-1` stands for its two's
  complement), or which flags a comparison leaves at 1 (CMP and TEST on the 8086; CMP, CPX, CPY and
  BIT on the 6502). An instruction with nothing to ask (a store, PUSH, an unconditional jump) runs as
  it always does.
- **Check** (Enter in the answer box) runs the instruction and checks the answer against the CPU:
  right or not, what the CPU did, and why, in the words of the panels (the sum, the reason a flag
  got its value, the condition of the jump). **Skip** (Esc, or Step again) runs it without an
  answer. A count of the answers of this run stays beside the last one; Reset clears it.
- The settings choose where it asks, each on its own and all on at first: on a program step, on an
  instruction run from the builder, and during a run. A run waits at every line that has a
  question, goes on after a right answer and pauses after a wrong one; at Instant speed it never
  asks.

## From an operation to its gates

- **CPU**, **Logic**, **Numbers**, **Storage** and **Control** at the top of the page (in the **⋯** menu on a
  phone) switch
  between the topics. **Gates**, beside the result in a CPU's ALU panel, opens the logic topic on the
  operation that CPU just made; so does **Show the gates behind the last operation** in the
  command palette.
- The page shows that operation as a circuit, with the CPU's own bits on its wires: a full adder
  under every bit with the carry rippling between them (a subtraction is the same adder with B
  inverted), one gate per bit for AND, OR and XOR, or a shifter whose rows of switches move the
  bits. The 8086 and the 6502 shift one place per row; RISC-V has a barrel shifter of five rows.
- Press an adder, a gate or a bit of a shifter's row to see that one bit gate by gate, with the
  truth table of any gate you press and the Boolean expressions it works out.
- **Slow down time**, above an adder, shows it one gate delay at a time: every gate takes one
  delay to react, so a carry climbs two delays a bit and the sum is wrong on the way. Step, play
  or drag through the delays; a dashed bit will change again, and **ready at** gives the delay
  each bit of the result settles at. A flipped bit starts from the wires as they were, so only
  what it reaches moves; **Longest carry** loads the values that keep the adder busy longest.
  The same actions are in the command palette, under **Gate delays**.
- **Break a gate**: under the truth table of the gate you pressed, **Stuck at 0** or **Stuck at
  1** holds its output at that value whatever its inputs are. A line above the circuit sets the
  broken circuit's answer beside the working one's, the wrong bits of the result are underlined,
  and the flags follow the broken wires. Often nothing is wrong at all: the inputs hide a fault
  when the gate would put out that value anyway, so change a bit to catch it. With time slowed
  down the mistake spreads from the gate a delay at a time. A fault stays while the circuit is
  the same one, so you can step the CPU and see which instructions it spoils; the CPU itself is
  never touched. **Works** mends the gate and **Repair every gate** mends them all (also in the
  command palette, under **Faults**).
- **As NAND gates**, under the gate you pressed, draws that gate built from NAND gates alone,
  with the values now on its wires: two for an AND, three for an OR, four for an XOR or a
  shifter's switch. Below it is the price, worked out by really building the circuit that way:
  how many NAND gates the gate, its bit and the whole circuit take, and how much longer the
  longest path becomes.
- **Where each flag comes from** names the wire behind every flag. The 8086's CF after a
  subtraction is the inverse of the carry out; the 6502's C is the carry out itself; RISC-V has
  no flags, so a branch or `slt` reads one wire of a subtraction.
- Press a bit of an input to flip it and see what the circuit would have made (**What if**). The
  CPU is not changed; **The CPU's values** puts its bits back. The operation and the width can be
  changed too, to try a circuit freely.
- The arrows step to the operation before or after this one in the CPU's history, and **Back to
  the …** returns to the CPU at the instruction on show.
- Multiplication, division and the 6502's decimal mode have no circuit yet: there **Gates** is
  greyed and says why.
- **What it means as numbers**, at the foot of the page, opens the same operation in the number
  topic, **How the result is kept** opens the storage topic, and **What picks the operation**
  opens the control topic.

## From an operation to its numbers

- **Numbers**, beside **Gates** in a CPU's ALU panel, opens the number topic on the operation that
  CPU just made; so does **Show the last operation as numbers** in the command palette.
- A sum or a difference is shown on two wheels, one of unsigned numbers and one of signed ones.
  The same bits start and end at the same place on both; what differs is where each wheel ends
  and starts again. A step over that seam is an answer that did not fit, and each CPU keeps a
  flag for it: CF and OF on the 8086, C and V on the 6502. Under each wheel is the sum as that
  scale reads it, and whether it fits.
- **What each flag says** gives every flag as a question about the numbers. The 6502's C after a
  subtraction works backwards (1 means no borrow); RISC-V has no flags, so `slt`, `sltu` and the
  branches compare on the scale their name picks.
- A RISC-V `lb`, `lh`, `lbu` or `lhu` is shown as an extension: the byte or half word above the
  32 bits it becomes, the new bits all copies of its top bit or all zeros, and which of the two
  numbers that keeps.
- An `adc` or `sbc` of the 6502 in decimal mode, which has no gates to show, is shown here digit
  by digit: each half of the byte summed in binary, and put right by 6 where it is past 9.
- Press a bit to flip it, or drag the blue dot round a wheel (the arrow keys move it too), and
  see what the answer would have been (**What if**). The CPU is not changed. **Add**,
  **Subtract**, **Extend**, **Decimal** and **One value** (a row of bits read as hex, unsigned,
  signed, ASCII and decimal digits) and the width can be picked freely.
- Bitwise logic, shifts, multiplication and division are not shown as numbers yet: there
  **Numbers** is greyed and says why.

## From an instruction to the register that keeps its result

- **Stored**, at the top of a CPU's registers panel, opens the storage topic on the register the
  last instruction wrote; so does **Show how the last register written is kept** in the command
  palette.
- The register is shown as rows of bits: the value waiting at its inputs, a write line for every
  bit, a flip-flop under every column, and what the flip-flops hold. The page opens before the
  clock edge, with the old value still held. **Raise the clock** loads the new one; **Lower the
  clock** finishes the cycle, and **Start over** starts it again.
- A bit whose write line is 0 keeps its value whatever waits at its input. On the 8086 a write to
  AL turns on only the low eight write lines of AX: AL and AH are halves of one register, not
  registers of their own. An instruction that wrote several registers (`xchg`, `mul`, `pop`)
  lists them to pick from.
- Press a flip-flop to see that bit gate by gate: the switch that picks between the input and the
  bit's own output, then the two latches of the flip-flop, with the values of that moment of the
  clock cycle on every wire and the truth table of any gate you press.
- **SR latch**, **D latch** and **Flip-flop** show the cells a register bit is built up from,
  each to work by hand. With both inputs of the SR latch at 1, **Let go of both at once** shows
  the one case in which it cannot decide what it holds.
- Under their inputs a timing diagram draws each wire as a wave, with a step for every change you
  make (the last 16) and a line that says what the step did. It shows what the gates alone do
  not: a D latch follows D for as long as E is 1, and a flip-flop takes D only where the clock
  rises, which a dotted line marks. **Pulse** raises and lowers E or the clock in one press, and
  **Clear** starts the diagram again.
- Press a bit of the input or of the write line to flip it and see what the register would have
  held (**What if**). The CPU is not changed. The width can be changed too.
- An instruction that wrote no register (a comparison, a store, a branch) has nothing to show:
  there **Stored** is greyed and says why. So does RISC-V's `x0`, which has no flip-flops, and a
  jump, which writes only the instruction pointer: how that register is loaded on every
  instruction is shown in the control topic, for RISC-V.
- **The gates that work a value out**, at the foot of the page, opens the logic topic, and **What
  turns the write line on** opens the control topic.

## From an instruction to its control lines

- **Control**, at the top of the page, opens the control topic on the last instruction the CPU
  ran; so does **Control** in the cycle panel of a wide window, and **Show how the last
  instruction was decoded** in the command palette.
- The instruction is shown as the control unit gets it: 32 bits, with the fields they fall into.
  The fields a decoder reads (the opcode, funct3, and two bits of funct7) are outlined.
- **The main decoder** is a grid of the gates it is made of. Every row is an AND gate that
  recognises one kind of instruction by its opcode; the row the word lit is marked. Every column
  on the right is an OR gate, with a dot on each row that feeds it: RegWrite, ALUSrcB, MemRead,
  Branch, Jump and the rest. **The ALU decoder** below it reads what the first one found with
  funct3 and funct7, and sets the lines of the ALU: Sum, Sub, Shift, and for a branch which wire
  of the subtraction it reads.
- **What the lines tell the CPU** lists every line that is 1 with what it does. **Gates** beside
  an ALU line opens the logic topic on the same instruction, and **Stored** beside RegWrite opens
  the storage topic.
- **Where PC goes next** shows PC + 4 and PC + the immediate, each from an adder, the Branch,
  Jump and comparison lines that choose between them, and PC itself as a register: **Raise the
  clock** loads the chosen address. An instruction run by itself, not fetched from the program,
  leaves PC alone unless it jumps.
- Press a bit of the word to flip it and see what the decoders make of it (**What if**): bit 30
  turns ADD into SUB, and an opcode no instruction has turns every line off. The CPU is not
  changed, and a changed word has no PC to follow.
- This is RISC-V's control unit. The 8086 decodes with microcode and the 6502 with a table read
  again on every cycle: there **Control** is greyed and says why, and the page offers a RISC-V
  word to try by hand.

## Sharing a program

- **Share** at the top of the page (**Share this program** in the **⋯** menu on a phone, or
  **Share this program…** in the command palette) opens a link to the program on show. Whoever
  opens it gets the same program on the same CPU, ready to run.
- The link carries the CPU and the program, nothing else: no registers, memory, history or device
  switches. The program is in the link itself (the part after `#`, which a browser never sends to
  the server), so nothing is uploaded and no account is needed.
- Opening a link replaces the program that CPU holds and resets it. If you have another program
  there, the app asks first; **Keep my program** leaves everything as it was.
- A link that was cut short, or made by a newer version of the app, opens nothing and says so.

## Feedback

- The speech bubble at the top of the page (**Send feedback** in the **⋯** menu on a phone and in
  the command palette) opens a short form: an idea, a problem or anything else, with an email
  address only if you want an answer.
- Sent with the message: the topic and CPU on show, the size of the screen, the theme and the
  app's version. Your program is not sent.
- Where it goes is set at build time by `VITE_FEEDBACK_ENDPOINT` (a form service that takes a
  JSON `POST`, in `.env.production`). A build without it offers no feedback; `npm run dev` shows
  the form and prints the message to the console instead of sending it.

## Privacy

- The live site counts how it is used, through [Umami](https://umami.is): the visit's page view
  (with what Umami derives from the request, such as the country and the browser), and a short
  list of events: the topic and CPU on show, a CPU's first instruction of the visit, a program
  run, an example or a comparison task loaded (by name), the comparison opened, the gates, the
  numbers or the register of an instruction opened, a share link copied or opened (for which CPU, never the program), a CPU error
  (that it happened, never its text), a guess answered (right or not, never the answer) and
  feedback sent (its kind).
  The list is `src/ui/analyticsEvents.ts`.
- No event carries what you wrote: not your program, not a value, not a message. Umami sets no
  cookie, and the app adds no identifier of its own.
- **Share anonymous usage** in the settings (and in the command palette) turns it off; the
  browser's Do Not Track setting does too. Turned off before the page loads, the script is never
  fetched.
- It is on only in a production build that names a site (`VITE_UMAMI_WEBSITE_ID` in
  `.env.production`, with `VITE_UMAMI_DOMAINS` for the host names that count). `npm run dev` and
  a build without it load nothing.
- Your programs and settings stay in the browser's local storage. A share link holds its program
  in the address's fragment, which is not sent to the server or to Umami. The fonts are loaded from
  Google Fonts.

---

<div dir="rtl">

# assembly-app (עברית)

CPU Playground: בונים הוראה מילה אחר מילה, מריצים אותה, וצופים בשינויים ברגיסטרים, בדגלים
ובזיכרון. יש בו שלושה מעבדים, שבוחרים ביניהם בראש העמוד: **8086**, **RISC-V** (RV32I עם הרחבת M)
ו-**6502**. כל אחד שומר את התוכנית וההיסטוריה שלו בזמן שמעבד אחר מוצג.

נושא שני, **Logic**, מציג את השערים שמאחורי פעולה שהמעבד ביצע זה עתה: לוחצים על **Gates** ליד
תוצאת ה-ALU, ואותן סיביות מופיעות במחבר, בשורת שערים או במעגל הזזה. נושא שלישי, **Numbers**,
מציג מה אותה פעולה אומרת כמספרים: לוחצים על **Numbers**, ואותן סיביות נקראות פעם ללא סימן ופעם
עם סימן, כל קריאה על גלגל משלה. נושא רביעי, **Storage**, מציג איך ערך נשמר: לוחצים על **Stored**
בחלונית האוגרים, והאוגר שההוראה כתבה מופיע כשורה של פליפ-פלופים שמחכים לשעון. נושא חמישי,
**Control**, מציג מה אומר לכל אלה מה לעשות: 32 הסיביות של הוראת RISC-V עוברות דרך שני מפענחים,
והקווים שהם קובעים בוחרים את הפעולה של ה-ALU, מדליקים את קו הכתיבה של אוגר ובוחרים לאן PC ממשיך.

גרסה חיה: https://moti-oren.github.io/assembly-app/

## פקודות

</div>

```sh
npm install
npm run dev        # start the app
npm test           # unit tests for the CPU core
npm run typecheck  # vue-tsc
npm run lint
npm run check      # typecheck, lint, format check and tests in one go
npm run check:design # no colour outside the theme tokens and the palette
npm run verify:rv32 # check the RISC-V core against Capstone and Unicorn
npm run verify:6502 # check the 6502 core against py65
```

<div dir="rtl">

- `npm install`: התקנת התלויות.
- `npm run dev`: הרצת האפליקציה.
- `npm test`: בדיקות יחידה ללב ה-CPU.
- `npm run typecheck`: בדיקת טיפוסים (vue-tsc).
- `npm run lint`: בדיקת קוד עם ESLint.
- `npm run check`: בדיקת טיפוסים, lint, בדיקת פורמט ובדיקות היחידה בפקודה אחת.
- `npm run check:design`: נכשלת כשקומפוננטה או גיליון סגנון כותבים צבע בעצמם במקום להשתמש בטוקן
  מתוך `src/ui/styles.css`, וכשצבע נמצא מחוץ לפלטה (ניטרלי קר, כחול, כתום, ואדום לשגיאה): מחלקת
  פלטה של Tailwind, צבע CSS בשמו, או טוקן בגוון אחר.
- `npm run verify:rv32`: בדיקת ליבת ה-RISC-V מול Capstone ו-Unicorn. צריך Python עם
  `pip install capstone unicorn`. הפקודה מקודדת כל הוראת RISC-V עם אופרנדים שונים ונותנת ל-Capstone
  לקרוא את הבתים בחזרה, ואז מריצה תוכניות אקראיות מהבתים שלהן ב-Unicorn ומשווה רגיסטרים, PC
  וזיכרון לאלה של האפליקציה. seed אופציונלי נותן סט מקרים אחר: `npm run verify:rv32 -- 7`.
- `npm run verify:6502`: בדיקת ליבת ה-6502 מול py65. צריך Python עם `pip install py65`. האסמבלר של
  py65 מרכיב כל opcode של 6502 שהאפליקציה מקודדת, והסימולטור שלו מריץ תוכניות אקראיות מהבתים שלהן
  ומשווה A, X, Y, SP, P, PC, זיכרון ומספר מחזורי שעון. במצב עשרוני py65 לא משחזר את N, V ו-Z של שבב
  ה-NMOS, ולכן סכומי BCD מושווים רק ב-A ובנשא.

## מבנה הפרויקט

- `src/core/`: ה-CPU, ללא תלות ב-Vue. לכל ארכיטקטורה יש תיקייה משלה, שבנויה על `shared/`.
  - `shared/`: מה שכל ארכיטקטורה בנויה עליו: הממשק `Architecture`, מצב ה-CPU ורשומת ה-undo,
    תוכניות (צעידה, הרצה ועריכות ששומרות על יעדי הקפיצה בשורות הנכונות), וההתקנים שמאחורי פורטי ה-I/O.
  - `x86/`: ה-8086.
    - `state.ts`: רגיסטרים (רגיסטרים של 8 סיביות הם תצוגות על AX..DX), FLAGS וזיכרון של 1MB.
    - `instructions.ts`: סט ההוראות כנתונים. כל מנמוניק מפרט את צורות האופרנדים החוקיות שלו.
    - `builder.ts`: בהינתן המילים שנבחרו עד כה, קובע אילו אופרנדים יכולים לבוא אחריהן.
    - `execute.ts`: מריץ הוראה אחת, מחשב דגלים ומחזיר רשומת undo.
    - `examples.ts`: תוכניות הדוגמה.
    - `decode.ts`, `flagReasons.ts`, `address.ts`: הסברים שנגזרים מהליבה: מה הוראה תקרא ותכתוב, למה
      כל דגל הסתיים ב-0 או ב-1, ואיך `segment:offset` הופך לכתובת פיזית.
    - `encode.ts`: קוד המכונה שכל הוראה מתורגמת אליו. הוא משמש לתצוגה בלבד.
  - `rv32/`: RISC-V (RV32I עם הרחבת M), עם אותם סוגי מודולים: רגיסטרים, סט ההוראות, מפת הזיכרון,
    ההרצה, הקידוד של 32 סיביות, פסאודו-הוראות ודוגמאות.
  - `mos6502/`: ה-MOS 6502 (NMOS): 56 ההוראות ו-13 שיטות המיעון שלהן, מצב עשרוני, ספירת מחזורי
    שעון, פריסת הקוד (הוראות של 1 עד 3 בתים) ודוגמאות.
  - `comparisonTasks.ts` ו-`comparison.ts`: אותן משימות, כתובות לשלושת המעבדים, ומה ההרצה של כל
    תוכנית דורשת (שורות, בתים, הוראות שרצו, כתיבות לזיכרון, מחזורי שעון).
  - `logic/`: לוגיקה ספרתית, שאינה מכירה אף מעבד: שערים ומעגלים שמחושבים באמת (`gates.ts`), מחבר
    ripple-carry (`adder.ts`), מעגל הזזה שבנוי משורות של מתגים (`shifter.ts`), ו-`alu.ts`, שפותר
    פעולת ALU אחת שער אחר שער. מעגלים שיש בהם לולאה מורצים עד שהם מתייצבים (`feedback.ts`):
    הלאצ'ים והפליפ-פלופ (`flipFlop.ts`), ואוגר שעובר מחזור שעון אחד (`register.ts`). אחרי מעגל
    בלי לולאה אפשר לעקוב השהיית שער אחר השהיית שער עד שהוא מתייצב (`propagation.ts`), ואפשר
    לשבור כל שער שלו, כך שהפלט שלו תקוע על 0 או על 1 (`fault.ts`), או לבנות אותו משערי NAND בלבד
    (`nand.ts`). מפענח הוא
    שני מישורים של שערים, שערי ה-AND שמזהים תבנית ושערי ה-OR שהם מזינים (`decoder.ts`), ומונה
    תוכנית הוא שני מחברים, המתגים שבוחרים בין הסכומים שלהם, ואוגר (`programCounter.ts`).
  - `aluLink.ts` ו-`x86AluLink.ts`, `rv32AluLink.ts`, `mos6502AluLink.ts`: הקישור בין הנושאים. כל
    אחד הופך הוראה שבוצעה למעגל שחישב אותה ולחוט שממנו נקרא כל דגל. הבדיקות שלהם מריצות הוראות
    אמיתיות ובודקות שהמעגל נותן את התוצאה ואת הדגלים של המעבד עצמו.
  - `representation/`: מה סיביות אומרות כמספרים, בלי להכיר אף מעבד: הקריאות של ערך
    (`readings.ts`), סכום או הפרש שמחושבים במדויק בסולם ללא סימן ובסולם עם סימן
    (`arithmetic.ts`), ערך צר שמורחב (`extension.ts`) וסכום של ספרות עשרוניות ארוזות (`bcd.ts`).
  - `numberLink.ts` ו-`x86NumberLink.ts`, `rv32NumberLink.ts`, `mos6502NumberLink.ts`: הקישור אל
    נושא המספרים. כל אחד הופך הוראה שבוצעה לחשבון על מספרים ולשאלה שכל דגל עונה עליה. הבדיקות
    שלהם מריצות הוראות אמיתיות ובודקות שהמספרים נותנים את התוצאה ואת הדגלים של המעבד עצמו.
  - `registerLink.ts` ו-`x86RegisterLink.ts`, `rv32RegisterLink.ts`, `mos6502RegisterLink.ts`:
    הקישור אל נושא האחסון. כל אחד הופך הוראה שבוצעה לאוגרים שהיא כתבה: מה כל אחד החזיק, מה נכתב,
    ואילו מהפליפ-פלופים שלו נכתבו. הבדיקות שלהם מריצות הוראות אמיתיות ובודקות שהפליפ-פלופים של
    כל אוגר, בין שנכתב ובין שלא, מחזיקים בסוף את מה שהמעבד מחזיק.
  - `controlLink.ts` ו-`rv32ControlLink.ts`, `x86ControlLink.ts`, `mos6502ControlLink.ts`: הקישור
    אל נושא הבקרה. זה של RISC-V הופך הוראה שבוצעה למילה של 32 סיביות, לשני המפענחים שקוראים אותה
    (`rv32Control.ts`: תשעה סוגי הוראות, והפעולות של ה-ALU) ולמה שקובע את ה-PC הבא; שני האחרים
    מסבירים למה אין להם מה להציג. הבדיקה מריצה כל הוראה של RV32IM ובודקת את המפענחים מול הפענוח
    של המעבד עצמו, ואת ה-PC אחרי השעון מול זה של המעבד.
- `src/ui/`: רכיבי Vue ו-`useCpu`, שעוטף ליבת CPU בריאקטיביות של Vue. לכל ארכיטקטורה יש שולחן
  עבודה (`X86Workbench`, `Rv32Workbench`, `Mos6502Workbench`) שמסדר את החלוניות שלה: המשותפות
  (תוכנית, היסטוריה, בונה, התקנים, ו-`FlatMemory` למרחבי הכתובות השטוחים של RISC-V ושל ה-6502)
  ואלה שלה (`Rv32Diagram`, `Mos6502Diagram`, …). הבונה שואל את הדקדוק של כל ארכיטקטורה
  (`x86Grammar.ts`, `rv32Grammar.ts`, `mos6502Grammar.ts`) מה יכול לבוא אחר כך. לנושאי הלוגיקה,
  המספרים, האחסון והבקרה יש לכל אחד עמוד משלו (`LogicWorkbench`, `NumbersWorkbench`,
  `StorageWorkbench`, `ControlWorkbench`); `useTopic` מחזיק איזה נושא מוצג.
- `src/components/ui/`: רכיבי [shadcn-vue](https://www.shadcn-vue.com) (Tailwind CSS v4 + reka-ui).
  הם נוצרים באמצעות `npx shadcn-vue add <name>`, ולכן אינם נבדקים ב-lint. משתני העיצוב, כולל שני
  צבעי ההדגשה של האפליקציה (`--changed` ו-`--pointer`), נמצאים ב-`src/ui/styles.css`.

## המודל

- אפשר להריץ הוראה מיד (Enter) או להוסיף אותה לתוכנית (Shift+Enter).
- בתיבת ההוראה, מקשי החיצים עוברים בין האפשרויות שמתחתיה (ימינה/שמאלה אחת-אחת, למעלה/למטה לפי שורות) ו-Enter בוחר את המסומנת. כשיש בתיבה מילים או טקסט, מחזיקים Alt כדי להשתמש בחיצים כך; בלי Alt, ימינה ושמאלה עוברים בין המילים ובתוך הטקסט, ולמעלה ולמטה מגיעים לתחילת התיבה ולסופה. שורת המקשים שמתחת לתיבה מציגה את המקשים שפועלים באותו רגע.
- הרצת התוכנית או צעד בה מקפלים את האפשרויות האלה, כך שהתוכנית שמתחת עולה למעלה
  והשורה הנוכחית שלה נשארת גלויה. לחיצה בתיבה, הקלדה או **Show the choices** מחזירות אותן.
- האפשרויות מקובצות לפי משפחה (העברות, חשבון, לוגיקה, הזזות, קפיצות וענפים, המחסנית), כל אחת
  תחת כותרת משלה. הצבע שמור למה שהמעבד עושה: כחול במקום שבו הוא קורא ובמקום שבו נמצא הביצוע,
  כתום במקום שבו הוא כותב.
- **Reset**, בסרגל התחתון ליד Undo, מחזיר את האוגרים, הדגלים והזיכרון לערכי ההתחלה ומנקה את
  ההיסטוריה; התוכנית נשמרת.
  כשיש הוראות בהיסטוריה הוא מבקש אישור קודם, כי Undo לא יכול להחזיר אותן. הוא לא מבקש אישור
  כשכל ההיסטוריה היא התוכנית שרצה עד סופה, כי הרצה חוזרת מחזירה אותה.
- כשהתוכנית הסתיימה, **Step** הופך ל-**Run again**: הוא מאפס את ה-CPU ומריץ את התוכנית מהשורה
  הראשונה. הכפתורים הכבויים אומרים למה כשמצביעים עליהם.
- לסרגל יש מקשים משלו: **F10** מריץ שורה אחת ו-**F8** מריץ או עוצר, בכל מקום שהמיקוד נמצא בו;
  **Ctrl+Z** מבטל את ההוראה האחרונה ו-**Ctrl+Shift+Z** (או Ctrl+Y) מחזיר אותה (Cmd ב-Mac), חוץ
  מאשר כששדה מחזיק טקסט שהקלדת, ושם הם מבטלים את ההקלדה. פלטת הפקודות מציגה כל קיצור ליד
  הפקודה שלו.
- לכל שורת תוכנית יש **Edit** (העיפרון, או תפריט **⋯** במסך מגע): השורה חוזרת לתיבת ההוראה,
  **Enter** או **Replace** שמים את ההוראה המתוקנת במקומה, ו-**Esc** או **Cancel** משאירים את
  השורה כמו שהייתה. תפריט **⋯** גם מזיז שורה למעלה או למטה, וכך גם Alt+Up ו-Alt+Down כשהמיקוד על
  אחד מכפתורי השורה; קפיצות ממשיכות להצביע על ההוראות שעליהן הצביעו. **Inspect machine code**
  באותו תפריט מפרק את בתי השורה בחלונית Machine code, גם כשהחלונית צרה מכדי להציג אותם.
- הזזה, החלפה או מחיקה של שורה בתוכנית שכבר רצה משאירה את מה שה-CPU מחזיק מהריצה, כמו כתובת
  חזרה במחסנית, מצביע על המקום הישן. חלונית התוכנית אומרת זאת, עם **Reset** להרצה מההתחלה.
  פלטת הפקודות יכולה לערוך את השורה שתרוץ הבאה, או להזיז אותה למעלה או למטה.
- התוכנית של כל מעבד נשמרת בדפדפן. אחרי רענון היא חוזרת, במצב התחלתי: הרגיסטרים, הזיכרון
  וההיסטוריה לא נשמרים.
- כשכל החלוניות בעמודה השמאלית פתוחות, התוכנית שומרת כשש משורותיה גלויות, ופתיחת **History**
  מקפלת את האפשרויות של הבנאי כדי לפנות מקום.
- טעינת דוגמה מציגה את שמה ומה היא מדגימה מעל שורות התוכנית, עד שעורכים את התוכנית. דוגמה שלא
  משתמשת בהתקנים סוגרת שוב את חלונית ה-I/O, אם תוכנית היא שפתחה אותה.
- אחרי קפיצה מותנית, כרטיסיית **Cycle** אומרת למה היא נלקחה או לא, עם הערכים שנבדקו:
  `Not taken: JGE jumps when SF = OF, but SF is 1 and OF is 0.`
- רגיסטר שההוראה האחרונה שינתה ממולא בענבר. רגיסטר שהיא כתבה אליו את הערך שכבר היה בו מוקף
  במסגרת מקווקוות במקום, למשל `mov si, 0` כש-SI כבר 0, כך שכתיבה אף פעם לא נעלמת.
- ריחוף מעל שם של רגיסטר או מעל הערך שלו (או הקשה על השם) מראה מה ההוראה האחרונה עשתה לו,
  `Previous 0000 → Now 000A`. כך גם בבית בזיכרון שהיא כתבה, שמסומן בקו במקום במילוי כשהבית שמר
  על ערכו. כש-IP או PC הלכו לכל מקום שאינו ההוראה הבאה כתוב `(jump)`, וב-RISC-V וב-6502 שורת
  ה-PC אומרת מאיפה הוא קפץ.
- אפשר גם לצעוד בשורת תוכנית שלב אחר שלב בעזרת כפתור השלבים שליד **Step**,
  שמציג את השלב שירוץ הבא ואת מקומו (`Fetch · 1/3`): fetch, decode ואז execute. השלבים fetch ו-decode מציגים מה עומד לקרות בכרטיסיית **Cycle** שמעל
  ה-CPU ועל החיווטים; הרגיסטרים, הדגלים והזיכרון משתנים רק ב-execute.
- דיאגרמת ה-CPU בנויה כמו ה-8086 עצמו. **יחידת הביצוע** (EU) מחזיקה את רגיסטרי הנתונים,
  המצביעים והאינדקסים, את ה-ALU ואת הדגלים; **יחידת ממשק ה-bus** (BIU) מחזיקה את רגיסטרי
  הסגמנט, את IP ואת **מחבר הכתובות** (Address adder), שמציג את `segment × 10h + offset` של
  הגישה האחרונה לזיכרון. bus פנימי מחבר בין שתי היחידות, ו-bus חיצוני אחד של כתובות ונתונים
  יוצא מהמחבר אל הזיכרון ואל פורטי ה-I/O. כל חיווט נדלק כקריאה או ככתיבה. מספר פורט מדלג על
  המחבר, ושליפת שורה אינה יוצרת כתובת, כי התוכנית אינה שמורה בזיכרון. הרגיסטרים מוצגים ב-hex
  ובעשרוני; הכפתור **BIN** בכותרת חלונית ה-CPU (או **Show the register bits** בפלטת הפקודות)
  מוסיף את 16 הסיביות של כל אחד.
- הוראות אינן מורצות מתוך בתים, ולכן IP הוא האינדקס של שורת התוכנית הבאה (L0, L1, …), ויעדי
  jump/call הם שורות. CALL דוחף את השורה הבאה למחסנית ו-RET שולף אותה.
- חלונית התוכנית מציגה בכל זאת את קוד המכונה שכל שורה הייתה מתורגמת אליו ב-8086 אמיתי. כפתור
  **Machine code** בסרגל התחתון פותח חלונית שמפרקת הוראה אחת ל-prefix, opcode, ModR/M (עם סיביות
  mod, reg ו-r/m), displacement, immediate ומרחק קפיצה: ההוראה שבבונה, ואם אין כזו, שורת
  התוכנית הבאה. לחיצה על הבתים של שורה מפרקת את אותה שורה.
- אופרנדים של זיכרון הם `byte`/`word` מסוג `[bx]`, `[si]`, `[di]`, `[bp]` או `[offset]`.
  `[bp]` משתמש ב-SS וכל האחרים משתמשים ב-DS.
- חלונית הזיכרון מפרטת איך `segment:offset` הופך לכתובת פיזית של 20 סיביות
  (`segment × 10h + offset`, עם גלישה מעבר ל-1MB) עבור הגישה האחרונה לזיכרון, או עבור כל בית
  שמצביעים עליו. **Show in table** גולל את הטבלה אל הגישה האחרונה. הצבעה על בית מסמנת גם
  את התו שלו בעמודת ה-ascii, ולהפך.
- ספירת הזזה היא `1` או `CL`, כמו ב-8086.
- פקודות המחרוזת (`movsb`/`movsw`, `stosb`/`stosw`, `lodsb`/`lodsw`, `scasb`/`scasw`,
  `cmpsb`/`cmpsw`) קוראות מ-DS:SI, כותבות ל-ES:DI ומתקדמות לפי DF. בוחרים קודם `rep`, `repe` או
  `repne` כדי לחזור על פקודה כל עוד CX ≠ 0; החזרה כולה רצה כצעד אחד.
- `in` ו-`out` מעבירות את AL או AX אל פורטי I/O ומהם; הפורט הוא מספר של 8 סיביות או DX. כפתור
  **I/O** בסרגל התחתון מציג את ההתקנים: נורות LED (out 10h), מתגים (in 11h), שתי ספרות
  7 מקטעים (out 12h ו-13h, סיבית לכל מקטע) ומסוף שמדפיס כל בית שנכתב אליו (out 20h). החלונית
  נפתחת מעצמה כשתוכנית משתמשת בפורט.
- כפתור **Stack** בסרגל התחתון (או **Show the stack** בפלטת הפקודות) מציג את המחסנית של המעבד
  שעל המסך, מהראש כלפי מטה: הכתובת של כל ערך, מה הוא (ערך של רגיסטר, השורה ש-`call` חוזר אליה,
  FLAGS) והפקודה ששמה אותו שם. הערך שהפקודה האחרונה דחפה מסומן ככתיבה; ערך שהיא שלפה נשאר
  מוצג מעל הראש, באפור, כי רק מצביע המחסנית זז והזיכרון עדיין מחזיק אותו. ב-6502 שני הבתים
  ש-`jsr` דוחף הם שורה אחת (כתובת החזרה, פחות 1). ב-RISC-V אין push: הרשימה היא המקום שהתוכנית
  פינתה כשהורידה את `sp`, עם הרגיסטר שממנו נשמרה כל מילה. **In memory** מציג את אותם בתים
  בחלונית הזיכרון.
- `int n` דוחף את FLAGS, CS ו-IP, מאפס את IF ו-TF, וקופץ ל-handler ששמור בווקטור `n`
  (שתי מילים ב-`0000:n×4`: שורת התוכנית של ה-handler ואחריה ה-CS שלו). `iret` חוזר. `mov` מקבל
  שורת תוכנית כמקור (`mov word [0x84], L8`) כדי למלא וקטור. `into` הוא `int 4` כאשר OF = 1,
  וחריגת חלוקה היא `int 0`. וקטור ריק מדווח כשגיאה במקום לקפוץ ל-`0000:0000`. `pushf` ו-`popf`
  מעבירות את FLAGS דרך המחסנית.
- מעבר עם העכבר או מיקוד על דגל מסביר למה ההוראה האחרונה השאירה אותו 0 או 1, עם המספרים של
  אותה הוראה (למשל `7Fh + 01h` גולש כמספר מסומן, ולכן OF = 1). מעבר עם העכבר או מיקוד על שם של רגיסטר מסביר
  למה הוא משמש.
- אפשר לסדר את החלוניות של העמודה השמאלית בכל סדר: גוררים חלונית בכותרת שלה (לחיצה פשוטה על
  הכותרת מקפלת אותה במקום), או ממקדים את כפתור החץ שלה ולוחצים Alt עם החץ למעלה או למטה (Alt+Home
  ו-Alt+End מעבירים אותה לראש העמודה או לסופה). הסדר נשמר, והפקודה **Reset the card order and
  sizes** בפלטת הפקודות (Ctrl+K) מחזירה אותו לברירת המחדל. החלוניות של העמודה הימנית נשארות במקומן.
  במסך רחב כל עמודה נגללת בנפרד, כך שהתוכנית נשארת גלויה לצד עמודת CPU ארוכה, והסרגל התחתון נמצא
  מתחת לשתיהן.
- העמוד מתאים את עצמו למסך. בטאבלט העמודה הימנית תופסת את כל הרוחב, והשמאלית היא מגירה
  שהכפתור **Code** שבראש העמוד מחליק מעליה (Esc סוגר אותה); Reset וכפתורי החלוניות עוברים אל
  **⋯** שבקצה הסרגל התחתון, ובכותרת נשארים הנושאים, בורר המעבד והפקודות, כש-Share, Compare,
  Challenges, הדוגמאות וההגדרות נמצאים בתפריט **⋯** שלה. בטלפון מוצגת תצוגה אחת בכל רגע, ובוחרים אותה מתחת לכותרת: **Code**
  (העמודה השמאלית), **CPU** או **Memory & I/O**. הפס שמעליהן מציג תמיד את ההוראה האחרונה ומה
  שהיא שינתה, בצורה `CX 0000 → 000A`, יחד עם השורה שתרוץ הבאה, והקשה עליו עוברת ל-CPU. כשהשתנה
  יותר ממה שנכנס, `+N` בסופו מציג את כל השינויים. בסרגל התחתון נשארים Step, כפתור
  השלב, Run ו-Undo, והשאר נמצא ב-**⋯** שלו; הנושאים, Share, Compare, Challenges, הדוגמאות וההגדרות
  נמצאים בתפריט **⋯** של הכותרת. טלפון מתחיל עם ה-CPU כטבלאות, ושורה בזיכרון שלו מחזיקה שמונה בתים. במסך מגע לא גוררים
  חלוניות, והקשה על שם של רגיסטר או על דגל מציגה את מה שריחוף מציג עם עכבר.
- העמודה השמאלית עובדת כמו סרגל הצד של עורך קוד. לחיצה על הכותרת של חלונית (או על החץ שלה) מקפלת
  אותה עד הכותרת, ולחיצה נוספת פותחת אותה; ל-**History** ול-**Machine code** יש גם ✕ שסוגר אותן,
  והכפתורים שלהן בסרגל התחתון מחזירים אותן. חוץ מבטלפון, החלוניות הפתוחות מתחלקות בגובה העמודה, כך
  שהעמודה עצמה אף פעם לא נגללת: כל חלונית נגללת בתוך עצמה, אף חלונית לא גדלה מעבר לתוכן שלה, וגרירת
  הקו שבין שתי חלוניות פתוחות (או מיקוד עליו ומקשי החיצים למעלה ולמטה) מעבירה מקום מאחת לשנייה. מה
  מקופל ומה הגובה של כל חלונית נשמרים, ופלטת הפקודות יכולה לקפל או לפתוח כל אחת מהן. העמודה
  השמאלית זהה בשלושת המעבדים: הסדר שלה, מה מקופל, ואילו מבין History, Machine code והתקני ה-I/O
  מוצגים עוברים איתך כשמחליפים מעבד, ונשמרים בין ביקורים.
- גלגל השיניים בפינה העליונה פותח את **Settings**, חלון מעל האפליקציה (בטלפון הוא בתפריט **⋯**
  ותופס את כל המסך). המקטעים שלו: **General** (צליל, שימוש אנונימי), **Appearance** (ערכת הנושא:
  Light, Dark או System, שעוקבת אחרי המכשיר; **Reduce animations**), **CPU** (דיאגרמה או טבלאות,
  הביטים של הרגיסטרים ב-8086, תרשים ה-pipeline, ה-forwarding וחיזוי הענפים של RISC-V; אותם מתגים נשארים גם
  בלוחות שלהם), **Running** (מהירות הריצה, שנשמרת ומשותפת לשלושת המעבדים; האם לוח ה-I/O נפתח
  מעצמו כשתוכנית משתמשת בפורט; האם Reset שואל קודם), **Keyboard** (הקיצורים, לקריאה) ו-**Data**
  (איפוס סידור הלוחות, או מחיקת כל מה שהדפדפן הזה שמר: התוכניות, ההגדרות והסידור). גם פלטת
  הפקודות מציעה את המתגים, ואת **Open the settings…**. האפליקציה נפתחת בערכת הנושא הבהירה עד
  שבוחרים אחרת.
- כשהצליל פועל, האפליקציה משמיעה רמזים קצרים ושקטים, שכולם נוצרים בדפדפן. Fetch, decode ו-execute
  עולים בשלושה צלילים, וכל הוראה נשמעת כמו מה שעשתה: כתיבה לרגיסטר או לזיכרון, המחסנית, קפיצה
  שבוצעה או לא, קריאה או חזרה. להתקנים, ל-undo ול-redo, לבונה ולעריכות בתוכנית יש רמזים קלים יותר
  משלהם. בריצה מהירה נשמעת במקומם פעימה רכה אחת לכל שורה, וב-pipeline של RISC-V תקתוק לכל הוראה,
  עם רמז ל-forward או ל-stall. שום דבר לא מתנגן כשהלשונית מוסתרת.
- **Reduce animations** בהגדרות או בפלטת הפקודות מכבה את הערכים שעפים בין הלוחות, את ההבזקים ואת החוטים
  הזוהרים; הערכים שהשתנו נשארים מסומנים. ההגדרה נשמרת, והיא פועלת מעצמה כשהמערכת מבקשת להפחית
  תנועה.
- ההסבר של כל חלונית נמצא מאחורי כפתור ה-ⓘ שליד שמה, כך שהוא זמין כשרוצים אותו ולא מפריע בשאר
  הזמן.

## מצב RISC-V

- עוברים בעזרת **8086 / RISC-V** בראש העמוד, או **Switch to …** בפלטת הפקודות. הבחירה נשמרת.
- 32 רגיסטרים, `x0` עד `x31`, שמוצגים בשמות ה-ABI שלהם (`zero`, `ra`, `sp`, `a0`–`a7`,
  `t0`–`t6`, `s0`–`s11`). `x0` תמיד קורא 0, וכתיבה אליו נזרקת.
- PC הוא כתובת אמיתית. כל הוראה היא 4 בתים, ולכן שורה `Ln` נמצאת בכתובת `4n`. `jal` שם ברגיסטר
  שלו את הכתובת של ההוראה הבאה (`ra` בקריאה לפונקציה), ו-`ret` הוא `jalr zero, 0(ra)`.
- הזיכרון הוא מרחב אחד שטוח של כתובות של 32 סיביות: 1MB של RAM החל מ-`0x00000000`, כשהקוד של
  התוכנית בתחילתו, וההתקנים החל מ-`0x10000000`. אפשר לקרוא את הקוד (זה קוד המכונה שלו), אבל כתיבה
  לתוכו היא שגיאה: התוכנית לא יכולה לשנות את עצמה. גם גישה שאינה מיושרת לגודל שלה, או לכתובת שאין
  בה כלום, היא שגיאה.
- אופרנד של זיכרון הוא `offset(base)`. מקלידים את ה-offset ואז בוחרים את הרגיסטר; או בוחרים את
  הרגיסטר מיד בשביל offset של 0.
- אין הוראות I/O: ההתקנים הם בתים בזיכרון. נורות ב-`0x10000010`, מתגים ב-`0x10000011`, שתי
  הספרות ב-`0x10000012` ו-`0x10000013`, המסוף ב-`0x10000020`. ניגשים אליהם עם `lbu` ו-`sb` (בית
  אחד בכל פעם).
- פסאודו-הוראות (`li`, `mv`, `not`, `neg`, `nop`, `j`, `jr`, `ret`, `beqz`, `bnez`, `bgt`,
  `ble`, …) מופיעות אחרי ההוראות האמיתיות. השורה שמתחת לתיבה אומרת למה פסאודו-הוראה הופכת, והוספה
  שלה מוסיפה את ההוראות האמיתיות. `li` עם ערך שלא נכנס ב-12 סיביות הופכת ל-`lui` ואחריה `addi`.
- אין דגלים. כרטיסיית **No flags** מראה מה הענף האחרון השווה, והאם השווה מספרים מסומנים או לא
  מסומנים; `slt` ו-`sltu` כותבות את התשובה שלהן, 1 או 0, לרגיסטר.
- חלוקה ב-0 לא עוצרת: המנה היא כולה אחדות (-1) והשארית היא המחולק.
- דיאגרמת ה-CPU היא מסלול הנתונים של מעבד single-cycle: קובץ הרגיסטרים, חמשת השלבים (fetch,
  decode, execute ב-ALU, memory, write back) ומאיפה מגיע ה-PC הבא. צעידה לפי שלבים מראה את
  התוכנית של כל שלב לפני שהוא רץ.
- **Pipeline** בכרטיסיית ה-Cycle (או **Show the pipeline** בפלטת הפקודות) מציג את ההוראות שרצו
  כפי שה-pipeline הקלאסי בן חמשת השלבים היה מריץ אותן, IF, ID, EX, MEM ו-WB, עד חמש בבת אחת, מחזור
  אחר מחזור. משבצת מקווקוות היא מחזור של המתנה: הוראה שצריכה ערך שטעינה עוד לא הביאה מחכה מחזור
  אחד ב-ID. ענף או קפיצה משנים את PC ב-EX, שני מחזורים אחרי שנשלפו, ולכן מה שנשלף אחריהם עד אז הוא ניחוש;
  כשהניחוש שגוי, שתי ההוראות שנשלפו אחריהם מסומנות בקו (flush). **Branches** בוחר איך מנחשים ענף
  מותנה: **Not taken** (נשלפות השורות הבאות), **Taken** (נשלף היעד שלו), **1 bit** (מה שהענף הזה
  עשה בפעם הקודמת) או **2 bits** (מה שעשה ברוב הפעמים: כשהניחוש כבר בטוח, ניחוש שגוי אחד לא משנה אותו). ✓ על
  ה-EX של ענף הוא ניחוש נכון, ✗ ניחוש שעלה ב-flush; הריצו לולאה תחת כל אחד כדי לראות כמה היא
  מפסידה. קפיצה (jump) נפתרת תמיד ב-EX. כיבוי **Forwarding** מראה כל הוראה מחכה ב-ID עד שזו שלפניה כתבה את התוצאה שלה. כשהוא
  פועל, קו כחול לאורך התרשים מחבר EX לשלב שמעליו שמסר לו תוצאה לפני שנכתבה חזרה. השלבים של
  ההוראה האחרונה שרצה צבועים בכחול. מתחת
  לתרשים משפט מסביר למה קרתה כל השהיה וכל flush, ושורה מסכמת את המחזורים ואת הענפים שנוחשו נכון, ומתחתיהן כתוב מה ההוראה
  האחרונה עשתה, באותן מילים שבתצוגת One by one. המעבד עצמו עדיין מריץ
  הוראה אחת בכל פעם; התרשים מחושב מתוך ההיסטוריה.
- חלונית **Machine code** מציגה את 32 הסיביות של הוראה, וכל שדה מעל הסיביות שלו: opcode, rd,
  funct3, rs1, rs2, funct7 וחלקי ה-immediate, שהוראות B ו-J מפצלות לאורך המילה.
- חלונית הזיכרון קופצת אל **Code**, **Data**, **Stack** או **Devices**. קוד מכונה מוצג בהדגשה,
  רגיסטרים של התקנים בקו תחתון מנוקד, ונקודות מסמנות כתובות שאין בהן כלום.

## מצב 6502

- 6502 היא האפשרות השלישית בראש העמוד. זה שבב ה-NMOS של ה-Apple II, ה-Commodore 64 וליבת
  המעבד של ה-NES: שלושה רגיסטרים של 8 סיביות (A, X, Y), מצביע מחסנית של 8 סיביות ו-PC של 16
  סיביות.
- רק A עושה חשבון ולוגיקה, ורק עם בית מהזיכרון או עם ערך מיידי. X ו-Y סופרים ומשמשים כאינדקס;
  כדי לחבר את X ל-A צריך לשמור את X בזיכרון קודם.
- אחרי המנמוניק מקלידים מספר (`$10`, `16` או `0x10`): התיבה מציעה כל שיטת מיעון שהוא מתאים לה,
  `#$10`, `$10`, `$10,x`, `$0010`, `$0010,x`, `($10,x)`, `($10),y` וכן הלאה. השורה שמתחת לתיבה
  אומרת מה המסומנת אומרת וכמה מחזורי שעון היא לוקחת. הזזה מציעה גם `a`, וענף, JMP או JSR מציעים
  את שורות התוכנית.
- PC הוא כתובת אמיתית, והוראה היא 1 עד 3 בתים, ולכן הכתובת של כל שורה תלויה בשורות שלפניה. הקוד
  מתחיל ב-`$0600`, ה-zero page הוא `$0000`–`$00FF`, המחסנית היא עמוד `$01`, ההתקנים ב-`$D000`
  (נורות `$D010`, מתגים `$D011`, ספרות `$D012` ו-`$D013`, מסוף `$D020`), והווקטור של BRK ב-`$FFFE`.
- דיאגרמת ה-CPU מציגה את הרגיסטרים והדגלים, את החישוב ב-ALU, את **יחידת הכתובת** (איך שיטת
  המיעון יצרה את הכתובת: `$02F0 + X ($20) = $0310`, או המצביע שנקרא מה-zero page) ואת מחזורי השעון
  שההוראה לקחה, כולל המחזור הנוסף על חציית עמוד או על ענף שנלקח.
- כרטיסיית הדגלים אומרת למה ההוראה האחרונה קבעה כל דגל. במצב עשרוני (אחרי `sed`) שבב ה-NMOS לוקח
  את N, V ו-Z מסכומי ביניים, והאפליקציה מראה גם את זה.
- JSR דוחפת את הכתובת של הבית האחרון שלה, ו-RTS מוסיפה לה 1; **Stack** בחלונית הזיכרון מראה את
  שני הבתים. `JMP ($xxFF)` קוראת את הבית העליון מ-`$xx00`, כמו השבב המקורי. BRK היא שני בתים
  (המעבד מדלג על זה שאחריה), ולכן RTI חוזרת לשורה הבאה.

## אתגרים

- **Challenges** בראש העמוד (בטלפון: בתפריט **⋯**), או **Open the challenges…** בפלטת הפקודות, מציג
  חמש משימות קטנות למעבד שעל המסך: להדליק את דגל ה-overflow בלי ה-carry, להכפיל בעשר בלי הוראת
  כפל, להחליף שני רגיסטרים בלי מקום נוסף, ועוד. **Start** מחליף את התוכנית של אותו מעבד בשורות
  הנתונות של המשימה, כמו דוגמה.
- חלונית **Challenge** נפתחת בראש סרגל הצד עם המשימה, מה שהתוכנית צריכה לעשות ובמה היא צריכה
  לעמוד (מספר שורות, הוראות שאסור להשתמש בהן). השורות הנתונות נעולות, עם מנעול ליד כל אחת
  בתוכנית: אי אפשר לערוך, להזיז או למחוק אותן, שורות חדשות נכנסות מתחתיהן, וניקוי התוכנית
  משאיר אותן. כל תנאי מסומן ברגע שהתוכנית עומדת בו: התוכנית
  מורצת מחדש על מעבד משלה אחרי כל עריכה, כך שהמעבד שעל המסך לא משתנה ואפשר להמשיך לצעוד בניסיון
  שלכם. משימה עם שורות נתונות מורצת גם עם ערכים אחרים בהן, כך שכתיבת התשובה ישירות לא עוברת.
- מתחת לרשימה שורה אומרת איפה התוכנית עומדת, וכשהיא עוברת, כמה שורות היא לקחה ביחס ל-par.
  **Show a hint** נותן רמז, **Start over** מחזיר את המשימה למצב ההתחלתי, וסגירת החלונית (או טעינת
  דוגמה) עוזבת את האתגר. אתגרים שנפתרו מסומנים ברשימה עם מספר השורות הקטן ביותר שלקחו, ונשמרים
  בין ביקורים.

## השוואת המעבדים

- **Compare** בראש העמוד (בטלפון: בתפריט **⋯**), או **Compare the CPUs on the same task…** בפלטת הפקודות,
  פותח את אותה משימה כתובה לשלושת המעבדים: חיבור 1 עד 10, סכום של 16 סיביות, כפל, מילוי זיכרון,
  קריאה לפונקציה והדלקת הנורות.
- טבלה מעמידה זו מול זו את מספר השורות ובתי קוד המכונה של התוכנית, את ההוראות שהיא מריצה, את
  הבתים שהיא כותבת לזיכרון (כולל המחסנית), ובמקרה של ה-6502 גם את מחזורי השעון. הקטן ביותר בכל
  שורה בולט. פסקה מסבירה מאין ההבדל: REP STOSB מול לולאה, כתובת חזרה במחסנית או ב-`ra`, הוראת
  כפל או היעדרה.
- התוכנית של כל מעבד מוצגת עם קוד המכונה שלה ועם מה שהיא משאירה אחריה. **Load into …** מחליף
  בה את התוכנית של אותו מעבד, כמו דוגמה, ועובר אליו.

## ניחוש לפני ההרצה

- **Guess** בסרגל שבתחתית (בטלפון ובטאבלט: בתוך **⋯**), **Guess before it runs** בהגדרות תחת Running,
  או אותה פקודה בפלטת הפקודות, מדליקים את מצב הניחוש. הוא כבוי עד שמדליקים אותו.
- לפני שהוראה רצה נשאלת עליה שאלה אחת, מעל הסרגל: האם קפיצה או הסתעפות מותנית תילקח, איזה ערך
  יהיה באוגר (מקלידים בהקסדצימלי; `-1` פירושו המשלים לשתיים שלו), או אילו דגלים השוואה משאירה
  על 1 (CMP ו-TEST ב-8086; CMP, CPX, CPY ו-BIT ב-6502). הוראה שאין מה לשאול עליה (כתיבה לזיכרון,
  PUSH, קפיצה לא מותנית) רצה כרגיל.
- **Check** (Enter בתיבת התשובה) מריץ את ההוראה ובודק את התשובה מול המעבד: נכון או לא, מה המעבד
  עשה, ולמה, במילים של הלוחות (הסכום, הסיבה שדגל קיבל את ערכו, התנאי של הקפיצה). **Skip** (Esc, או
  Step פעם נוספת) מריץ אותה בלי תשובה. מונה של התשובות בריצה הזאת נשאר ליד התשובה האחרונה; Reset
  מאפס אותו.
- בהגדרות בוחרים מתי הוא שואל, כל אחד לחוד, וכולם דלוקים בהתחלה: בצעד של התוכנית, בהוראה שמריצים
  מהבונה, ובזמן ריצה. ריצה מחכה בכל שורה שיש עליה שאלה, ממשיכה אחרי תשובה נכונה ונעצרת אחרי
  שגויה; במהירות Instant היא לא שואלת.

## מפעולה לשערים שלה

- **CPU**, **Logic**, **Numbers**, **Storage** ו-**Control** בראש העמוד (בטלפון: בתפריט **⋯**) מחליפים בין
  הנושאים.
  **Gates**, ליד
  התוצאה בחלונית ה-ALU של מעבד, פותח את נושא הלוגיקה על הפעולה שאותו מעבד ביצע זה עתה; כך גם
  **Show the gates behind the last operation** בפלטת הפקודות.
- העמוד מציג את הפעולה כמעגל, עם הסיביות של המעבד עצמו על החוטים: מחבר מלא מתחת לכל סיבית,
  כשהנשא מתגלגל ביניהם (חיסור הוא אותו מחבר עם B הפוך), שער אחד לכל סיבית ב-AND, ב-OR וב-XOR, או
  מעגל הזזה ששורות המתגים שלו מזיזות את הסיביות. ה-8086 וה-6502 מזיזים מקום אחד בכל שורה;
  ל-RISC-V יש barrel shifter של חמש שורות.
- לחיצה על מחבר, על שער או על סיבית בשורה של מעגל ההזזה מציגה את אותה סיבית שער אחר שער, עם
  טבלת האמת של כל שער שלוחצים עליו והביטויים הבוליאניים שהוא מחשב.
- **Slow down time**, מעל מחבר, מציג אותו השהיית שער אחת בכל פעם: לכל שער לוקח השהיה אחת להגיב,
  ולכן הנשא מטפס שתי השהיות לכל סיבית והסכום שגוי בדרך. אפשר לצעוד בין ההשהיות, לנגן אותן או לגרור
  ביניהן; סיבית מקווקוות עוד תשתנה, ו-**ready at** מציין באיזו השהיה כל סיבית של התוצאה מתייצבת.
  סיבית שהופכים מתחילה מהחוטים כפי שהיו, כך שזז רק מה שהיא מגיעה אליו; **Longest carry** טוען את
  הערכים שמעסיקים את המחבר הכי הרבה זמן. אותן פעולות נמצאות גם בפלטת הפקודות, תחת **Gate delays**.
- **שבירת שער**: מתחת לטבלת האמת של השער שלחצתם עליו, **Stuck at 0** או **Stuck at 1** מחזיקים
  את הפלט שלו על הערך הזה, יהיו הקלטים אשר יהיו. שורה מעל המעגל מציבה את התשובה של המעגל השבור
  ליד התשובה של מעגל תקין, הסיביות השגויות בתוצאה מסומנות בקו תחתון, והדגלים הולכים אחרי החוטים
  השבורים. לעיתים קרובות שום דבר לא שגוי: הקלטים מסתירים תקלה כשהשער היה מוציא את הערך הזה
  ממילא, ולכן הפכו סיבית כדי לתפוס אותה. כשהזמן מואט, השגיאה מתפשטת מהשער השהיה אחר השהיה.
  תקלה נשארת כל עוד המעגל הוא אותו מעגל, כך שאפשר לצעוד במעבד ולראות אילו הוראות היא מקלקלת;
  המעבד עצמו אינו מושפע לעולם. **Works** מתקן את השער ו-**Repair every gate** מתקן את כולם (גם
  בפלטת הפקודות, תחת **Faults**).
- **As NAND gates**, מתחת לשער שלחצתם עליו, מצייר את אותו שער כשהוא בנוי משערי NAND בלבד, עם
  הערכים שעל החוטים שלו עכשיו: שניים ל-AND, שלושה ל-OR, ארבעה ל-XOR או למתג של מעגל ההזזה.
  מתחתיו כתוב המחיר, שמחושב מבנייה אמיתית של המעגל בדרך הזו: כמה שערי NAND צריכים השער, הסיבית
  שלו והמעגל כולו, ובכמה מתארך המסלול הארוך ביותר.
- **Where each flag comes from** מציין את החוט שמאחורי כל דגל. ה-CF של ה-8086 אחרי חיסור הוא
  ההיפוך של הנשא היוצא; ה-C של ה-6502 הוא הנשא היוצא עצמו; ל-RISC-V אין דגלים, ולכן הסתעפות או
  `slt` קוראות חוט אחד של חיסור.
- לחיצה על סיבית של קלט הופכת אותה ומראה מה המעגל היה מחשב (**What if**). המעבד אינו משתנה;
  **The CPU's values** מחזיר את הסיביות שלו. אפשר לשנות גם את הפעולה ואת הרוחב, ולנסות מעגל באופן
  חופשי.
- החצים עוברים לפעולה שלפני זו או אחריה בהיסטוריה של המעבד, ו-**Back to the …** חוזר למעבד
  בהוראה המוצגת.
- לכפל, לחילוק ולמצב העשרוני של ה-6502 אין עדיין מעגל: שם **Gates** אפור ומסביר למה.
- **What it means as numbers**, בתחתית העמוד, פותח את אותה פעולה בנושא המספרים, **How the
  result is kept** פותח את נושא האחסון, ו-**What picks the operation** פותח את נושא הבקרה.

## מפעולה למספרים שלה

- **Numbers**, ליד **Gates** בחלונית ה-ALU של מעבד, פותח את נושא המספרים על הפעולה שאותו מעבד
  ביצע זה עתה; כך גם **Show the last operation as numbers** בפלטת הפקודות.
- סכום או הפרש מוצגים על שני גלגלים, אחד של מספרים ללא סימן ואחד של מספרים עם סימן. אותן סיביות
  מתחילות ומסתיימות באותו מקום בשניהם; ההבדל הוא איפה כל גלגל נגמר ומתחיל מחדש. צעד מעל התפר
  הזה הוא תשובה שלא נכנסה, וכל מעבד שומר לה דגל: CF ו-OF ב-8086, C ו-V ב-6502. מתחת לכל גלגל
  מופיע הסכום כפי שאותו סולם קורא אותו, והאם הוא נכנס.
- **What each flag says** מציג כל דגל כשאלה על המספרים. ה-C של ה-6502 אחרי חיסור עובד הפוך (1
  פירושו שלא היה שאל); ל-RISC-V אין דגלים, ולכן `slt`, `sltu` וההסתעפויות משוות בסולם שהשם שלהן
  בוחר.
- `lb`, `lh`, `lbu` או `lhu` של RISC-V מוצגות כהרחבה: הבית או חצי המילה מעל 32 הסיביות שהם
  נעשים, הסיביות החדשות כולן העתקים של הסיבית העליונה או כולן אפסים, ואיזה משני המספרים זה שומר.
- `adc` או `sbc` של ה-6502 במצב עשרוני, שאין להם שערים להציג, מוצגים כאן ספרה אחר ספרה: כל חצי
  של הבית מסוכם בבינארי, ומתוקן ב-6 כשהוא עובר את 9.
- לחיצה על סיבית הופכת אותה, וגרירה של הנקודה הכחולה סביב גלגל מזיזה אותה (גם מקשי החצים), ומראות
  מה התשובה הייתה (**What if**). המעבד אינו משתנה. אפשר לבחור באופן חופשי בין **Add**,
  **Subtract**, **Extend**, **Decimal** ו-**One value** (שורת סיביות שנקראת כהקסה, ללא סימן, עם
  סימן, ASCII וספרות עשרוניות), וגם את הרוחב.
- פעולות לוגיות על סיביות, הזזות, כפל וחילוק אינם מוצגים עדיין כמספרים: שם **Numbers** אפור
  ומסביר למה.

## מהוראה לאוגר ששומר את התוצאה שלה

- **Stored**, בראש חלונית האוגרים של מעבד, פותח את נושא האחסון על האוגר שההוראה האחרונה כתבה; כך
  גם **Show how the last register written is kept** בפלטת הפקודות.
- האוגר מוצג כשורות של סיביות: הערך שמחכה על הכניסות, קו כתיבה לכל סיבית, פליפ-פלופ מתחת לכל
  עמודה, ומה שהפליפ-פלופים מחזיקים. העמוד נפתח לפני קצה השעון, כשהערך הישן עדיין מוחזק. **Raise
  the clock** טוען את הערך החדש; **Lower the clock** מסיים את המחזור, ו-**Start over** מתחיל
  אותו מחדש.
- סיבית שקו הכתיבה שלה 0 שומרת את ערכה, לא משנה מה מחכה על הכניסה שלה. ב-8086, כתיבה ל-AL מדליקה
  רק את שמונת קווי הכתיבה הנמוכים של AX: AL ו-AH הם חצאים של אוגר אחד, לא אוגרים משל עצמם. הוראה
  שכתבה כמה אוגרים (`xchg`, `mul`, `pop`) מציגה אותם לבחירה.
- לחיצה על פליפ-פלופ מציגה את אותה סיבית שער אחר שער: המתג שבוחר בין הכניסה לבין היציאה של הסיבית
  עצמה, ואחריו שני הלאצ'ים של הפליפ-פלופ, עם הערכים של אותו רגע במחזור השעון על כל חוט וטבלת האמת
  של כל שער שלוחצים עליו.
- **SR latch**, **D latch** ו-**Flip-flop** מציגים את התאים שמהם נבנית סיבית של אוגר, וכל אחד
  מהם מופעל ביד. כששתי הכניסות של ה-SR latch הן 1, **Let go of both at once** מציג את המקרה
  היחיד שבו הוא אינו יכול להחליט מה הוא מחזיק.
- מתחת לכניסות שלהם דיאגרמת תזמון מציירת כל חוט כגל, עם צעד לכל שינוי שעושים (16 האחרונים) ושורה
  שאומרת מה הצעד עשה. היא מראה את מה שהשערים לבדם אינם מראים: D latch עוקב אחרי D כל עוד E הוא 1,
  ופליפ-פלופ לוקח את D רק במקום שבו השעון עולה, שקו מנוקד מסמן. **Pulse** מעלה ומוריד את E או את
  השעון בלחיצה אחת, ו-**Clear** מתחיל את הדיאגרמה מחדש.
- לחיצה על סיבית של הכניסה או של קו הכתיבה הופכת אותה ומראה מה האוגר היה מחזיק (**What if**).
  המעבד אינו משתנה. אפשר לשנות גם את הרוחב.
- להוראה שלא כתבה אוגר (השוואה, כתיבה לזיכרון, הסתעפות) אין מה להציג: שם **Stored** אפור ומסביר
  למה. כך גם `x0` של RISC-V, שאין לו פליפ-פלופים, וקפיצה, שכותבת רק את מצביע ההוראה: האופן שבו
  האוגר הזה נטען בכל הוראה מוצג בנושא הבקרה, עבור RISC-V.
- **The gates that work a value out**, בתחתית העמוד, פותח את נושא הלוגיקה, ו-**What turns the
  write line on** פותח את נושא הבקרה.

## מהוראה לקווי הבקרה שלה

- **Control**, בראש העמוד, פותח את נושא הבקרה על ההוראה האחרונה שהמעבד הריץ; כך גם **Control**
  בחלונית המחזור בחלון רחב, ו-**Show how the last instruction was decoded** בפלטת הפקודות.
- ההוראה מוצגת כפי שיחידת הבקרה מקבלת אותה: 32 סיביות, עם השדות שהן מתחלקות אליהם. השדות שמפענח
  קורא (ה-opcode, funct3 ושתי סיביות של funct7) מסומנים במסגרת.
- **The main decoder** הוא רשת של השערים שמהם הוא בנוי. כל שורה היא שער AND שמזהה סוג אחד של
  הוראה לפי ה-opcode שלו; השורה שהמילה הדליקה מסומנת. כל עמודה מימין היא שער OR, עם נקודה בכל
  שורה שמזינה אותו: RegWrite, ALUSrcB, MemRead, Branch, Jump והשאר. **The ALU decoder** שמתחתיו
  קורא את מה שהראשון מצא יחד עם funct3 ו-funct7, וקובע את הקווים של ה-ALU: Sum, Sub, Shift,
  ובהסתעפות גם איזה חוט של החיסור נקרא.
- **What the lines tell the CPU** מפרט כל קו שערכו 1 ומה הוא עושה. **Gates** ליד קו של ה-ALU
  פותח את נושא הלוגיקה על אותה הוראה, ו-**Stored** ליד RegWrite פותח את נושא האחסון.
- **Where PC goes next** מציג את PC + 4 ואת PC + ה-immediate, כל אחד ממחבר משלו, את הקווים
  Branch ו-Jump ואת קו ההשוואה שבוחרים ביניהם, ואת PC עצמו כאוגר: **Raise the clock** טוען את
  הכתובת שנבחרה. הוראה שהורצה לבדה, ולא נשלפה מהתוכנית, משאירה את PC במקומו אלא אם היא קופצת.
- לחיצה על סיבית של המילה הופכת אותה ומראה מה המפענחים עושים ממנה (**What if**): סיבית 30 הופכת
  ADD ל-SUB, ו-opcode שאין לאף הוראה מכבה את כל הקווים. המעבד אינו משתנה, ולמילה ששונתה אין PC
  לעקוב אחריו.
- זוהי יחידת הבקרה של RISC-V. ה-8086 מפענח בעזרת מיקרוקוד וה-6502 בעזרת טבלה שנקראת מחדש בכל
  מחזור: שם **Control** אפור ומסביר למה, והעמוד מציע מילה של RISC-V לניסוי ביד.

## שיתוף תוכנית

- **Share** בראש העמוד (**Share this program** בתפריט **⋯** בטלפון, או **Share this program…**
  בלוח הפקודות) פותח קישור לתוכנית המוצגת. מי שפותח אותו מקבל את אותה תוכנית על אותו מעבד,
  מוכנה להרצה.
- הקישור נושא את המעבד ואת התוכנית בלבד: בלי אוגרים, זיכרון, היסטוריה או מתגי ההתקנים. התוכנית
  נמצאת בקישור עצמו (החלק שאחרי `#`, שהדפדפן לעולם אינו שולח לשרת), כך ששום דבר אינו מועלה ואין
  צורך בחשבון.
- פתיחת קישור מחליפה את התוכנית של אותו מעבד ומאפסת אותו. אם יש לך שם תוכנית אחרת, האפליקציה
  שואלת קודם; **Keep my program** משאיר הכול כפי שהיה.
- קישור שנקטע בדרך, או שנוצר בגרסה חדשה יותר של האפליקציה, אינו פותח דבר ואומר זאת.

## משוב

- בועת הדיבור בראש העמוד (**Send feedback** בתפריט **⋯** בטלפון ובלוח הפקודות) פותחת טופס קצר:
  רעיון, בעיה או כל דבר אחר, עם כתובת מייל רק אם רוצים תשובה.
- עם ההודעה נשלחים: הנושא והמעבד המוצגים, גודל המסך, ערכת הצבע וגרסת האפליקציה. התוכנית שלך
  אינה נשלחת.
- היעד נקבע בזמן הבנייה במשתנה `VITE_FEEDBACK_ENDPOINT` (שירות טפסים שמקבל `POST` של JSON,
  ב-`.env.production`). בנייה בלעדיו אינה מציעה משוב; `npm run dev` מציג את הטופס ומדפיס את
  ההודעה ל-console במקום לשלוח אותה.

## פרטיות

- האתר החי סופר איך משתמשים בו, דרך [Umami](https://umami.is): צפיית העמוד של הביקור (עם מה
  ש-Umami גוזר מהבקשה, כמו המדינה והדפדפן), ורשימה קצרה של אירועים: הנושא והמעבד המוצגים, ההוראה
  הראשונה שמעבד מריץ בביקור, הרצת תוכנית, טעינת דוגמה או משימת השוואה (לפי שם), פתיחת ההשוואה,
  פתיחת השערים, המספרים או האוגר של הוראה, העתקה או פתיחה של קישור שיתוף (לאיזה מעבד, לעולם לא התוכנית), שגיאת
  מעבד (שהיא קרתה, לעולם לא הטקסט שלה), תשובה לניחוש (נכונה או לא, לעולם לא התשובה עצמה) ושליחת
  משוב (הסוג שלו).
  הרשימה נמצאת ב-`src/ui/analyticsEvents.ts`.
- שום אירוע אינו נושא את מה שכתבת: לא התוכנית, לא ערך ולא הודעה. Umami אינו שומר עוגייה,
  והאפליקציה אינה מוסיפה מזהה משלה.
- **Share anonymous usage** בהגדרות (ובלוח הפקודות) מכבה את הספירה; כך גם הגדרת Do Not Track של
  הדפדפן. אם היא כבויה לפני טעינת העמוד, הסקריפט אינו נטען כלל.
- הספירה פועלת רק בבניית production שמציינת אתר (`VITE_UMAMI_WEBSITE_ID` ב-`.env.production`,
  עם `VITE_UMAMI_DOMAINS` לשמות המארחים שנספרים). `npm run dev` ובנייה בלעדיו אינם טוענים דבר.
- התוכניות וההגדרות שלך נשארות באחסון המקומי של הדפדפן. קישור שיתוף מחזיק את התוכנית שלו בחלק
  ה-`#` של הכתובת, שאינו נשלח לשרת או ל-Umami. הגופנים נטענים מ-Google Fonts.

</div>
