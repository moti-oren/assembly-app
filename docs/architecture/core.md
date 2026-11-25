# The map of `src/core/`

What every file of the core holds.
Every sentence is on a line of its own: Grep the map for a file or a word, and read it whole only
to plan a change across the layer. It is not loaded with `CLAUDE.md`, which keeps the rules.

- `src/core/` is the CPU and **must not depend on Vue**.
  All logic is tested here.
  It holds one folder per architecture, built on `shared/`, and one for each of the other topics.
  - `shared/`: what every architecture is built on.
    It never imports an architecture.
    - `architecture.ts`: the `Architecture` interface: an architecture's state, how it executes a program line, where its instruction pointer is in the program (`nextLine` / `setNextLine`), its example programs and its challenges.
    - `program.ts`: a program is a list of instructions; stepping, running (with the step and memory-write limits), and edits (insert, remove, replace, move) that keep jump targets on the right lines.
    - `state.ts`: the CPU state every architecture has (registers by name, flags, memory, I/O ports), snapshots, and memory and port access.
    - `executionRecord.ts`: the **undo record** every architecture extends (history/undo depends on it), with `undo` and `redo`.
    - `challenge.ts`: a `Challenge` (a task, its goals in words, the lines the learner may not use or exceed, and one or more cases: the given lines a program starts with, a test per goal, and an optional `setup` that fills the fresh CPU with other values so a solution cannot borrow a zero from it) and `checkChallenge`, which runs a program **on a fresh CPU** once per case, with that case's given lines, and says which goals and limits it meets.
      Each architecture lists its own in `challenges.ts`; the test beside it holds a reference solution for every challenge, which must pass in par, and checks that the given lines alone do not.
    - `devices.ts` (the devices behind the ports), `numbers.ts`, `cpuError.ts` (`CpuError`, the error the CPU raises on purpose).
  - `x86/`: the 8086.
    `architecture.ts` exports `X86`, and `examples.ts` its example programs.
    - `state.ts`: the 8086 registers (8-bit registers are views into AX..DX), FLAGS, 1MB of memory and segment:offset addresses.
    - `instructions.ts`: the instruction set expressed as data; each mnemonic lists its legal operand forms.
      Adding an instruction starts here.
    - `builder.ts`: given the words chosen so far, computes which operands may come next (drives the UI's word-by-word builder).
    - `execute.ts`: runs one instruction and returns its record, which adds the ALU trace and the interrupt to the shared one.
      Below it:
      - `executionContext.ts`: what an instruction runs against (reads, writes, flags, ALU, stack, interrupts), recording everything the undo record needs; also the `AluTrace` and the `Handler` type.
      - `handlers.ts`: the table of what every mnemonic does, with the larger handlers in `multiplyDivide.ts` (and the divide error), `shift.ts` and `stringInstructions.ts` (including the `rep` loop).
    - `decode.ts`: what an instruction reads and writes (registers, memory, ports, flags, ALU), including registers it uses without naming them.
      The diagram and the fetch/decode/execute view are driven by it.
    - `encode.ts`: the 8086 machine code of an instruction, split into fields (prefix, opcode, ModR/M, …), and `assemble` for a whole program.
      **Display only**; nothing executes these bytes.
      `encodingFields.ts` builds the fields (ModR/M, immediates, jump distances) and `instructionEncoders.ts` holds the opcode tables and one encoder per kind of instruction.
    - `address.ts` and `flagReasons.ts`: explanations for the UI, worked out from state and the undo record: how segment:offset becomes a 20-bit address, and why each flag got its value.
  - `rv32/`: RISC-V, RV32I with the M extension.
    `architecture.ts` exports `RV32`.
    - `registers.ts` (x0..x31 and their ABI names), `bits.ts` (32-bit arithmetic: values are kept unsigned with `u32`), `operands.ts`, `instructions.ts` (one form per mnemonic, and its format R/I/S/B/U/J).
    - `state.ts`: the memory map (1MB RAM at 0, the devices at 0x10000000), PC and the line it points at.
    - `execute.ts` runs an instruction, with the operations in `alu.ts` and loads and stores in `memory.ts` (alignment, access faults, devices, and the code read as its machine code).
    - `decode.ts`: rd, rs1, rs2, the immediate, and what each stage will do (ALU inputs, memory access, write back, next PC), for the diagram and the cycle panel.
    - `encode.ts`: the 32-bit word and its fields as bit ranges (`fieldsFor` lays them out from a mnemonic, its registers and its immediate); `disassemble.ts`: a word read back as an instruction, by the encoder's own `OPCODES` and with all of funct7, and its fields (`wordLayout`).
      **Display only**, as the encoder is; `pseudo.ts`: pseudo-instructions (`li`, `mv`, `j`, `ret`, `beqz`, …) and the real instructions they expand to; `examples.ts`.
    - `pipeline.ts`: how the executed instructions would flow through the five-stage pipeline (IF, ID, EX, MEM, WB), worked out from the history: load-use stalls, stalls until write back when forwarding is off, and the two instructions flushed behind a jump or a branch guessed wrong (both resolved in EX).
      `branchPredictor.ts` is the guess for a conditional branch: always not taken, always taken, or a one-bit or two-bit state per branch.
      It follows a history that grows (`startPipeline`, `followPipeline`, `timingOf`), so a step sends one instruction through, and `pipelineTiming` is the same from an empty pipeline.
      The CPU itself never runs pipelined.
  - `mos6502/`: the MOS 6502 (NMOS).
    `architecture.ts` exports `MOS6502`.
    - `decode.ts`: the registers, memory and flags an instruction uses, and its mode, size and cycles, for the diagram and the cycle panel.
    - `state.ts` (A, X, Y, SP, PC, the flags in P, and the memory map), `operands.ts` (the 13 addressing modes), `instructions.ts` (the 56 mnemonics with an opcode and a cycle count per mode).
    - `layout.ts`: where each line sits; an instruction is 1 to 3 bytes, so a line's address depends on the lines before it.
      `encode.ts`: the opcode and operand bytes.
    - `execute.ts` runs an instruction through `executionContext.ts` (reads, writes, the stack, jumps, cycles) and `handlers.ts` (one per mnemonic), with `addressing.ts` (how each mode forms its address, kept as a trace), `alu.ts` (binary and decimal arithmetic) and `memory.ts` (the code, RAM and devices).
  - `logic/`: digital logic, the second topic.
    It knows no CPU, and imports only itself.
    - `gates.ts`: gates, a circuit as a list of gates in order, `evaluate`, and truth tables.
      Circuits here are **really evaluated**, never drawn from a CPU's result.
    - `adder.ts` (a ripple-carry adder whose `sub` line inverts B), `shifter.ts` (rows of muxes: a barrel shifter, or one row per count for a CPU that shifts a place at a time).
    - `alu.ts`: an `AluRequest` (add, subtract, AND, OR, XOR or a shift, 8, 16 or 32 bits wide) and `solve`, which builds its circuit, runs it, and names the wires a flag can be read from (`Tap`).
    - `feedback.ts`: `settle`, which runs a circuit whose gates read one another in a loop: every gate takes one step to react, all together, until nothing changes, starting from what the gates held.
      A circuit that never comes to rest is reported (`settled: false`), not guessed.
      `evaluate` stays for circuits without a loop.
      `react` is one such step by itself.
    - `propagation.ts`: a circuit without a loop followed through time: `propagate` gives every wire after each gate delay, from the wires it held when its inputs changed, and the delay each wire is ready at; `atRest` is a circuit whose inputs are all 0, and `depth` the gate delays it has to be given whatever its inputs.
    - `fault.ts`: `Faults` (the broken gates of a circuit, by the signal each drives, and the value its output is stuck at) and `withStuck`, the circuit with those gates reading nothing, so `evaluate` and `propagate` run it unchanged.
      `solve` takes the faults of an ALU's circuit; a linker never passes any.
    - `nand.ts`: `asNand`, a gate as NAND gates of two inputs, the last driving the gate's own signal (the wires inside are `<id>~1`, `<id>~2`, …; a gate of more inputs is a chain), and `nandCircuit`, a whole circuit built that way.
      Its test runs the ALU's circuits both ways and compares every wire.
    - `flipFlop.ts`: the memory cells, each built on the one before: the SR latch (two crossed NOR gates), the D latch, and the D flip-flop (two latches on opposite halves of the clock).
      A cell that has never held a bit cannot settle, so one is started from `holdingBit`.
    - `decoder.ts`: a decoder as two planes of gates (`DecoderShape`: the AND gates that each recognise a pattern of the inputs, and the OR gates they feed), with `solveDecoder`.
      A pattern no term knows turns its `none` wire on.
    - `programCounter.ts`: a `PcRequest` (the address held, the step and the offset to add, an address computed elsewhere, and the lines `fetched`, `branch`, `taken`, `jump`, `jumpComputed`) and `solvePc`: two adders (`solve`), the gates that choose between their sums, and the counter clocked as a register (`solveRegister`).
      It is put together from solved parts, not as one circuit, since their wires share names.
    - `register.ts`: a register (a flip-flop per bit behind a switch that feeds it the input or its own output), a `RegisterRequest` (what it holds, what waits at its input, and the mask of the bits that are written) and `solveRegister`, which takes it through one clock cycle and keeps every wire at each moment (`before`, `high`, `after`).
    - `registerFile.ts`: a `RegisterFileRequest` (what every register holds, the value at their shared input, the address, the write line, and whether register 0 is wired to 0) and `solveRegisterFile`: the address decoder (`decoder.ts`: an AND gate per register, none for a wired zero) gives each register its load line, and every register is clocked with it (`solveRegister`).
      It is put together from solved parts, as the program counter is; registers that go through the same cycle are worked out once.
    - `sequence.ts`: flip-flops on one clock that feed one another, as circuits for `settle`: `shiftRegister` (each flip-flop's input is the output of the one below it, and `in` comes in at bit 0) and `counter` (a bit flips when every bit below it is 1, while `en` is 1).
      Their test raises and lowers the clock by hand and expects every step to come to rest.
  - `aluLink.ts`, with `x86AluLink.ts`, `rv32AluLink.ts` and `mos6502AluLink.ts`, at the root of `src/core/` because each imports an architecture and `logic/`: the link between the two topics.
    A linker turns an executed instruction into an `AluCircuit` (the request, the wire behind every flag and whether through a NOT, the flags it always clears) or says why there is none (multiplication, division, decimal mode).
    Their tests run real instructions and check the circuit against the CPU's result and flags.
  - `representation/`: number representation, the third topic.
    It knows no CPU, and imports only itself and `shared/`.
    - `readings.ts`: a row of bits on the two scales, unsigned and signed (`wrap`, `signedOf`, `rangeOf`), and every reading of one value (`readValue`: hex, both scales, ASCII, packed decimal).
    - `arithmetic.ts`: a sum or a difference worked out **as whole numbers**, once on each scale: the true answer, what the bits say, and whether it fits.
      `extension.ts`: a narrow value made wide, by copying its top bit or with zeros.
      `bcd.ts`: a sum of two packed decimal bytes, digit by digit, with the correction by 6.
      `bytes.ts`: the bytes of a value as it is written and as it sits in memory in either order, and what a stored value reads as in the other one.
      `scaling.ts`: a shift worked out as a multiplication or a division by 2 for every place, once on each scale: the true answer rounded down, what was left over, what the bits say, and whether the two agree (a shift left agrees while the answer fits, a shift right on the scale its fill belongs to).
      `comparison.ts`: two rows of bits compared as whole numbers, once on each scale (`compare`), and whether numbers in that order answer a question such as "less" or "greater or equal" (`holds`).
    - `request.ts`: a `NumberRequest` (one of those, or a value to read) and `solveNumber`.
  - `numberLink.ts`, with `x86NumberLink.ts`, `rv32NumberLink.ts` and `mos6502NumberLink.ts`, at the root of `src/core/` for the same reason: the link into the number topic.
    A linker turns an executed instruction into a `NumberView` (the request, and for every flag the question about the numbers it answers: a scale, a `Verdict`, and whether the flag works backwards; `comparable` is false where a flag the conditional jumps read is left as it was, as INC and DEC leave the carry; `operands` names the two inputs as the instruction wrote them; `flagless` marks RISC-V's, which lists what the instruction decides) and, for a request made by hand, the flags that CPU would set (`x86FreeView`, `rv32FreeView`, `mos6502FreeView`, which `freeView` of `numbersView.ts` picks by the CPU on show) or says why there is none (bitwise logic, rotates, multiplication, division).
    `shiftReadings` gives the flags of a shift: the carry is a question about the numbers after one place only (the unsigned answer did not fit, or the halving left one over: the verdict `remainder`).
    Their tests run real instructions and check the numbers against the CPU's result and flags.
  - `registerLink.ts`, with `x86RegisterLink.ts`, `rv32RegisterLink.ts` and `mos6502RegisterLink.ts`, at the root of `src/core/` for the same reason: the link into the storage topic.
    A linker takes an executed instruction **and the snapshot it left** (the undo record holds only the one before) and gives a `RegisterView`: for every register the instruction wrote, a `RegisterRequest`.
    The 8086's byte registers are halves of a word register's flip-flops, so a write to AL is a write to AX with half its write lines on.
    The instruction pointer is left out: it is loaded on every instruction, which the control topic shows (for RISC-V).
    RISC-V's linker also gives a `RegisterFileView` (`file`: the 32 registers as the instruction found them, their names, and `rd` as the address written), for a write to x0 too, where no register is written, and with the write line off for an instruction with no rd (a store, a branch), whose bits 11 to 7 the decoder reads as an address all the same; the other two CPUs, whose registers no address field picks, leave it out.
    Their tests run real instructions and clock the flip-flops of every register, written or not, against the CPU; RISC-V's clocks the whole file too.
  - `controlLink.ts`, with `rv32ControlLink.ts`, `x86ControlLink.ts` and `mos6502ControlLink.ts`, at the root of `src/core/` for the same reason: the link into the control topic.
    A `ControlView` is the instruction's word and fields, a `ControlShape` (two decoders: the main one reads the opcode, the second reads the main one's wires with funct3 and funct7 and sets the ALU's lines; `solveControl` runs a word through both, with the lines named in its `faults` stuck at a value, which a linker never passes), a `PcRequest`, and a `ControlContext` (the registers the instruction found, its address, whether it was fetched, and memory as it found it).
    `rv32Control.ts` is RISC-V's shape, its terms built from the encoder's own `OPCODES` so the two cannot disagree.
    **The control topic is the only place an instruction is decoded from its bits** (these decoders, the datapath they drive, and the disassembler that names a typed word): the CPU itself still runs instructions as data.
    The linker encodes the instruction at the address it ran from (`encodeAt`), reads its immediate back (`rv32/immediate.ts`), takes "branch taken" and JALR's target from the circuit of `rv32AluLink`, never from the CPU's result, and leaves PC out (`pc: null`) for a branch too far for its immediate.
    The 8086 (microcode) and the 6502 (a table read on every cycle) return why they have nothing to show.
    `rv32ControlPath.ts` is the datapath those lines drive: `runDatapath` does a word from its control lines alone (the switches at the ALU's inputs, the circuit of `logic/alu.ts` the ALU's lines call for, the wire a branch reads, memory, what rd takes, and the `PcRequest`), against a `ControlContext`, and gives a `PathOutcome`; what a working control unit never asks for (two values sent to rd, an address nothing worked out) is a `PathConflict`, reported and never guessed (so is a word that is no instruction, which the lines are followed for all the same), and an access that faults, or a jump to an address that is not a multiple of 4, is a `trap`.
    `rv32ControlMemory.ts` gives the linker the memory an instruction found (`memoryBefore`: what the instruction itself loaded is the value its record kept, and anything else is the CPU's memory with the bytes the instruction wrote put back, read through `load`; a store only says whether it would trap, through `storeFault` of `rv32/memory.ts`).
  - `comparisonTasks.ts` and `comparison.ts`, at the root of `src/core/` because they import every architecture: the same small tasks written for each CPU (with a lesson saying why the programs differ), and `measure`, which runs each program from a fresh CPU and counts its lines, code bytes, instructions run, memory writes and, on the 6502, cycles.
