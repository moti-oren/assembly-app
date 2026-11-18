# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An interactive 8086 playground (Vue 3 + TypeScript + Vite): the user builds an instruction word by word, runs it, and watches registers, flags and memory change.

## Commands

```sh
npm run dev          # start the app (vite)
npm run build        # vue-tsc --noEmit && vite build
npm test             # vitest run (tests: src/**/*.test.ts)
npx vitest run src/core/execute.test.ts            # a single test file
npx vitest run -t "some test name"                 # a single test by name
npm run typecheck    # vue-tsc --noEmit
npm run lint         # eslint . (flat config)
npm run format       # prettier --write src
```

When a change adds, renames or removes a command (an npm script in `package.json`, or a command developers now run), update this list in the same change. Also update the commands in `README.md`, in both languages.

Style: Prettier with single quotes, semicolons, no trailing commas, 100 columns. Path alias `@` → `src`.

## Architecture

Two layers; keep them separate.

- `src/core/` is the CPU and **must not depend on Vue**. All logic is tested here.
  - `state.ts`: registers (8-bit registers are views into AX..DX), FLAGS, 1MB memory, and the I/O ports (`io`).
  - `instructions.ts`: the instruction set expressed as data; each mnemonic lists its legal operand forms. Adding an instruction starts here.
  - `builder.ts`: given the words chosen so far, computes which operands may come next (drives the UI's word-by-word builder).
  - `execute.ts`: runs one instruction, computes flags, and returns an **undo record** (history/undo depends on this).
  - `program.ts`: a program is a list of instructions; stepping, running, and edits that keep jump targets on the right lines. Also holds the example programs.
  - `decode.ts`: what an instruction reads and writes (registers, memory, ports, flags, ALU), including registers it uses without naming them. The diagram and the fetch/decode/execute view are driven by it.
  - `encode.ts`: the 8086 machine code of an instruction, split into fields (prefix, opcode, ModR/M, …). **Display only**; nothing executes these bytes.
  - `devices.ts`: the port numbers of the I/O devices (LEDs, switches, 7-segment digits, terminal) and how their bytes are shown.
  - `address.ts` and `flagReasons.ts`: explanations for the UI, worked out from state and the undo record: how segment:offset becomes a 20-bit address, and why each flag got its value.
- `src/ui/`: Vue components in `ui/components/` and `useCpu.ts`, which wraps the core in Vue reactivity. `useCommands.ts` builds the Ctrl+K command palette. Theme tokens (including the app accents `--changed` and `--pointer`) live in `src/ui/styles.css`.
- `src/components/ui/`: shadcn-vue components (Tailwind v4 + reka-ui), generated with `npx shadcn-vue add <name>`. They are excluded from ESLint; don't hand-edit them casually. Config in `components.json`.

## Code structure

Every change, new code or an edit to existing code, must leave the structure modular and in line with these rules. If existing code you touch breaks one of them, fix it as part of the change, or tell the user when the fix is too big for the task.

**Layers.** Imports only go downward, never up or sideways into a higher layer:

| Layer | Files | May import |
|---|---|---|
| Components | `src/ui/components/*.vue`, `src/App.vue` | everything below, other components, `src/components/ui/` (shadcn) |
| Composables | `src/ui/use*.ts` | composables, helpers, core, Vue/VueUse |
| Helpers | other `src/ui/*.ts` (`describe.ts`, `sounds.ts`, …) | helpers, core. **No Vue**: plain functions over plain data |
| Core | `src/core/*.ts` | core only (enforced by ESLint) |

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

## Execution model (non-obvious)

- Instructions **run as data, not as bytes**. IP is the index of the next program line (L0, L1, …); jump/call targets are lines. CALL pushes the next line onto the stack and RET pops it. The machine code from `encode.ts` is shown beside the program but never executed, and it is not written into memory.
- A label used as a value (`mov word [0x84], L8`) is the **line number** at run time, while `encode.ts` shows it as the byte offset of that line. Keep both in mind when touching either side.
- An instruction runs immediately (Enter) or is appended to the program (Shift+Enter).
- Memory operands are `byte`/`word` `[bx]`, `[si]`, `[di]`, `[bp]` or `[offset]`. `[bp]` uses SS; all others use DS.
- Shift counts are `1` or `CL`, as on the 8086.
- String instructions read DS:SI and write ES:DI. A `rep`/`repe`/`repne` repetition runs to the end as **one step** with one undo record.
- Interrupts go through the vector table at `0000:n×4`, where the offset word holds a handler's line number. An **empty vector is a `CpuError`** rather than a jump to line 0, so L0 cannot be a handler. A divide error enters INT 0 only if that vector is installed.
- I/O ports are separate from memory, with separate input and output bytes per port. Output port writes are part of the undo record (`portWrites`); the input ports are set by the devices panel and survive Reset.

## Git

- **Atomic commits:** one logical change per commit. Don't mix a refactor, a bug fix and a feature in one commit, and don't bundle unrelated files. Each commit should leave `npm run typecheck`, `npm run lint` and `npm test` passing. Stage selectively (`git add -p` or by path), never `git add -A` blindly.
- **Tests with code:** a change to `src/core/` goes in the same commit as its test update.
- **Message format:** `<type>: <description>`, all lowercase, imperative or short noun phrase, no trailing period, subject ≤ 72 characters. Types used in this repo's history: `create`, `update`, `change`, `fix`, `remove`, `init`. Use `create` for new files/features, `update` for extending existing ones, `change` for behavior or design changes, `fix` for bugs, `remove` for deletions.
  - Example: `fix: asHigh bits methods in the Mask class`
- Add a body (blank line after the subject) only when the *why* isn't obvious from the diff.
- **Branches: one branch per feature.** Every feature, fix or other self-contained task lives on its own branch, to keep history uncluttered.
  - Naming: `feature/<short-name>` for features and changes, `fix/<short-name>` for bug fixes. Lowercase, hyphen-separated, English.
  - Never commit directly to `main`, unless the user explicitly says to.
  - Start each new task from an up-to-date `main` (or from the branch it depends on, if the user says so). If the current branch is a finished, unrelated feature branch, switch to `main` and branch from there instead of piling the new work onto it.
  - Continue on the current branch only when the task is a continuation of that branch's feature.
  - Don't mix two features on one branch. If unrelated work shows up mid-task, finish or commit the current one first.
- **End-of-task Git workflow:** when a task is **fully completed**, do the Git work without waiting to be asked:
  1. Make sure you are on the right branch (create it per the rules above if the task is new).
  2. Run `npm run typecheck`, `npm run lint` and `npm test`; fix failures first.
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
- **Language of the commits themselves:** the text stored in git (commit subjects and bodies, branch names, code and code comments) is in English.
- **Destructive commands:** before `git reset`, `git checkout -- <path>`, `git clean` or `git stash drop`, inspect what will be lost (`git status`, `git diff`). Uncommitted work may be the user's.
- **Large moves:** commit deletions, moves/renames and new content separately, so `git log --follow` and blame keep working.
- **Lockfile:** `package-lock.json` changes go in the same commit as the `package.json` change that caused them.
- If a change breaks the serialized shape of core state or the undo record, say so in the commit body (`BREAKING:` line).
- Never skip hooks (`--no-verify`). If a hook fails, fix the cause.
- Don't commit `dist/` or `node_modules/` (check `.gitignore` before staging).

## Conventions

- **Adding an instruction:** define it in `instructions.ts`, implement it in `execute.ts`, then add tests in `execute.test.ts`. If it touches flags, test the flags too. Then give it an encoding in `encode.ts` (it throws for a mnemonic it does not know, and a test encodes every example program), and list any registers it uses implicitly in `decode.ts`.
- **Undo is a contract:** every path in `execute.ts` must return a complete undo record (registers, flags, memory writes, port writes and IP). A new path without one breaks history.
- **Encodings follow NASM:** where the 8086 allows two encodings of one instruction, `encode.ts` produces the one NASM picks (checked against NASM 3.02 with `bits 16` / `cpu 8086`). Two deliberate exceptions: `int 3` is the one-byte `CC`, and a conditional jump out of short range is reported as a problem instead of being rewritten as an inverted jump over a `jmp`.
- **Typed arrays are not reactive:** memory and port bytes live in `Uint8Array`s, so the UI depends on `memoryVersion` / `ioVersion`. Bump them on every write path.
- **8086 fidelity:** flag behavior (AF, OF, CF, etc.) follows real 8086 semantics, not whatever is convenient. When unsure, check the 8086 reference instead of guessing.
- **UI changes:** `typecheck` and `test` do not cover the UI. Verify it in the browser via `npm run dev` before reporting it done.
- **Command palette (Ctrl+K) stays in sync:** the app's command palette lists what the user can do (program, history, devices, run speed, examples, preferences). Its commands are built in `src/ui/useCommands.ts` and shown by `CommandPalette.vue`. Whenever a change adds a user-facing action (a new toggle, panel, preference, run option, or anything the user could reasonably look for in the palette), add the matching command in the same change; when an action is renamed or removed, update or remove its command. Toggles use a label that reflects the current state (`Show …` / `Hide …`). Not every control belongs there; skip purely internal or purely contextual ones. A command that moves focus or scrolls the page must set `moves: 'focus' | 'scroll'`: the open palette locks scrolling and hands focus back on close, which would undo it.
- **README on UI changes:** whenever the UI changes (new or changed controls, shortcuts, panels, behavior the user sees), check whether `README.md` should change too (commands, layout, model, usage). If so, update it in the same change.
- **README is bilingual:** `README.md` has the full guide in English at the top and the same guide in Hebrew (RTL) at the bottom. Any README edit must be applied to both halves so they stay equivalent.
- **shadcn components:** add them with `npx shadcn-vue add <name>`, never by hand-writing files in `src/components/ui/`.
- **`cn` is intentional:** the `cn` package is shadcn's replacement for `clsx` + `tailwind-merge`. The generated components import it directly and `src/lib/utils.ts` re-exports it. Don't remove it or swap in `clsx`/`tailwind-merge`.
- **Dependencies:** don't add new packages without asking.
- **Comments:** only where the *why* is not obvious. No comments that restate what the line does.
- **Language with the user:** everything addressed to the user is in Hebrew: replies, explanations, questions and all git reports (which branch was created, which commits were made, what each one contains, what was skipped and why). Only the artifacts stay in English: code, comments, commit messages and branch names. When quoting a commit message or branch name in a Hebrew report, keep it verbatim in English and write the surrounding explanation in Hebrew.
