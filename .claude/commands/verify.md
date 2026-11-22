---
description: Verify the current change - deterministic gates first, then the review agents its files call for
argument-hint: '[--full] [--base <ref>]'
---

Verify the change on this branch (its commits since `main`, the working tree and new files).
Arguments: `$ARGUMENTS`. `--full` runs all five review agents even on a small change; `--base
<ref>` compares against something other than `main`.

Work through the steps in order. Everything you say to the user is in Hebrew; file paths,
commands and the agents' own wording stay as they are.

## 1. Route

Run `node scripts/claude/route.mjs $ARGUMENTS`. It prints the changed files, the `gates` to run,
whether a `review` is called for and why, and the `agents` with the files that belong to each.
Do not second-guess it: if the routing looks wrong, say so in the report and fix `route.mjs`
(it has tests) in a separate change.

## 2. Tier 1: the gates

Run every command in `gates`. `npm run check` goes first; the others (`check:design`, the
`verify:*` oracles, `build`) are independent and can run in parallel with one another.

If a gate fails, fix the cause and run that gate again. A mechanical failure is fixed without
asking (`npm run format`, `npx eslint --fix <file>`). Do not start Tier 2 while a gate is red:
agents are not spent on code that does not typecheck. If a gate still fails after two attempts
at fixing it, stop and report.

A failed oracle prints its seed: keep it in the report, it reproduces the failure
(`npm run verify:rv32 -- <seed>`).

## 3. Tier 2: the agents

Skip this step when `agents` is empty.

Start every agent in `agents` in parallel, in one message, with the Agent tool
(`subagent_type` is the agent's name). Give each one: the base ref, the files listed for it under
`files`, and one sentence saying what the change is for. With `--full` an agent may have an empty
list: give it all the changed source files.

`design-responsive` also takes the URL of a dev server, but only when the change is visible in
the page. Start `npm run dev` in the background first, pass the URL it prints, and stop the
server when the agent is done. It is the only agent that uses the browser. It looks through the
built-in browser, which can emulate a phone's width; if its answer says a width or a theme was not
seen, pass that on in the report as it is.

Each agent answers in a fixed form: a `VERDICT` line and `FINDINGS`, each with a severity, a
`path:line`, evidence, a fix, `autofix` and `confidence`. An answer in any other form is not a
pass: ask that agent once more for the form, and if it fails again report it as not having run.

## 4. Merge the findings

- **One finding per defect.** Findings in the same file, within three lines of each other, about
  the same thing are one finding. Keep the higher severity and the wording of the owner:
  contrast, keyboard and touch belong to `a11y-interaction`; reactivity, layout cost and audio to
  `perf-runtime`; layers, structure and dead code to `vue-architecture`; anything about what an
  instruction does to `isa-correctness`; colour meaning and layout to `design-responsive`.
- **Verify every Blocker yourself** by reading the code at its `path:line` before it reaches the
  user. A Blocker you cannot confirm, or one with `confidence: medium` and no reproduction,
  becomes a Warning and says so.
- The overall verdict is BLOCK with any Blocker left, WARN with any Warning, otherwise PASS.

## 5. Fix

Fix without asking, then say what you fixed:

- formatting and lint fixes;
- a Nit or a Warning with `autofix: yes` that stays inside the files this change already touches
  and cannot change behaviour (a missing ARIA attribute, a token in place of a value,
  `tabular-nums`, a missing cleanup, an unused export).

Never fix on your own; report and wait for the user:

- anything in `src/core` that changes what an instruction does, the undo record, or an encoding.
  When the user approves one, write the failing test first, then the fix, then run the oracle;
- a change to the serialized shape of the state or the undo record;
- a new token, colour or breakpoint, or any other design decision;
- a new dependency, a file in `src/components/ui`, a split of a large file.

After fixing, run step 2 again, and step 3 for only the agents whose findings you fixed. That is
one round. **Two rounds at most**: if a Blocker is still there after the second, stop.

## 6. Report

In Hebrew, short:

1. the verdict (PASS / WARN / BLOCK) and what ran: the gates, each agent, and why any was skipped;
2. the findings that remain, most severe first, as `path:line`, the defect and the fix;
3. what was fixed automatically;
4. anything the user must decide.

Commit only on PASS or WARN, and only when the task itself is finished (CLAUDE.md, "End-of-task
Git workflow"). On BLOCK leave the changes uncommitted.
