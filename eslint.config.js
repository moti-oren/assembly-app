import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const CORE_STAYS_FRAMEWORK_FREE = {
  group: ['vue', '@vue/*', '@vueuse/*', 'reka-ui', '@lucide/*'],
  message: 'src/core must not depend on Vue or UI libraries.'
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/components/ui'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  },
  {
    languageOptions: { globals: globals.browser }
  },
  // The scripts run in Node, not in the page.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node }
  },
  // src/core is the CPU: it may import only itself, never Vue or the layers built on top of it.
  {
    files: ['src/core/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            CORE_STAYS_FRAMEWORK_FREE,
            {
              group: ['@/*', '!@/core', '!@/core/*', '../*'],
              message: 'src/core may import only from src/core.'
            }
          ]
        }
      ]
    }
  },
  // What every architecture builds on: it may not know about any one of them.
  {
    files: ['src/core/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            CORE_STAYS_FRAMEWORK_FREE,
            {
              group: ['@/*', '../*'],
              message: 'src/core/shared may import only from itself.'
            }
          ]
        }
      ]
    }
  },
  // Each architecture is a folder of its own, built on shared but never on another architecture.
  {
    files: ['src/core/*/**/*.ts'],
    ignores: ['src/core/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            CORE_STAYS_FRAMEWORK_FREE,
            {
              group: ['@/*', '../*', '!../shared', '!../shared/*'],
              message: 'An architecture may import only from its own folder and src/core/shared.'
            }
          ]
        }
      ]
    }
  },
  // UI helpers are plain functions over plain data: no Vue, no composables, no components.
  {
    files: ['src/ui/*.ts'],
    ignores: ['src/ui/use*.ts', 'src/ui/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vue', '@vue/*', '@vueuse/*'],
              message: 'Reactive code belongs in a use*.ts composable, not in a helper.'
            },
            {
              group: ['./use*', '@/ui/use*', '*.vue'],
              message: 'A helper must not import composables or components.'
            }
          ]
        }
      ]
    }
  },
  // Composables sit below the components: they never import one, not even for a type.
  {
    files: ['src/ui/use*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*.vue'],
              message:
                'A composable must not import a component; shared types belong in a .ts file.'
            }
          ]
        }
      ]
    }
  },
  // Past ~500 lines a source file must be split (CLAUDE.md, "Code structure").
  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    ignores: ['src/**/*.test.ts'],
    rules: { 'max-lines': ['error', { max: 500 }] }
  },
  prettier
);
