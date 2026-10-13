// =============================================================================
// FILE: cypress/support/e2e.ts
// Global support file — loaded automatically before every spec
// =============================================================================

// Import custom commands
import './commands';

// Prevent Cypress from failing on uncaught exceptions from the app under test
// (security tests intentionally inject malformed payloads that may throw)
Cypress.on('uncaught:exception', (err, _runnable) => {
  // Log but do not fail the test for known security-test-induced errors
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('Non-Error promise rejection')
  ) {
    return false;
  }
  // Let all other exceptions propagate normally
  return true;
});
