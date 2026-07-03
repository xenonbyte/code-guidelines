// ESLint flat config (ESLint v10 removed eslintrc support; flat config is the
// only supported format). Export an array of config objects.
//
// Framework-specific plugins (React, Vue, etc.) are appended conditionally by
// sync.mjs when the corresponding frontend stack is detected; this baseline
// covers plain JS/TS only.
import tseslint from 'typescript-eslint';

const commonRules = {
  eqeqeq: 'error',
  'no-var': 'error',
  'no-implicit-coercion': 'error',
  'prefer-const': 'error',
  'no-console': 'warn',
};

export default [
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      ...commonRules,
      'no-unused-vars': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...commonRules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'coverage/**'],
  },
];
