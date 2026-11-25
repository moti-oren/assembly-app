# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An interactive CPU playground (Vue 3 + TypeScript + Vite) with three architectures, the 8086, RISC-V (RV32IM) and the 6502: the user picks one, builds an instruction word by word, runs it, and watches registers, flags and memory change. A second topic, digital logic, shows the gates behind an operation a CPU just made, a third, number representation, shows what that operation means as unsigned and signed numbers, a fourth, storage, shows the flip-flops that keep the register an instruction wrote, and a fifth, control, shows the decoders that turn a RISC-V instruction's 32 bits into the control lines and the next PC; a topic is a page of its own, and they are linked. The app is called CPU Playground; the repo is still `assembly-app`.

## Commands

```sh
npm run dev          # start the app (vite)
npm run build        # vue-tsc --noEmit && vite build
npm test             # vitest run (tests: src/**/*.test.ts)
npx vitest run src/core/x86/execute.test.ts        # a single test file
npx vitest run -t "some test name"                 # a single test by name
npm run typecheck    # vue-tsc --noEmit
npm run lint         # eslint . (flat config)
npm run format       # prettier --write src
npm run check        # typecheck, lint, format:check and test: the gate before every commit
npm run check:design # no raw colour outside src/ui/styles.css, no hue outside the palette (scripts/claude/check-design-tokens.mjs)
npm run verify:rv32  # RISC-V core vs Capstone and Unicorn (Python: pip install capstone unicorn)
npm run verify:6502  # 6502 core vs py65's assembler and simulator (Python: pip install py65)
```

When a change adds, renames or removes a command (an npm script in `package.json`, or a command developers now run), update this list in the same change. Also update the commands in `README.md`, in both languages.

Style: Prettier with single quotes, semicolons, no trailing commas, 100 columns. Path alias `@` → `src`.

## Architecture

Two layers; keep them separate.

- `src/core/` is the CPU and **must not depend on Vue**. All logic is tested here. It holds one folder per architecture, built on `shared/`, and one for each of the other topics. Its map, file by file, is `docs/architecture/core.md`.
- `src/ui/`: Vue components in `ui/components/`, composables (`use*.ts`) and plain helpers (the other `.ts` files). Its map is `docs/architecture/ui.md`.
- `src/components/ui/`: shadcn-vue components (Tailwind v4 + reka-ui), generated with `npx shadcn-vue add <name>`. They are excluded from ESLint; don't hand-edit them casually. Config in `components.json`.

The two maps say what every file holds, and they are not loaded with this file. Grep one for a file or a feature before looking for where something lives; read the map of a layer whole before adding a file to it or planning a change across it. Every sentence there is on a line of its own. A change that adds, renames, moves or removes a file, or changes what a file is responsible for, updates its sentence in the same change.

## Code structure

Every change, new code or an edit to existing code, must leave the structure modular and in line with these rules. If existing code you touch breaks one of them, fix it as part of the change, or tell the user when the fix is too big for the task.

**Layers.** Imports only go downward, never up or sideways into a higher layer:

| Layer       | Files                                               | May import                                                                                                                                       |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Components  | `src/ui/components/*.vue`, `src/App.vue`            | everything below, other components, `src/components/ui/` (shadcn)                                                                                |
| Composables | `src/ui/use*.ts`                                    | composables, helpers, core, Vue/VueUse                                                                                                           |
| Helpers     | other `src/ui/*.ts` (`describe.ts`, `sounds.ts`, …) | helpers, core. **No Vue**: plain functions over plain data                                                                                       |
| Core        | `src/core/**/*.ts`                                  | core only: `shared/` only itself, an architecture folder, `logic/` or `representation/` only itself and `shared/`; the files at the root of `src/core/` any of them |

ESLint enforces the import rules of the core, helper and composable layers, and the 500-line file limit below; `npm run lint` fails on a violation. The other rules here are on you.

- **Anything reactive is a composable:** code that holds `ref` / `computed` / `watch` state or uses VueUse lives in a `use*.ts` file and is named `useX`. A helper never imports Vue.
- **Components wire, they don't compute:** a `.vue` file binds state to markup. Calculations, decisions and text formatting go in a helper or composable, where they can be unit-tested. If a function in `<script setup>` would deserve a test, it belongs in a `.ts` file.
- **Shared types live in `.ts` files:** never import a type from a `.vue` file. A component may import its prop types from a `.ts` file, not the other way around.
- **No import cycles** between files.

**Size and responsibility.**

- **One responsibility per file:** you should be able to say what a file does in one sentence without "and". The name says what it is: `useX` for a composable, a noun for a helper or a core module, PascalCase for a component.
- **File size** (source files, not tests): past **~300 lines**, check before adding to it whether it now holds more than one responsibility. Past **~500 lines** it must be split: split it before adding more. A component counts its template too; split a large template into child components.
- **Function size:** about **50 lines** at most; split a longer function into named steps. Two things are not "long functions": a composable factory (`useX`), whose inner functions follow the limit but whose body past ~150 lines should be split into smaller composables or helpers; and a flat list of data (the instruction table, the palette's command list) whose entries are short.
- **Tests** live next to their module (`x.test.ts` for `x.ts`) and are exempt from the size limits; group them with `describe`.

**Adding and changing code.**

- **Put new code where it belongs:** first look for the existing file whose responsibility it is, in the right layer. Create a new file only when no file fits, and give it a name that says its job.
- **Don't duplicate:** the third copy of the same logic is the moment to extract a shared function. Don't add abstractions for a single use.
- **Exports are the module's API:** export only what other files (including tests) use, plus types that appear in exported signatures. Remove exports nobody uses.
- **Before finishing a task** that added a file or grew one noticeably, re-check it against this section.

## Development

A task that spans layers, or more than a file or two, can be built by agents that write: `/develop <the task>` (`.claude/commands/develop.md`). A small change is written directly, without it.

- **Four agents, each with files of its own** (`.claude/agents/`), so no two ever write the same file. `feature-scout` reads only: it maps the task onto the code (the files, the layer and the one responsibility of each, what to reuse, the tests, what must stay in sync, the decisions that are the user's). `core-builder` writes `src/core` and `scripts/verify`, test first, and runs the oracles. `ui-builder` writes `src/ui`, `src/App.vue`, `src/main.ts` and `index.html`, adds the palette command of every new action, and looks at the result in the browser. `docs-sync` writes `README.md`, in both languages, this file and the two maps in `docs/architecture/`.
- **The order is fixed:** the scout, the core, the interface, the docs, one writer at a time, then `/verify`. `scripts/claude/develop.mjs` takes the files of the scout's plan and gives each builder its files and its checks (the tests beside them, `check:design`, the oracle of the core it touches); a task of a file or two in one builder's files comes back as `inline`, for the main session to write itself when its model suits that builder. A file no builder owns (`package.json`, a workflow, `src/components/ui`, the scripts) stays with the main session.
- **The model follows the file, not the session.** Every agent's file pins its `model` and `effort`: `core-builder` and `isa-correctness` on Opus, the scout, `ui-builder`, `docs-sync` and the other reviewers on Sonnet. So who writes or reviews a file does not depend on the model a session was started on; never pass a model when starting an agent. `develop.mjs --model <the session's model>` lists under `mismatched` the builders that session must not stand in for: one pinned above its model (a Sonnet session and the core), or two steps below it (a Fable session and the interface or the docs). This holds without `/develop` too: before writing code, a session finds the files, asks `develop.mjs`, and hands a mismatched builder its files however small the task is; the rest it writes itself, as it always did. Work no builder owns has no such net: a session below Opus whose fix has failed twice stops and says that the task needs Opus or Fable.
- **A builder reports, the main session answers for it.** Each replies `DONE | PARTIAL | BLOCKED` with the files it changed, the checks it ran and what it needs from another agent or the user. After each one, `develop.mjs --stray` names any file it changed outside its own, and the diff is read before the next starts. No agent commits or touches a branch. A builder stops instead of deciding what this file keeps for the user: a dependency, a generated component, a new colour, token or breakpoint, the serialized shape of the state or the undo record, what an existing instruction does.
- **Changing the rules:** who owns which file, the model each builder is pinned to and what each builder runs is in `develop.mjs`, tested in `develop.test.mjs`; change both together. A builder's model is changed in its file and in `MODELS` at once: a test compares the two. It shares its path rules and `oracles` with `route.mjs`.

## Verification

A change is checked in two tiers: deterministic gates first, review agents only where a gate cannot judge. `/develop` ends here too.

- **While editing (hooks, `.claude/settings.json`):** after every Edit or Write, ESLint and Prettier check that one file (`scripts/claude/post-edit.mjs`). When a turn ends with uncommitted changes under `src` or `scripts`, the Stop hook runs the typecheck and `vitest --changed` (`stop-check.mjs`); it blocks the stop once at most. `git-guard.mjs` denies `--no-verify`, a force-push and deleting a remote branch, and asks before a commit on `main`; `pre-edit.mjs` asks before a hand edit in `src/components/ui`.
- **`/verify` (`.claude/commands/verify.md`) is the one entry point before a commit.** `scripts/claude/route.mjs` reads the diff against `main` and decides what runs. Tier 1 always runs: `npm run check`, plus `check:design` for components and style sheets, `verify:rv32` / `verify:6502` with one fresh seed when that core or `shared/` changed, and `build` when a dependency or the build configuration changed. Tier 2 runs when simulator code changed or more than 30 lines of UI did, and only the agents whose files changed: `isa-correctness`, `vue-architecture`, `design-responsive`, `a11y-interaction`, `perf-runtime` (`.claude/agents/`). `/verify --full` runs all five on any code change. A change to documentation, tests or generated components alone runs no agent.
- **Review agents report, they never edit.** Each answers `PASS | WARN | BLOCK` with findings as `path:line`, a severity (Blocker, Warning, Nit), evidence and a fix. `/verify` merges them, confirms every Blocker in the code, fixes what is mechanical, and stops after two fix rounds. A fix to what an instruction does, to the undo record or to an encoding is never automatic. `design-responsive`, `a11y-interaction` and `perf-runtime` start without this file, so a rule one of them has to follow is written in that agent's own file, not only here.
- **Changing the rules:** the routing lives in `route.mjs` and is tested in `route.test.mjs`; change both together. A colour that was in the code before a rule of `check:design` existed is listed under `KNOWN` in the script: delete its entry when it moves to a token of the palette. The palette itself (which hues a token may hold) is in `designPalette.mjs`, tested in `designPalette.test.mjs`; the `chart-*` tokens are the one exception, allowed in the encoding panels only.

## Execution model (non-obvious)

- Instructions **run as data, not as bytes**. On the 8086, IP is the index of the next program line (L0, L1, …); jump/call targets are lines. CALL pushes the next line onto the stack and RET pops it. The machine code from `encode.ts` is shown beside the program but never executed, and it is not written into memory.
- Shared code never reads an instruction pointer itself: it asks the architecture for `nextLine` and moves it with `setNextLine`. Each architecture decides how its instruction pointer maps to a program line (the 8086's IP simply is the line).
- On RISC-V, PC is a real byte address: line n is at 4n, so links (`jal`), `auipc` and `jalr` targets are real addresses. A jump to an address that is not the start of a line is a `CpuError`. The code is readable as memory (its encoding) but a store into it is a `CpuError`: the program cannot modify itself. Pseudo-instructions are expanded into real lines when added, so the program only holds real instructions.
- On the 6502, PC is a real address too, but instructions are 1 to 3 bytes, so a line's address comes from the layout of the lines before it (`layout.ts`). The code starts at $0600, the devices sit at $D000 + port, the stack is page $01, and the BRK vector is at $FFFE. BRK is encoded with its signature byte (two bytes, `00 00`), so RTI returns to the next line. JMP and JSR only take a program line, never a numeric address. Decimal mode follows the NMOS chip, N, V and Z included.
- A label used as a value (`mov word [0084h], L8`) is the **line number** at run time, while `encode.ts` shows it as the byte offset of that line. Keep both in mind when touching either side.
- A share link carries an architecture and its program, nothing of the CPU's state. Its payload is the serialized program, so a change to an instruction's shape breaks old links (they are refused, never half-read): raise the link's version and convert the old one.
- An instruction runs immediately (Enter) or is appended to the program (Shift+Enter).
- Memory operands are `byte`/`word` `[bx]`, `[si]`, `[di]`, `[bp]` or `[offset]`. `[bp]` uses SS; all others use DS.
- Shift counts are `1` or `CL`, as on the 8086.
- String instructions read DS:SI and write ES:DI. A `rep`/`repe`/`repne` repetition runs to the end as **one step** with one undo record.
- Interrupts go through the vector table at `0000:n×4`, where the offset word holds a handler's line number. An **empty vector is a `CpuError`** rather than a jump to line 0, so L0 cannot be a handler. A divide error enters INT 0 only if that vector is installed.
- I/O ports are separate from memory, with separate input and output bytes per port. Output port writes are part of the undo record (`portWrites`); the input ports are set by the devices panel and survive Reset.

## Git

- **Atomic commits:** one logical change per commit. Don't mix a refactor, a bug fix and a feature in one commit, and don't bundle unrelated files. Each commit should leave `npm run check` passing (typecheck, lint, format check and tests; the deploy runs the same four). Stage selectively (`git add -p` or by path), never `git add -A` blindly.
- **Tests with code:** a change to `src/core/` goes in the same commit as its test update.
- **Message format:** `<type>: <description>`, all lowercase, imperative or short noun phrase, no trailing period, subject ≤ 72 characters. Types used in this repo's history: `create`, `update`, `change`, `fix`, `remove`, `init`. Use `create` for new files/features, `update` for extending existing ones, `change` for behavior or design changes, `fix` for bugs, `remove` for deletions.
  - Example: `fix: asHigh bits methods in the Mask class`
- Add a body (blank line after the subject) only when the _why_ isn't obvious from the diff.
- **Branches: one branch per feature.** Every feature, fix or other self-contained task lives on its own branch, to keep history uncluttered.
  - Naming: `feature/<short-name>` for features and changes, `fix/<short-name>` for bug fixes. Lowercase, hyphen-separated, English.
  - Never commit directly to `main`, unless the user explicitly says to.
  - Start each new task from an up-to-date `main` (or from the branch it depends on, if the user says so). If the current branch is a finished, unrelated feature branch, switch to `main` and branch from there instead of piling the new work onto it.
  - Continue on the current branch only when the task is a continuation of that branch's feature.
  - Don't mix two features on one branch. If unrelated work shows up mid-task, finish or commit the current one first.
- **End-of-task Git workflow:** when a task is **fully completed**, do the Git work without waiting to be asked:
  1. Make sure you are on the right branch (create it per the rules above if the task is new).
  2. Run `/verify` (see "Verification"): `npm run check` and the other gates always, the review agents when the change calls for them. Fix failures first; do not commit on a BLOCK.
  3. Split the changes into atomic commits per the rules above and commit them.
  4. Verify `git status` is clean and report the branch and commits to the user, **in Hebrew** (see "Language with the user").
  - **Partial work is exempt:** if the task is only partly done (blocked, failing, waiting for a user decision, or the user stopped midway), do **not** commit or create a branch. Leave the changes uncommitted and say what remains.
  - Do not commit unrelated pre-existing changes the user left in the tree; stage only files that belong to this task.
- **Still needs an explicit request:** merging into `main`, amending, and rewriting history (rebase, `reset --hard`, force-push). Prefer a new commit over amending. A `git push` also needs a request, except the push that follows a merge (next rule).
- **After a merge, push and clean up:** when you merge a branch into `main` (only when the user asked for the merge), finish the job without asking again:
  1. On the merged `main`, run `npm run typecheck`, `npm run lint` and `npm test`. If anything fails, stop: do not push and do not delete the branch; report it.
  2. `git push origin main`. Never force-push. If the push is rejected or fails, stop, keep the branch, and report why.
  3. Only after the push succeeded, delete the branch **locally only**, with `git branch -d <branch>` (the safe form, which refuses an unmerged branch; never `-D`).
  4. **Never delete the branch on the remote (GitHub)**: no `git push origin --delete <branch>` and no `git push origin :<branch>`, even if the branch exists there and even though it is merged. Remote branches are removed only when the user explicitly asks.
  5. Report in Hebrew what was merged, pushed and deleted locally, and mention if a copy of the branch is still on the remote.
  - This applies only to a merge that Claude performs. Pushing a branch that is not being merged still needs an explicit request.
- **After every push to `main`, verify the deploy:** the `deploy` workflow (`.github/workflows/deploy.yml`: lint, format check, tests, build, then GitHub Pages) runs on each push to `main`; pushing another branch triggers nothing. Don't report the work as done until you have seen it finish, using the GitHub CLI (`gh`; if it is missing from PATH, use `C:\Program Files\GitHub CLI\gh.exe`).
  1. Find the run for the pushed commit: `gh run list --workflow deploy.yml --branch main --limit 1` (check that its commit is the one just pushed), then wait with `gh run watch <id> --exit-status`.
  2. On success, check the live site: `https://moti-oren.github.io/assembly-app/` must answer 200 and its `index.html` must reference `/assembly-app/assets/…`, not `/src/main.ts`. Then report in Hebrew that the build and the deploy succeeded.
  3. On failure, read the log (`gh run view <id> --log-failed`), find the cause, and reproduce it locally with the same command the workflow ran (`npm run lint`, `npm run format:check`, `npm test`, `npm run build`).
  4. Fix it on a new `fix/<short-name>` branch from `main`, following all the rules above (atomic commit, `typecheck` / `lint` / `test` passing). The user has authorized this one loop to complete without asking again: merge the fix into `main`, run the same checks, push, and verify the new run the same way.
  5. Stop and report to the user in Hebrew, without trying a fix, when: the failure is not in the code (a GitHub outage, a missing permission, the Pages setting, a secret, a protected environment); the fix would change a workflow's permissions, a repository setting, or the build in a way that is more than a small repair; or two fix attempts in a row did not make the run pass. Never force-push, never delete a remote branch, and don't change repository settings with `gh api` on your own.
  6. If `gh` is not logged in (`gh auth status` fails), say so and ask the user to run `gh auth login`; don't try to work around it.
- **Language of the commits themselves:** the text stored in git (commit subjects and bodies, branch names, code and code comments) is in English.
- **Destructive commands:** before `git reset`, `git checkout -- <path>`, `git clean` or `git stash drop`, inspect what will be lost (`git status`, `git diff`). Uncommitted work may be the user's.
- **Large moves:** commit deletions, moves/renames and new content separately, so `git log --follow` and blame keep working.
- **Lockfile:** `package-lock.json` changes go in the same commit as the `package.json` change that caused them.
- If a change breaks the serialized shape of core state or the undo record, say so in the commit body (`BREAKING:` line).
- Never skip hooks (`--no-verify`). If a hook fails, fix the cause.
- Don't commit `dist/` or `node_modules/` (check `.gitignore` before staging).

## Conventions

- **Adding an instruction** (to the 8086, in `src/core/x86/`): define it in `instructions.ts`, implement it in `execute.ts`, then add tests in `execute.test.ts`. If it touches flags, test the flags too. Then give it an encoding in `encode.ts` (it throws for a mnemonic it does not know, and a test encodes every example program), and list any registers it uses implicitly in `decode.ts`.
- **Undo is a contract:** every path in `execute.ts` must return a complete undo record (registers, flags, memory writes, port writes and IP). A new path without one breaks history.
- **RISC-V is checked against real tools:** after changing anything in `src/core/rv32/` that encodes or executes, run `npm run verify:rv32` (Capstone reads the encodings back, Unicorn runs random programs from their bytes) and a few seeds (`npm run verify:rv32 -- 7`). It needs Python with `capstone` and `unicorn`. LLVM's `clang` is installed but blocked by Windows Application Control on this machine, so it cannot be used.
- **The 6502 is checked against py65:** after changing anything in `src/core/mos6502/` that encodes or executes, run `npm run verify:6502` and a few seeds. It compares registers, flags, memory and cycle counts. Two known py65 differences are handled in the script, not in the core: its cycle table has DEC absolute ($CE) at 3 cycles (the data sheet says 6), and its decimal mode does not reproduce the NMOS N, V and Z, so BCD sums are compared on A and C only.
- **Encodings follow NASM:** where the 8086 allows two encodings of one instruction, `encode.ts` produces the one NASM picks (checked against NASM 3.02 with `bits 16` / `cpu 8086`). Two deliberate exceptions: `int 3` is the one-byte `CC`, and a conditional jump out of short range is reported as a problem instead of being rewritten as an inverted jump over a `jmp`.
- **Typed arrays are not reactive:** memory and port bytes live in `Uint8Array`s, so the UI depends on `memoryVersion` / `ioVersion`. Bump them on every write path.
- **8086 fidelity:** flag behavior (AF, OF, CF, etc.) follows real 8086 semantics, not whatever is convenient. When unsure, check the 8086 reference instead of guessing.
- **UI changes:** `typecheck` and `test` do not cover the UI. Verify it in the browser via `npm run dev` before reporting it done.
- **A topic's circuit is checked against the CPUs:** after changing `src/core/logic/` or a linker (`*AluLink.ts`), run its tests: they execute random instructions on the real cores and compare the circuit's result and every flag. A new operation in a linker needs a case there. Never make a circuit agree by reading the CPU's result into it. The same holds for `src/core/representation/` and the number linkers (`*NumberLink.ts`): the numbers are worked out as whole numbers and compared with the CPU, never read from it. In decimal mode they are compared on A and C only, as `verify:6502` does. The jumps of the number topic (`numbersConditions.ts`) are checked both ways: against the whole numbers for every pair of bytes, and against the real cores, which run a comparison and the jump after it. A register linker (`*RegisterLink.ts`) is checked the other way round, since what is written is the CPU's own value: its test clocks the flip-flops of **every** register, with the write lines off for the ones the instruction did not write, and each must end up holding what the CPU holds. The control linker (`rv32ControlLink.ts`) is checked against the CPU's own decoding: its test runs every mnemonic, fetched from a program and by itself, and compares the main decoder's lines with `decode()`, the ALU decoder's lines with the request of `rv32AluLink`, and the clocked PC with the CPU's. A new instruction needs a term in `rv32Control.ts`. The datapath (`rv32ControlPath.ts`) is checked the same way: for every mnemonic the lines alone must leave the registers, the memory access, the ALU's request and PC as the CPU left them, with no conflict and no trap. A new control line needs its switch there.
- **One page per topic:** a topic has its own workbench component and its own palette commands, inside the shared `HeaderShell`. A link between topics carries what the other topic needs as plain data from the core (as `AluLink`, `NumberLink`, `RegisterLink` and `ControlLink` do), never a component's state. A new topic gets its own linkers and its own call of `useCpuMoment`; the moment, `TopicWorkbench` and `TopicLinkButton` are shared.
- **One workbench per architecture:** a panel that shows one architecture's concepts belongs to it (`Rv32*.vue`, helpers `rv32*.ts`) and is wired in that architecture's workbench. A panel both share takes the differences as props; never branch on the architecture inside a shared component.
- **Command palette (Ctrl+K) stays in sync:** the app's command palette lists what the user can do (program, history, devices, run speed, examples, preferences). Its commands are built in `src/ui/useCommands.ts` and shown by `CommandPalette.vue`. Whenever a change adds a user-facing action (a new toggle, panel, preference, run option, or anything the user could reasonably look for in the palette), add the matching command in the same change; when an action is renamed or removed, update or remove its command. Toggles use a label that reflects the current state (`Show …` / `Hide …`). Not every control belongs there; skip purely internal or purely contextual ones. A command that moves focus or scrolls the page must set `moves: 'focus' | 'scroll'`: the open palette locks scrolling and hands focus back on close, which would undo it.
- **README on UI changes:** whenever the UI changes (new or changed controls, shortcuts, panels, behavior the user sees), check whether `README.md` should change too (commands, layout, model, usage). If so, update it in the same change.
- **README is bilingual:** `README.md` has the full guide in English at the top and the same guide in Hebrew (RTL) at the bottom. Any README edit must be applied to both halves so they stay equivalent.
- **shadcn components:** add them with `npx shadcn-vue add <name>`, never by hand-writing files in `src/components/ui/`.
- **`cn` is intentional:** the `cn` package is shadcn's replacement for `clsx` + `tailwind-merge`. The generated components import it directly and `src/lib/utils.ts` re-exports it. Don't remove it or swap in `clsx`/`tailwind-merge`.
- **Dependencies:** don't add new packages without asking.
- **Comments:** only where the _why_ is not obvious. No comments that restate what the line does.
- **Language with the user:** everything addressed to the user is in Hebrew: replies, explanations, questions and all git reports (which branch was created, which commits were made, what each one contains, what was skipped and why). Only the artifacts stay in English: code, comments, commit messages and branch names. When quoting a commit message or branch name in a Hebrew report, keep it verbatim in English and write the surrounding explanation in Hebrew.
