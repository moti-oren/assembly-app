import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

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
  // src/core is the CPU: it may import only itself, never Vue or the layers built on top of it.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vue', '@vue/*', '@vueuse/*', 'reka-ui', '@lucide/*'],
              message: 'src/core must not depend on Vue or UI libraries.'
            },
            {
              group: ['@/*', '!@/core', '!@/core/*', '../*'],
              message: 'src/core may import only from src/core.'
            }
          ]
        }
      ]
    }
  },
  prettier
);
