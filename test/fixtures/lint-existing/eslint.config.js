// Fixture: a project that ALREADY has its own ESLint flat config before code-guidelines ever
// runs. SPEC-LINT-001 requires this file be left byte-for-byte unchanged — armLint() must only
// ever emit a read-only recommendation for it, never a write.
export default [
  {
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'error',
    },
  },
];
