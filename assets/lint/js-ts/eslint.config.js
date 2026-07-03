// ESLint flat config (ESLint v10 removed eslintrc support; flat config is the
// only supported format). Export an array of config objects.
//
// Framework-specific plugins (React, Vue, etc.) are appended conditionally by
// sync.mjs when the corresponding frontend stack is detected; this baseline
// covers plain JS/TS only.
export default [
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'no-unused-vars': 'error',
      'no-implicit-coercion': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'coverage/**'],
  },
];
