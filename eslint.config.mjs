import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// 所有维护中的源码都受检查；只忽略依赖、构建和发布产物。
export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'dist-electron/**', 'release/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['types/**/*.{ts,mts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/store/**',
                '**/services/**',
                '**/hooks/**',
                '**/components/**',
                '**/src/**',
                '**/utils/**',
                '**/platform/**',
              ],
              message:
                'Domain types must not depend on state, UI, services, or implementation helpers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['store/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/components/**'],
              message: 'Store code must not depend on UI components.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['utils/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        'fetch',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                '**/store/**',
                '**/services/**',
                '**/hooks/**',
                '**/components/**',
                '**/platform/**',
                '**/electron/**',
              ],
              message: 'Pure utilities must depend only on domain types and pure helpers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                '**/store/**',
                '**/services/**',
                '**/hooks/**',
                '**/components/**',
              ],
              message: 'Platform adapters must not depend on application state or UI.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['hooks/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/components/**'],
              message: 'Application coordination must not depend on component implementations.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: Object.fromEntries(
        ['console', 'process', 'Buffer', 'TextDecoder', 'URL', 'setTimeout', 'clearTimeout'].map(
          (name) => [name, 'readonly'],
        ),
      ),
    },
  },
);
