---
description: Develop a task with the builder agents - plan where it goes, write the core, then the interface, then the docs, and hand over to /verify
argument-hint: '<the task>'
---

Develop this task: `$ARGUMENTS`.

Work through the steps in order. Everything you say to the user is in Hebrew; file paths, commands
and the agents' own wording stay as they are. You are the one who answers for the result: an
agent's reply is a report, not proof, and no agent commits.

## 1. Branch

Put the work on the right branch by the "Git" section of CLAUDE.md: a new `feature/<short-name>`
or `fix/<short-name>` from an up-to-date `main`, or the current branch when the task continues its
feature. Uncommitted changes that are not this task's are the user's: say so and ask before going
on.

## 2. Scout

Start `feature-scout` with the task in the user's own words and anything this conversation already
settled about it. Its answer is the plan: `FILES`, `REUSE`, `TESTS`, `SYNC`, `DECISIONS`. An answer
in any other form is asked for once more.

If `DECISIONS` is not `none`, put each one to the user and wait: nothing is written before the
answers. Read the plan yourself as well. A plan that looks wrong (a second copy of something, a
file in the wrong layer) is corrected now, with the scout or by you, not after it is built.

## 3. Route

Run `node scripts/claude/develop.mjs --model <the model you run on> <every path under FILES and
TESTS>`. It prints:

- `packages`: the files of each builder, and `order`, the order they run in;
- `mismatched`: the builders you are the wrong model for, one pinned above yours or two steps
  below it. Their files are theirs however small the task is;
- `checks`: what each builder must pass;
- `unowned`: files no builder writes (`package.json`, a workflow, `src/components/ui`, the
  scripts). They are yours, and the ones CLAUDE.md keeps for the user (a dependency, a generated
  component) wait for the user's yes;
- `inline`: the task is a file or two of one builder, and your model suits it. Then write it
  yourself, with the plan and by the same rules, and go to step 6. Agents are not spent on a small
  change.

Do not second-guess the routing: if it looks wrong, say so in the report and fix `develop.mjs`
(it has tests) in a separate change.

## 4. Build

Run the builders in `order`, one at a time, each with the Agent tool (`subagent_type` is its
name). Never two writers at once: the interface is written against what the core exports. Pass no
model and no effort: each agent's file pins its own.

Give each builder: the task, its own lines of `FILES`, `REUSE` and `TESTS`, the user's answers to
the decisions, and its `checks`. `ui-builder` also takes the `EXPORTS` that `core-builder`
reported and, when the change is visible in the page, the URL of a dev server: start it with
`preview_start` before the agent and stop it when the agent is done.

After each builder, before the next one starts:

1. `git status --porcelain`, then `node scripts/claude/develop.mjs --stray <agent> <the files it
   changed>`. A file outside its own is reported to the user as it is; do not quietly keep it and
   do not quietly revert it.
2. Read the diff. `STATUS: DONE` with a check that failed, a test that proves nothing, or a
   contract of CLAUDE.md broken is not done.
3. Act on the status:
   - `NEEDS` naming another builder's file goes to that builder, as a task of its own, once;
   - `NEEDS` naming the user, or `BLOCKED`, goes to the user, and the work waits;
   - `PARTIAL` goes back to the same builder with what is left, once. A second `PARTIAL` or
     `BLOCKED` from the same builder stops the run: report what stands and what remains, and leave
     the changes uncommitted.

## 5. Docs

Start `docs-sync` when `SYNC` names the README or CLAUDE.md, when a builder reported `COMMANDS`,
or when the change added, renamed or removed a file. Give it the base ref, the changed files and
one sentence saying what the change is for. Read what it changed: both halves of the README must
say the same thing.

## 6. Verify

Run `/verify`. It is the gate, and it is where the review agents look at what the builders wrote;
its fixes follow its own rules. Then, when the task is whole, the "End-of-task Git workflow" of
CLAUDE.md: atomic commits (a core change with its test, the docs on their own), a clean
`git status`, and the report.

## 7. Report

In Hebrew, short:

1. what was built, and by whom: the scout's plan in a line, each builder's status and files;
2. what each builder checked, and what `ui-builder` saw in the browser (or did not see);
3. files changed outside a builder's own, and anything left or waiting for a decision;
4. the verdict of `/verify`, the branch and the commits.
