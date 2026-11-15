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

Style: Prettier with single quotes, semicolons, no trailing commas, 100 columns. Path alias `@` → `src`.

## Architecture

Two layers; keep them separate.

- `src/core/` is the CPU and **must not depend on Vue**. All logic is tested here.
  - `state.ts`: registers (8-bit registers are views into AX..DX), FLAGS, 1MB memory.
  - `instructions.ts`: the instruction set expressed as data; each mnemonic lists its legal operand forms. Adding an instruction starts here.
  - `builder.ts`: given the words chosen so far, computes which operands may come next (drives the UI's word-by-word builder).
  - `execute.ts`: runs one instruction, computes flags, and returns an **undo record** (history/undo depends on this).
  - `program.ts`: a program is a list of instructions; stepping, running, and edits that keep jump targets on the right lines.
- `src/ui/`: Vue components in `ui/components/` and `useCpu.ts`, which wraps the core in Vue reactivity. Theme tokens (including the app accents `--changed` and `--pointer`) live in `src/ui/styles.css`.
- `src/components/ui/`: shadcn-vue components (Tailwind v4 + reka-ui), generated with `npx shadcn-vue add <name>`. They are excluded from ESLint; don't hand-edit them casually. Config in `components.json`.

## Execution model (non-obvious)

- Instructions are **not encoded into bytes**. IP is the index of the next program line (L0, L1, …); jump/call targets are lines. CALL pushes the next line onto the stack and RET pops it.
- An instruction runs immediately (Enter) or is appended to the program (Shift+Enter).
- Memory operands are `byte`/`word` `[bx]`, `[si]`, `[di]`, `[bp]` or `[offset]`. `[bp]` uses SS; all others use DS.
- Shift counts are `1` or `CL`, as on the 8086.

## Git

- **Atomic commits:** one logical change per commit. Don't mix a refactor, a bug fix and a feature in one commit, and don't bundle unrelated files. Each commit should leave `npm run typecheck`, `npm run lint` and `npm test` passing. Stage selectively (`git add -p` or by path), never `git add -A` blindly.
- **Tests with code:** a change to `src/core/` goes in the same commit as its test update.
- **Message format:** `<type>: <description>`, all lowercase, imperative or short noun phrase, no trailing period, subject ≤ 72 characters. Types used in this repo's history: `create`, `update`, `change`, `fix`, `remove`, `init`. Use `create` for new files/features, `update` for extending existing ones, `change` for behavior or design changes, `fix` for bugs, `remove` for deletions.
  - Example: `fix: asHigh bits methods in the Mask class`
- Add a body (blank line after the subject) only when the *why* isn't obvious from the diff.
- **Commit only when asked.** Don't commit, push, amend, or rewrite history (rebase, reset --hard, force-push) unless explicitly requested. Prefer a new commit over amending.
- **Branches:** work on `main` only if the user says so. Otherwise propose a branch for non-trivial work, named `feature/<name>` or `fix/<name>`.
- **Language:** commit messages, code and code comments are in English, even when the conversation is in Hebrew.
- **Destructive commands:** before `git reset`, `git checkout -- <path>`, `git clean` or `git stash drop`, inspect what will be lost (`git status`, `git diff`). Uncommitted work may be the user's.
- **Large moves:** commit deletions, moves/renames and new content separately, so `git log --follow` and blame keep working.
- **Lockfile:** `package-lock.json` changes go in the same commit as the `package.json` change that caused them.
- If a change breaks the serialized shape of core state or the undo record, say so in the commit body (`BREAKING:` line).
- Never skip hooks (`--no-verify`). If a hook fails, fix the cause.
- Don't commit `dist/`, `node_modules/`, or `graphify-out/` (check `.gitignore` before staging).

## Conventions

- **`core` stays framework-free:** never import `vue` or anything from `@/ui` / `@/components` inside `src/core/`.
- **Adding an instruction:** define it in `instructions.ts`, implement it in `execute.ts`, then add tests in `execute.test.ts`. If it touches flags, test the flags too.
- **Undo is a contract:** every path in `execute.ts` must return a complete undo record (registers, flags, memory writes and IP). A new path without one breaks history.
- **8086 fidelity:** flag behavior (AF, OF, CF, etc.) follows real 8086 semantics, not whatever is convenient. When unsure, check the 8086 reference instead of guessing.
- **UI changes:** `typecheck` and `test` do not cover the UI. Verify it in the browser via `npm run dev` before reporting it done.
- **shadcn components:** add them with `npx shadcn-vue add <name>`, never by hand-writing files in `src/components/ui/`.
- **`cn` is intentional:** the `cn` package is shadcn's replacement for `clsx` + `tailwind-merge`. The generated components import it directly and `src/lib/utils.ts` re-exports it. Don't remove it or swap in `clsx`/`tailwind-merge`.
- **Dependencies:** don't add new packages without asking.
- **Comments:** only where the *why* is not obvious. No comments that restate what the line does.
- **`graphify-out/`:** generated output (git-ignored). Don't edit it by hand.
- **Language with the user:** reply in Hebrew; code, comments and commit messages stay in English.
