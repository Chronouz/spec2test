import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 390,   // iPhone 14 Pro viewport
    viewportHeight: 844,
    defaultCommandTimeout: 8000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    retries: {
      runMode: 2,   // CI: retry flaky tests twice
      openMode: 0,
    },
    env: {
      API_BASE_URL: 'http://localhost:8080',
    },
    setupNodeEvents(on, config) {
      // Node event listeners (coverage, reporting, etc.)
      return config;
    },
  },
});
