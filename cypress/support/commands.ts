// =============================================================================
// FILE: cypress/support/commands.ts
// Custom Cypress commands for Transfer Dana test suite
// =============================================================================

// ── Type augmentation ────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Fill the transfer form through to the MPIN screen.
       * Waits for the account inquiry stub alias '@inquiryActive' automatically.
       *
       * @param accountNumber - 10-digit destination account number
       * @param bankCode      - Bank code matching the <select> option value
       * @param amount        - Transfer amount as a plain string (no dots/commas)
       * @param inquiryAlias  - cy.intercept alias to wait on (default: 'inquiryActive')
       */
      fillTransferForm(
        accountNumber: string,
        bankCode: string,
        amount: string,
        inquiryAlias?: string,
      ): Chainable<void>;

      /**
       * Stub a successful account inquiry and set the alias '@inquiryActive'.
       *
       * @param accountName - Beneficiary name returned by the stub
       */
      stubInquirySuccess(accountName?: string): Chainable<void>;

      /**
       * Stub a successful POST /api/v1/transfer and set the alias '@transferActive'.
       *
       * @param overrides - Partial response body fields to override
       */
      stubTransferSuccess(overrides?: Record<string, unknown>): Chainable<void>;
    }
  }
}

// ── Selector constants (kept in sync with the spec file) ────────────────────
const SEL = {
  ACCOUNT_NUMBER_INPUT: '[data-cy="account-number-input"]',
  BANK_DROPDOWN:        '[data-cy="bank-dropdown"]',
  AMOUNT_INPUT:         '[data-cy="amount-input"]',
  BTN_CHECK_ACCOUNT:    '[data-cy="btn-check-account"]',
  BTN_CONTINUE:         '[data-cy="btn-continue"]',
};

// ── Command implementations ──────────────────────────────────────────────────

Cypress.Commands.add(
  'fillTransferForm',
  (
    accountNumber: string,
    bankCode: string,
    amount: string,
    inquiryAlias = 'inquiryActive',
  ) => {
    cy.get(SEL.ACCOUNT_NUMBER_INPUT).clear().type(accountNumber);
    cy.get(SEL.BANK_DROPDOWN).select(bankCode);
    cy.get(SEL.BTN_CHECK_ACCOUNT).click();
    cy.wait(`@${inquiryAlias}`);
    cy.get(SEL.AMOUNT_INPUT).clear().type(amount);
    cy.get(SEL.BTN_CONTINUE).click();
  },
);

Cypress.Commands.add('stubInquirySuccess', (accountName = 'ANDI WIJAYA') => {
  cy.intercept('GET', '/api/v1/accounts/inquiry', {
    statusCode: 200,
    body: { accountName },
  }).as('inquiryActive');
});

Cypress.Commands.add('stubTransferSuccess', (overrides = {}) => {
  cy.intercept('POST', '/api/v1/transfer', {
    statusCode: 200,
    body: {
      transactionId: 'TXN-20240115-001',
      status:        'BERHASIL',
      amount:        10000,
      adminFee:      2500,
      totalDebit:    12500,
      timestamp:     '2024-01-15T10:30:00+07:00',
      ...overrides,
    },
  }).as('transferActive');
});

export {};
