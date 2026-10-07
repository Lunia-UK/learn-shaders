import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig(
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'prototypes/',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
);
