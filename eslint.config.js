import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ),
  {
    plugins: { '@typescript-eslint': typescriptEslint },

    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },

    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'all', argsIgnorePattern: '^_' },
        // circumvent unused var warnings by starting var names with `_`
      ],
      'no-console': [
        'warn',
        { allow: ['warn', 'error'] },
        // pointless console-logging not allowed
      ],
      'max-len': [
        'warn',
        { code: 90, ignoreComments: true, ignoreStrings: true },
      ],
    }
  },
  {
    ignores: [
      'node_modules/*',
      'trash/*',
      'playground.ts',
      '**/*js'
    ],
  }
]