// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    }
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'rollup.config.js',
      'rollup.config.ts',
      'wrangler.toml',
      'package.json',
      'package-lock.json',
      'eslint.config.js',
    ],
  },
);
