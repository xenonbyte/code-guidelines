// Injected minimal js-ts baseline fixture for PLAN-TASK-012 (SELF-CONTAINED: this stands in for
// the real assets/lint/js-ts/eslint.config.js baseline, which is not created until PLAN-TASK-017).
// test/lint.test.mjs points armLint()'s injectable lint-root option directly at
// test/fixtures/lint-baseline/, so this task never touches assets/lint/.
export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
    },
  },
];
