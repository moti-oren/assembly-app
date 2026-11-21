// PreToolUse hook for Edit and Write: the shadcn-vue components are generated, so a hand edit
// of one is put to the user first.

import { decide, hookInput, repoPath } from './hookInput.mjs';

const path = repoPath(hookInput().tool_input?.file_path);

if (path?.startsWith('src/components/ui/')) {
  decide(
    'ask',
    `${path} is a generated shadcn-vue component (CLAUDE.md: add them with ` +
      '`npx shadcn-vue add <name>`, never by hand). Edit it only if the user wants this file changed.'
  );
}
