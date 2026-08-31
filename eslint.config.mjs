import path from 'node:path';
import { fileURLToPath } from 'node:url';

import antfu from '@antfu/eslint-config';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import i18nJsonPlugin from 'eslint-plugin-i18n-json';
import reactCompiler from 'eslint-plugin-react-compiler';
import testingLibrary from 'eslint-plugin-testing-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default antfu(
  {
    // Enable React and TypeScript support
    react: true,
    typescript: true,

    // Disable JSON processing for translation files (handled by i18n-json plugin)
    jsonc: false,

    // Use ESLint Stylistic for formatting
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: true,
    },

    // Global ignores
    ignores: [
      'dist/*',
      'node_modules',
      '__tests__/',
      'coverage',
      '.expo',
      '.expo-shared',
      'android',
      'ios',
      '.vscode',
      'docs/',
      'cli/',
      // Deno Edge Functions & SQL — different runtime, no tsconfig coverage
      // (tsconfig.json excludes `supabase/` entirely; wiring up `deno check`
      // in CI is a workflow change, Jai's call, not this config's). All of
      // `supabase/functions/**` is un-ignored below via negation so basic
      // mechanical issues (unused imports, shadowing, formatting) are at
      // least caught by ESLint even without type information. Migrations
      // and SQL stay ignored — this is TS-only.
      'supabase/**',
      '!supabase/functions/**/*.ts',
      'expo-env.d.ts',
      'migration/*',
    ],
  },

  // Custom rules
  {
    rules: {
      'max-params': ['error', 3],
      'max-lines-per-function': ['error', 110],
      'react/display-name': 'off',
      'react/no-inline-styles': 'off',
      'react/destructuring-assignment': 'off',
      'react/require-default-props': 'off',
      'react-refresh/only-export-components': 'warn', // Too strict for React Native
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: [
            '/android',
            '/ios',
            'README.md',
            'README-project.md',
            'ISSUE_TEMPLATE.md',
            'PULL_REQUEST_TEMPLATE.md',
          ],
        },
      ],
      'node/prefer-global/process': 'off', // process is commonly used in React Native configs
      'ts/no-require-imports': 'off', // Sometimes needed for mocks
      'ts/no-use-before-define': 'off', // Allow forward references in React components
      'no-console': 'off', // Console is useful for debugging
      'no-cond-assign': 'off', // Allow assignment in conditions when intentional
      'regexp/no-super-linear-backtracking': 'off', // Relax regex performance rules
      'regexp/no-unused-capturing-group': 'off', // Allow unused capturing groups
    },
  },

  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'ts/consistent-type-definitions': ['error', 'type'], // Prefer type over interface
      'react-hooks/refs': 'off', // Allow useRef without exhaustive-deps
      'ts/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
    },
  },

  // Better TailwindCSS plugin
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...betterTailwindcss.configs.recommended,
    settings: {
      'better-tailwindcss': {
        entryPoint: path.resolve(__dirname, './src/global.css'),
      },
    },
    rules: {
      ...betterTailwindcss.configs.recommended.rules,
      'better-tailwindcss/no-unnecessary-whitespace': 'warn',
      'better-tailwindcss/no-unknown-classes': 'warn',
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off', // Can be too strict for some cases
    },
  },

  // React Compiler plugin
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },

  // i18n JSON validation
  {
    files: ['src/translations/*.json'],
    plugins: { 'i18n-json': i18nJsonPlugin },
    processor: {
      meta: { name: '.json' },
      ...i18nJsonPlugin.processors['.json'],
    },
    rules: {
      ...i18nJsonPlugin.configs.recommended.rules,
      'i18n-json/valid-message-syntax': [
        2,
        {
          syntax: path.resolve(
            __dirname,
            './scripts/i18next-syntax-validation.js',
          ),
        },
      ],
      'i18n-json/valid-json': 2,
      'i18n-json/sorted-keys': [2, { order: 'asc', indentSpaces: 2 }],
      'i18n-json/identical-keys': [
        2,
        { filePath: path.resolve(__dirname, './src/translations/en.json') },
      ],
      // Disable conflicting rules for i18n JSON files
      'style/semi': 'off',
      'style/comma-dangle': 'off',
      'style/quotes': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // Testing Library rules — component tests only. Playwright specs live in
  // e2e/ and are excluded below: they drive a real browser, so rules about
  // `screen` queries and `render` results describe a different tool entirely.
  {
    files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    ignores: ['e2e/**'],
    plugins: { 'testing-library': testingLibrary },
    rules: {
      ...testingLibrary.configs.react.rules,
    },
  },

  // All of supabase/functions/** un-ignored above. `Deno` is a global this
  // runtime provides (no plugin/environment ships it), and several functions
  // here take 4-6 positional args mirroring the shape of the Anthropic/
  // Supabase calls they wrap (a client, ids, provider parameters) —
  // reshaping them into options objects would touch call sites across
  // generate-chapter/enqueue-chapter/illustrate-chapter, which is a real
  // refactor and out of bounds for a lint-only, no-behaviour-change pass.
  // Several Edge Function handlers also run long past the app's 110-line
  // limit (request parsing, auth, and the actual work all live in one
  // top-level handler, matching every existing entrypoint's shape) —
  // splitting them is a structural change, not a lint fix.
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
      },
    },
    rules: {
      'max-params': 'off',
      'max-lines-per-function': 'off',
    },
  },

  // Playwright E2E harness. Node code driving a browser, not app code.
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      'node/prefer-global/buffer': 'off', // Node context; Buffer is a global.
      'unicorn/prefer-dom-node-text-content': 'off', // locator.innerText() is Playwright's API, not the DOM's.
      'max-params': ['error', 4],
      // Playwright determines a test's fixtures by parsing its first parameter,
      // which must therefore be a destructuring pattern even when empty. Naming
      // it instead makes Playwright refuse to run the file at all — which is a
      // CI failure eslint cannot see and this rule directly causes.
      'no-empty-pattern': 'off',
      // An end-to-end scenario is a single linear story and reads best as one.
      // The app's 110-line limit exists to stop components doing too much;
      // applied here it would only force the flow into artificial fragments.
      'max-lines-per-function': 'off',
    },
  },
);
