// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/', '.astro/', 'docs/prototypes/', 'playwright-report/', 'test-results/', '.lighthouseci/'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.astro'],
      },
    },
  },
  astro.configs['flat/recommended'],
  astro.configs['flat/jsx-a11y-strict'],
  {
    files: ['**/*.astro'],
    languageOptions: {
      // astro-eslint-parser has no project service; it reads the tsconfig instead.
      parserOptions: { parser: tseslint.parser, projectService: false, project: true },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
