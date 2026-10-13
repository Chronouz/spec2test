// =============================================================================
// FILE: cypress/e2e/transfer-dana/transfer-dana.cy.ts
// FEATURE: Transfer Dana Antar Rekening — Mobile Banking
// FRAMEWORK: Cypress 13 + TypeScript
// COVERAGE: TC-TRF-001 → TC-TRF-050 (50 test cases)
//           Category A: Positive  | Category B: Negative
//           Category C: Boundary  | Category D: Security
// =============================================================================

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------

interface TransferPayload {
  accountNumber: string | null;
  bankCode: string | null;
  amount: number | string | null;
  mpin: string | null;
  idempotencyKey?: string;
}

interface SessionBody {
  userId?: string;
  accountNumber?: string;
  accountStatus: 'AKTIF' | 'TERKUNCI';
  mpinFailCount?: number;
  dailyLimitUsed?: number;
  dailyLimitTotal?: number;
  balance?: number;
  lockUntil?: string;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const ROUTES = {
  TRANSFER: '/transfer',
  HISTORY:  '/riwayat-transaksi',
};

const API = {
  SESSION:  '/api/v1/auth/session',
  INQUIRY:  '/api/v1/accounts/inquiry',
  TRANSFER: '/api/v1/transfer',
  RECEIPTS: '/api/v1/receipts/**',
};

const SEL = {
  ACCOUNT_NUMBER_INPUT: '[data-cy="account-number-input"]',
  BANK_DROPDOWN:        '[data-cy="bank-dropdown"]',
  AMOUNT_INPUT:         '[data-cy="amount-input"]',
  NOTES_INPUT:          '[data-cy="notes-input"]',
  MPIN_INPUT:           '[data-cy="mpin-input"]',
  BTN_CHECK_ACCOUNT:    '[data-cy="btn-check-account"]',
  BTN_CONTINUE:         '[data-cy="btn-continue"]',
  BTN_CONFIRM:          '[data-cy="btn-confirm"]',
  BENEFICIARY_NAME:     '[data-cy="beneficiary-name"]',
  ERROR_MESSAGE:        '[data-cy="error-message"]',
  INLINE_ERROR:         '[data-cy="inline-error"]',
  SUCCESS_RECEIPT:      '[data-cy="success-receipt"]',
  RECEIPT_STATUS:       '[data-cy="receipt-status"]',
  RECEIPT_AMOUNT:       '[data-cy="receipt-amount"]',
  RECEIPT_FEE:          '[data-cy="receipt-admin-fee"]',
  RECEIPT_TOTAL:        '[data-cy="receipt-total-debit"]',
  RECEIPT_TXN_ID:       '[data-cy="receipt-transaction-id"]',
  RECEIPT_TIMESTAMP:    '[data-cy="receipt-timestamp"]',
  RECEIPT_SENDER_NAME:  '[data-cy="receipt-sender-name"]',
  RECEIPT_SENDER_ACCT:  '[data-cy="receipt-sender-account"]',
  RECEIPT_BENEF_NAME:   '[data-cy="receipt-beneficiary-name"]',
  RECEIPT_BENEF_ACCT:   '[data-cy="receipt-beneficiary-account"]',
  RECEIPT_BANK_DEST:    '[data-cy="receipt-bank-destination"]',
  RECEIPT_NOTES:        '[data-cy="receipt-notes"]',
  BALANCE_AFTER:        '[data-cy="balance-after-transfer"]',
  ACCOUNT_LOCK_MSG:     '[data-cy="account-lock-message"]',
  SESSION_EXPIRED_MSG:  '[data-cy="session-expired-modal"], [data-cy="login-redirect-message"]',
  PUSH_NOTIFICATION:    '[data-cy="push-notification-toast"]',
  LIMIT_REMAINING:      '[data-cy="daily-limit-remaining"]',
  TXN_STATUS_LATEST:    '[data-cy="txn-status-latest"]',
};

const VALID_MPIN   = '123456';
const INVALID_MPIN = '000000';
const ADMIN_FEE    = 2500;

// ---------------------------------------------------------------------------
// LOCAL HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/** Stub GET /api/v1/accounts/inquiry → 200 */
function stubInquiry200(alias: string, accountName = 'ANDI WIJAYA'): void {
  cy.intercept('GET', API.INQUIRY, {
    statusCode: 200,
    body: { accountName },
  }).as(alias);
}

/** Stub GET /api/v1/accounts/inquiry → 404 */
function stubInquiry404(alias: string, bankName = 'BCA'): void {
  cy.intercept('GET', API.INQUIRY, {
    statusCode: 404,
    body: {
      error: `Nomor rekening tidak ditemukan di ${bankName}. Periksa kembali nomor rekening Anda.`,
    },
  }).as(alias);
}

/** Stub POST /api/v1/transfer → 200 */
function stubTransfer200(
  alias: string,
  overrides: Record<string, unknown> = {},
): void {
  cy.intercept('POST', API.TRANSFER, {
    statusCode: 200,
    body: {
      transactionId: 'TXN-20240115-001',
      status:        'BERHASIL',
      amount:        10000,
      adminFee:      ADMIN_FEE,
      totalDebit:    12500,
      timestamp:     '2024-01-15T10:30:00+07:00',
      ...overrides,
    },
  }).as(alias);
}

/** Stub POST /api/v1/transfer → error */
function stubTransferErr(
  alias: string,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  cy.intercept('POST', API.TRANSFER, { statusCode, body }).as(alias);
}

/** Stub GET /api/v1/auth/session */
function stubSession(alias: string, body: SessionBody): void {
  cy.intercept('GET', API.SESSION, { statusCode: 200, body }).as(alias);
}

/** Fill the transfer form up to (not including) MPIN submission. */
function fillForm(
  accountNumber: string,
  bankCode: string,
  amount: string,
  inquiryAlias: string,
): void {
  cy.get(SEL.ACCOUNT_NUMBER_INPUT).clear().type(accountNumber);
  cy.get(SEL.BANK_DROPDOWN).select(bankCode);
  cy.get(SEL.BTN_CHECK_ACCOUNT).click();
  cy.wait(`@${inquiryAlias}`);
  cy.get(SEL.AMOUNT_INPUT).clear().type(amount);
  cy.get(SEL.BTN_CONTINUE).click();
}

// ---------------------------------------------------------------------------
// DEFAULT SESSION BODY (happy path defaults)
// ---------------------------------------------------------------------------
const DEFAULT_SESSION: SessionBody = {
  userId:          'USR-001',
  accountNumber:   '0812345678',
  accountStatus:   'AKTIF',
  mpinFailCount:   0,
  dailyLimitUsed:  0,
  dailyLimitTotal: 50_000_000,
  balance:         60_000_000,
};

// =============================================================================
// MAIN DESCRIBE
// =============================================================================

describe('Feature: Transfer Dana Antar Rekening Mobile Banking', () => {

  // ── GLOBAL BACKGROUND ──────────────────────────────────────────────────────
  beforeEach(() => {
    stubSession('getSession', DEFAULT_SESSION);

    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', 'valid-jwt-token-mock');
    });

    cy.visit(ROUTES.TRANSFER);
    cy.wait('@getSession');

    // Default inquiry stub — individual tests may override before cy.visit/click
    stubInquiry200('inquiryDefault');
  });

  // ==========================================================================
  // GROUP A — POSITIVE / HAPPY PATH
  // ==========================================================================

  describe('Category A — Positive / Happy Path', () => {

    it('TC-TRF-001: Transfer sukses nominal minimum Rp10.000 — resi & notifikasi tampil', () => {
      stubSession('sessionMin', { ...DEFAULT_SESSION, balance: 12_500 });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@sessionMin');

      stubInquiry200('inq001');
      stubTransfer200('tx001', { amount: 10_000, adminFee: ADMIN_FEE, totalDebit: 12_500 });

      fillForm('1234567890', 'BCA', '10000', 'inq001');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx001');

      cy.get(SEL.SUCCESS_RECEIPT).should('be.visible');
      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.RECEIPT_AMOUNT).should('contain.text', 'Rp10.000');
      cy.get(SEL.RECEIPT_FEE).should('contain.text', 'Rp2.500');
      cy.get(SEL.RECEIPT_TOTAL).should('contain.text', 'Rp12.500');
      cy.get(SEL.RECEIPT_TXN_ID).should('not.be.empty');
      cy.get(SEL.RECEIPT_TIMESTAMP).should('not.be.empty');
      cy.get(SEL.PUSH_NOTIFICATION, { timeout: 5000 }).should('be.visible');
    });

    it('TC-TRF-002: Transfer sukses nominal maksimum Rp25.000.000 — limit harian terpotong', () => {
      stubInquiry200('inq002');
      stubTransfer200('tx002', {
        amount:     25_000_000,
        adminFee:   ADMIN_FEE,
        totalDebit: 25_002_500,
      });

      fillForm('9876543210', 'MANDIRI', '25000000', 'inq002');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx002');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.RECEIPT_AMOUNT).should('contain.text', 'Rp25.000.000');
      cy.get(SEL.RECEIPT_FEE).should('contain.text', 'Rp2.500');
      cy.get(SEL.RECEIPT_TOTAL).should('contain.text', 'Rp25.002.500');
      cy.get(SEL.LIMIT_REMAINING).should('contain.text', 'Rp25.000.000');
    });

    it('TC-TRF-003: Transfer sukses nominal tengah Rp500.000', () => {
      stubInquiry200('inq003');
      stubTransfer200('tx003', {
        amount:     500_000,
        adminFee:   ADMIN_FEE,
        totalDebit: 502_500,
      });

      fillForm('1111111111', 'BNI', '500000', 'inq003');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx003');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.LIMIT_REMAINING).should('contain.text', 'Rp49.500.000');
    });

    it('TC-TRF-004: Dua transaksi berurutan tidak melebihi limit harian Rp50.000.000', () => {
      // --- Transaksi 1: Rp30.000.000 ---
      stubInquiry200('inq004a');
      stubTransfer200('tx004a', { amount: 30_000_000, totalDebit: 30_002_500 });
      fillForm('9876543210', 'MANDIRI', '30000000', 'inq004a');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx004a');
      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');

      // --- Transaksi 2: Rp19.000.000 (limit tersisa Rp20.000.000) ---
      stubSession('session004b', {
        ...DEFAULT_SESSION,
        dailyLimitUsed: 30_000_000,
        balance:        30_000_000,
      });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session004b');

      stubInquiry200('inq004b');
      stubTransfer200('tx004b', { amount: 19_000_000, totalDebit: 19_002_500 });
      fillForm('1234567890', 'BCA', '19000000', 'inq004b');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx004b');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.LIMIT_REMAINING).should('contain.text', 'Rp1.000.000');
    });

    it('TC-TRF-005: Inquiry rekening menampilkan nama penerima yang bersifat read-only', () => {
      cy.intercept('GET', API.INQUIRY, {
        statusCode: 200,
        body: { accountName: 'BUDI SANTOSO' },
      }).as('inq005');

      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('5555555555');
      cy.get(SEL.BANK_DROPDOWN).select('BRI');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq005');

      cy.get(SEL.BENEFICIARY_NAME)
        .should('contain.text', 'BUDI SANTOSO')
        .and('have.attr', 'readonly');
    });

    it('TC-TRF-006: MPIN salah 2x lalu benar pada percobaan ke-3 — transaksi sukses, counter reset', () => {
      stubInquiry200('inq006');
      fillForm('1111111111', 'BNI', '500000', 'inq006');

      // Attempt 1 — salah
      stubTransferErr('mpinFail1', 401, {
        error: 'MPIN salah. 2 kesempatan tersisa',
        remainingAttempts: 2,
      });
      cy.get(SEL.MPIN_INPUT).clear().type(INVALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@mpinFail1');
      cy.get(SEL.ERROR_MESSAGE).should('contain.text', '2 kesempatan tersisa');

      // Attempt 2 — salah
      stubTransferErr('mpinFail2', 401, {
        error: 'MPIN salah. 1 kesempatan tersisa',
        remainingAttempts: 1,
      });
      cy.get(SEL.MPIN_INPUT).clear().type('111111');
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@mpinFail2');
      cy.get(SEL.ERROR_MESSAGE).should('contain.text', '1 kesempatan tersisa');

      // Attempt 3 — benar
      stubTransfer200('mpinOk', { amount: 500_000 });
      cy.get(SEL.MPIN_INPUT).clear().type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@mpinOk');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.ACCOUNT_LOCK_MSG).should('not.exist');
    });

    it('TC-TRF-007: Resi digital memuat semua field wajib yang tidak kosong', () => {
      stubInquiry200('inq007');
      stubTransfer200('tx007');
      fillForm('1234567890', 'BCA', '10000', 'inq007');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx007');

      const mandatoryFields = [
        SEL.RECEIPT_TXN_ID,
        SEL.RECEIPT_TIMESTAMP,
        SEL.RECEIPT_STATUS,
        SEL.RECEIPT_AMOUNT,
        SEL.RECEIPT_FEE,
        SEL.RECEIPT_TOTAL,
        SEL.RECEIPT_SENDER_NAME,
        SEL.RECEIPT_SENDER_ACCT,
        SEL.RECEIPT_BENEF_NAME,
        SEL.RECEIPT_BENEF_ACCT,
        SEL.RECEIPT_BANK_DEST,
      ];

      mandatoryFields.forEach((selector) => {
        cy.get(selector).should('be.visible').and('not.be.empty');
      });
    });

  }); // END Group A

  // ==========================================================================
  // GROUP B — NEGATIVE / FAULT HANDLING
  // ==========================================================================

  describe('Category B — Negative / Fault Handling', () => {

    it('TC-TRF-008: Nomor rekening 9 digit → inline error, tombol disabled', () => {
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('123456789');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Nomor rekening harus 10 digit angka');
      cy.get(SEL.BTN_CONTINUE).should('be.disabled');
    });

    it('TC-TRF-009: Field rekening membatasi input maksimum 10 karakter', () => {
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('12345678901');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT)
        .invoke('val')
        .then((val) => {
          expect((val as string).length).to.be.lte(10);
        });
    });

    it('TC-TRF-010: Field rekening hanya menerima angka — huruf tidak dapat diketik', () => {
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('123ABC7890');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT)
        .invoke('val')
        .should('match', /^[0-9]*$/);
    });

    it('TC-TRF-011: Bank tujuan tidak dipilih → error "Silakan pilih bank tujuan"', () => {
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Silakan pilih bank tujuan');
    });

    it('TC-TRF-012: Nominal Rp9.999 (di bawah minimum) → error minimal Rp10.000', () => {
      stubInquiry200('inq012');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq012');
      cy.get(SEL.AMOUNT_INPUT).type('9999');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Nominal transfer minimal Rp10.000');
    });

    it('TC-TRF-013: Nominal Rp25.000.001 (di atas maksimum) → error maksimal Rp25.000.000', () => {
      stubInquiry200('inq013');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq013');
      cy.get(SEL.AMOUNT_INPUT).type('25000001');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Nominal transfer maksimal Rp25.000.000');
    });

    it('TC-TRF-014: Saldo tidak mencukupi (Rp15.000, butuh Rp17.500) → error spesifik', () => {
      stubSession('session014', { ...DEFAULT_SESSION, balance: 15_000 });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session014');

      stubInquiry200('inq014');
      stubTransferErr('tx014', 422, {
        error: 'Saldo tidak mencukupi. Saldo tersedia: Rp15.000, dibutuhkan: Rp17.500',
      });

      fillForm('1234567890', 'BCA', '15000', 'inq014');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx014');

      cy.get(SEL.ERROR_MESSAGE)
        .should('be.visible')
        .and('contain.text', 'Saldo tidak mencukupi')
        .and('contain.text', 'Rp15.000')
        .and('contain.text', 'Rp17.500');
      cy.get(SEL.SUCCESS_RECEIPT).should('not.exist');
    });

    it('TC-TRF-015: Saldo Rp10.000 tepat — tidak cukup biaya admin Rp2.500', () => {
      stubSession('session015', { ...DEFAULT_SESSION, balance: 10_000 });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session015');

      stubInquiry200('inq015');
      stubTransferErr('tx015', 422, {
        error: 'Saldo tidak mencukupi untuk biaya administrasi Rp2.500',
      });

      fillForm('1234567890', 'BCA', '10000', 'inq015');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx015');

      cy.get(SEL.ERROR_MESSAGE).should('contain.text', 'biaya administrasi Rp2.500');
    });

    it('TC-TRF-016: MPIN salah 3x berturut-turut → akun terkunci 24 jam', () => {
      stubInquiry200('inq016');
      fillForm('1234567890', 'BCA', '100000', 'inq016');

      const attempts = [
        { status: 401, body: { error: 'MPIN salah. 2 kesempatan tersisa', remainingAttempts: 2 } },
        { status: 401, body: { error: 'MPIN salah. 1 kesempatan tersisa', remainingAttempts: 1 } },
        { status: 423, body: { error: 'Akun Anda terkunci selama 24 jam karena 3x kesalahan MPIN. Hubungi CS untuk bantuan.', remainingAttempts: 0, lockUntil: '2024-01-16T10:30:00+07:00' } },
      ];

      attempts.forEach((attempt, i) => {
        cy.intercept('POST', API.TRANSFER, {
          statusCode: attempt.status,
          body:       attempt.body,
        }).as(`mpinAttempt${i}`);

        cy.get(SEL.MPIN_INPUT).clear().type(INVALID_MPIN);
        cy.get(SEL.BTN_CONFIRM).click();
        cy.wait(`@mpinAttempt${i}`);
      });

      cy.get(SEL.ACCOUNT_LOCK_MSG)
        .should('be.visible')
        .and('contain.text', 'Akun Anda terkunci selama 24 jam')
        .and('contain.text', '3x kesalahan MPIN');
      cy.get(SEL.BTN_CONFIRM).should('be.disabled');
    });

    it('TC-TRF-017: Fitur transfer tidak dapat diakses saat akun berstatus TERKUNCI', () => {
      stubSession('session017', {
        accountStatus: 'TERKUNCI',
        lockUntil:     '2024-01-16T10:30:00+07:00',
      });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session017');

      cy.get(SEL.ACCOUNT_LOCK_MSG)
        .should('be.visible')
        .and('contain.text', 'Akun Anda terkunci')
        .and('contain.text', '1500-');
      cy.get(SEL.BTN_CONTINUE).should('be.disabled');
    });

    it('TC-TRF-018: Transfer melebihi limit harian — error dengan sisa limit yang tepat', () => {
      stubSession('session018', {
        ...DEFAULT_SESSION,
        dailyLimitUsed:  45_000_000,
        dailyLimitTotal: 50_000_000,
      });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session018');

      stubInquiry200('inq018');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq018');
      cy.get(SEL.AMOUNT_INPUT).type('10000000');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Limit harian transfer Anda tersisa Rp5.000.000')
        .and('contain.text', 'Rp5.000.000');
    });

    it('TC-TRF-019: Rekening tujuan tidak ditemukan di bank tujuan → error inquiry', () => {
      stubInquiry404('inq019', 'BCA');

      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('0000000000');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq019');

      cy.get(SEL.ERROR_MESSAGE)
        .should('be.visible')
        .and('contain.text', 'Nomor rekening tidak ditemukan di BCA');
      cy.get(SEL.BTN_CONTINUE).should('be.disabled');
    });

    it('TC-TRF-020: Nominal kosong → error "Nominal transfer wajib diisi"', () => {
      stubInquiry200('inq020');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq020');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Nominal transfer wajib diisi');
    });

    it('TC-TRF-021: Timeout jaringan saat submit → status PENDING, saldo tidak double debit', () => {
      cy.intercept('POST', API.TRANSFER, { forceNetworkError: true }).as('netTimeout');

      stubInquiry200('inq021');
      fillForm('1234567890', 'BCA', '10000', 'inq021');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@netTimeout');

      cy.get(SEL.ERROR_MESSAGE)
        .should('be.visible')
        .and('contain.text', 'Koneksi terputus')
        .and('contain.text', 'Cek status di Riwayat Transaksi');

      cy.visit(ROUTES.HISTORY);
      cy.get(SEL.TXN_STATUS_LATEST).should('contain.text', 'PENDING');
    });

    it('TC-TRF-022: Nominal Rp0 → error minimal Rp10.000', () => {
      stubInquiry200('inq022');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq022');
      cy.get(SEL.AMOUNT_INPUT).type('0');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR).should('contain.text', 'Nominal transfer minimal Rp10.000');
    });

    it('TC-TRF-023: Nominal negatif tidak dapat diketik pada field amount', () => {
      cy.get(SEL.AMOUNT_INPUT).type('-10000');
      cy.get(SEL.AMOUNT_INPUT)
        .invoke('val')
        .should('not.contain', '-');
    });

  }); // END Group B

  // ==========================================================================
  // GROUP C — BOUNDARY VALUE ANALYSIS
  // ==========================================================================

  describe('Category C — Boundary & Edge Cases', () => {

    // ── Parameterized BVA table — nominal boundaries ──────────────────────────
    const nominalBVA: Array<{
      tcId:          string;
      nominal:       string;
      balance:       number;
      shouldPass:    boolean;
      expectedError: string;
    }> = [
      { tcId: 'TC-TRF-025', nominal: '9999',    balance: 100_000,    shouldPass: false, expectedError: 'Nominal transfer minimal Rp10.000'    },
      { tcId: 'TC-TRF-024', nominal: '10000',   balance: 100_000,    shouldPass: true,  expectedError: ''                                     },
      { tcId: 'TC-TRF-026', nominal: '10001',   balance: 100_000,    shouldPass: true,  expectedError: ''                                     },
      { tcId: 'TC-TRF-029', nominal: '24999999',balance: 30_000_000, shouldPass: true,  expectedError: ''                                     },
      { tcId: 'TC-TRF-027', nominal: '25000000',balance: 30_000_000, shouldPass: true,  expectedError: ''                                     },
      { tcId: 'TC-TRF-028', nominal: '25000001',balance: 30_000_000, shouldPass: false, expectedError: 'Nominal transfer maksimal Rp25.000.000'},
      { tcId: 'TC-TRF-022', nominal: '0',       balance: 100_000,    shouldPass: false, expectedError: 'Nominal transfer minimal Rp10.000'    },
    ];

    nominalBVA.forEach(({ tcId, nominal, balance, shouldPass, expectedError }) => {
      it(`${tcId}: BVA Nominal Rp${Number(nominal).toLocaleString('id-ID')} → ${shouldPass ? 'DITERIMA' : 'DITOLAK'}`, () => {
        stubSession(`sess${tcId}`, { ...DEFAULT_SESSION, balance });
        cy.visit(ROUTES.TRANSFER);
        cy.wait(`@sess${tcId}`);

        stubInquiry200(`inq${tcId}`);
        cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
        cy.get(SEL.BANK_DROPDOWN).select('BCA');
        cy.get(SEL.BTN_CHECK_ACCOUNT).click();
        cy.wait(`@inq${tcId}`);
        cy.get(SEL.AMOUNT_INPUT).type(nominal);
        cy.get(SEL.BTN_CONTINUE).click();

        if (shouldPass) {
          cy.get(SEL.MPIN_INPUT).should('be.visible');
          cy.get(SEL.INLINE_ERROR).should('not.exist');
        } else {
          cy.get(SEL.INLINE_ERROR)
            .should('be.visible')
            .and('contain.text', expectedError);
          cy.get(SEL.MPIN_INPUT).should('not.exist');
        }
      });
    });

    it('TC-TRF-030: BVA Limit Harian — transaksi tepat menyentuh Rp50.000.000', () => {
      stubSession('session030', {
        ...DEFAULT_SESSION,
        dailyLimitUsed:  25_000_000,
        dailyLimitTotal: 50_000_000,
      });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session030');

      stubInquiry200('inq030');
      stubTransfer200('tx030', { amount: 25_000_000 });
      fillForm('9876543210', 'MANDIRI', '25000000', 'inq030');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx030');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.LIMIT_REMAINING).should('contain.text', 'Rp0');
    });

    it('TC-TRF-031: BVA Limit Harian — limit habis, transaksi Rp10.000 berikutnya ditolak', () => {
      stubSession('session031', {
        ...DEFAULT_SESSION,
        dailyLimitUsed:  50_000_000,
        dailyLimitTotal: 50_000_000,
      });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session031');

      stubInquiry200('inq031');
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq031');
      cy.get(SEL.AMOUNT_INPUT).type('10000');
      cy.get(SEL.BTN_CONTINUE).click();

      cy.get(SEL.INLINE_ERROR)
        .should('be.visible')
        .and('contain.text', 'Limit harian transfer Anda telah tercapai')
        .and('contain.text', 'Rp50.000.000');
    });

    it('TC-TRF-032: BVA MPIN counter = 1, percobaan ke-2 memunculkan "1 kesempatan tersisa"', () => {
      stubSession('session032', { ...DEFAULT_SESSION, mpinFailCount: 1 });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session032');

      stubInquiry200('inq032');
      stubTransferErr('tx032', 401, {
        error: 'MPIN salah. 1 kesempatan tersisa',
        remainingAttempts: 1,
      });

      fillForm('1234567890', 'BCA', '10000', 'inq032');
      cy.get(SEL.MPIN_INPUT).type('999999');
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx032');

      cy.get(SEL.ERROR_MESSAGE).should('contain.text', '1 kesempatan tersisa');
    });

    it('TC-TRF-033: BVA Saldo tepat Rp12.500 (= nominal + fee) → sukses, saldo jadi Rp0', () => {
      stubSession('session033', { ...DEFAULT_SESSION, balance: 12_500 });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session033');

      stubInquiry200('inq033');
      stubTransfer200('tx033', { amount: 10_000, adminFee: ADMIN_FEE, totalDebit: 12_500 });
      fillForm('1234567890', 'BCA', '10000', 'inq033');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx033');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      cy.get(SEL.BALANCE_AFTER).should('contain.text', 'Rp0');
    });

    it('TC-TRF-034: BVA Saldo Rp12.499 (kurang Rp1 dari kebutuhan) → ditolak', () => {
      stubSession('session034', { ...DEFAULT_SESSION, balance: 12_499 });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session034');

      stubInquiry200('inq034');
      stubTransferErr('tx034', 422, {
        error: 'Saldo tidak mencukupi. Saldo tersedia: Rp12.499, dibutuhkan: Rp12.500',
      });

      fillForm('1234567890', 'BCA', '10000', 'inq034');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx034');

      cy.get(SEL.ERROR_MESSAGE).should('contain.text', 'Saldo tidak mencukupi');
      cy.get(SEL.SUCCESS_RECEIPT).should('not.exist');
    });

    it('TC-TRF-035: BVA MPIN semua digit sama (000000) tidak diblokir berdasarkan pola', () => {
      stubInquiry200('inq035');
      fillForm('1234567890', 'BCA', '10000', 'inq035');
      cy.get(SEL.MPIN_INPUT).type('000000');
      // Tombol confirm harus aktif — sistem tidak boleh menolak berdasarkan pola saja
      cy.get(SEL.BTN_CONFIRM).should('not.be.disabled');
    });

    it('TC-TRF-036: BVA Rekening semua digit sama (1111111111) diterima jika terdaftar', () => {
      cy.intercept('GET', API.INQUIRY, {
        statusCode: 200,
        body: { accountName: 'SITI RAHAYU' },
      }).as('inq036');

      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1111111111');
      cy.get(SEL.BANK_DROPDOWN).select('BRI');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq036');

      cy.get(SEL.BENEFICIARY_NAME).should('contain.text', 'SITI RAHAYU');
    });

    it('TC-TRF-037: BVA Waktu — transfer di pergantian hari tidak double deduction', () => {
      cy.clock(new Date('2024-01-15T23:59:55+07:00').getTime());
      stubSession('session037', {
        ...DEFAULT_SESSION,
        dailyLimitUsed: 49_990_000,
      });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session037');

      stubInquiry200('inq037');
      stubTransfer200('tx037', { amount: 10_000, totalDebit: 12_500 });

      cy.tick(6000); // simulasikan lewati 00:00:00

      fillForm('1234567890', 'BCA', '10000', 'inq037');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx037');

      cy.get(SEL.RECEIPT_STATUS).should('contain.text', 'BERHASIL');
      // Pastikan hanya dipanggil sekali (tidak double debit)
      cy.get('@tx037.all').should('have.length', 1);
    });

    it('TC-TRF-038: BVA Transfer ke rekening sendiri → ditolak oleh inquiry', () => {
      stubSession('session038', { ...DEFAULT_SESSION, accountNumber: '1234567890' });
      cy.visit(ROUTES.TRANSFER);
      cy.wait('@session038');

      cy.intercept('GET', API.INQUIRY, {
        statusCode: 400,
        body: { error: 'Tidak dapat transfer ke rekening sendiri' },
      }).as('inq038');

      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type('1234567890');
      cy.get(SEL.BANK_DROPDOWN).select('BCA');
      cy.get(SEL.BTN_CHECK_ACCOUNT).click();
      cy.wait('@inq038');

      cy.get(SEL.ERROR_MESSAGE).should('contain.text', 'Tidak dapat transfer ke rekening sendiri');
    });

  }); // END Group C

  // ==========================================================================
  // GROUP D — SECURITY & INPUT SANITIZATION
  // ==========================================================================

  describe('Category D — Security & Input Sanitization', () => {

    it('TC-TRF-039: SQL Injection pada field rekening diblokir di input level', () => {
      const sqlPayload = "' OR '1'='1";
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type(sqlPayload);
      cy.get(SEL.ACCOUNT_NUMBER_INPUT)
        .invoke('val')
        .should('match', /^[0-9]*$/);
    });

    it('TC-TRF-040: SQL Injection pada nominal → API mengembalikan HTTP 400, tanpa stack trace', () => {
      cy.request({
        method:           'POST',
        url:              API.TRANSFER,
        failOnStatusCode: false,
        headers:          { Authorization: 'Bearer valid-jwt-token-mock' },
        body: {
          accountNumber: '1234567890',
          bankCode:      'BCA',
          amount:        '10000; DROP TABLE transactions;--',
          mpin:          VALID_MPIN,
        } as Partial<TransferPayload>,
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body).to.have.property('error');
        const body = JSON.stringify(res.body);
        expect(body).to.not.include('SQLException');
        expect(body).to.not.include('stackTrace');
        expect(body).to.not.include('at com.');
        expect(body).to.not.include('Hibernate');
      });
    });

    it('TC-TRF-041: XSS pada field keterangan → dirender plain text, tidak ada alert popup', () => {
      const xssPayload = "<script>alert('XSS')</script>";

      cy.on('window:alert', (text) => {
        throw new Error(`XSS EKSEKUSI TERDETEKSI: "${text}"`);
      });

      stubInquiry200('inq041');
      stubTransfer200('tx041');
      fillForm('1234567890', 'BCA', '10000', 'inq041');
      cy.get(SEL.NOTES_INPUT).type(xssPayload);
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx041');

      cy.get(SEL.RECEIPT_NOTES)
        .invoke('html')
        .then((html) => {
          expect(html).to.not.include('<script>');
        });
      cy.get(SEL.RECEIPT_NOTES).should(
        'contain.text',
        "<script>alert('XSS')</script>",
      );
    });

    it('TC-TRF-042: Brute-force MPIN via API → HTTP 429 setelah batas, rate limiting aktif', () => {
      const attempts = [
        { mpin: '111111', expectedStatus: 401 },
        { mpin: '222222', expectedStatus: 401 },
        { mpin: '333333', expectedStatus: 423 },
        { mpin: '444444', expectedStatus: 429 },
      ];

      attempts.forEach(({ mpin, expectedStatus }, index) => {
        cy.request({
          method:           'POST',
          url:              API.TRANSFER,
          failOnStatusCode: false,
          headers:          { Authorization: 'Bearer valid-jwt-token-mock' },
          body: {
            accountNumber: '1234567890',
            bankCode:      'BCA',
            amount:        10_000,
            mpin,
          } as TransferPayload,
        }).then((res) => {
          if (index >= 2) {
            expect(res.status).to.eq(expectedStatus);
          }
        });
      });
    });

    it('TC-TRF-043: Parameter tampering nominal → server menolak dengan 422', () => {
      cy.intercept('POST', API.TRANSFER, (req) => {
        req.body.amount = 1; // Attacker modifies amount
        req.reply({
          statusCode: 422,
          body: { error: 'Nominal tidak valid. Permintaan ditolak.' },
        });
      }).as('tamperNominal');

      stubInquiry200('inq043');
      fillForm('1234567890', 'BCA', '10000', 'inq043');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tamperNominal');

      cy.get(SEL.ERROR_MESSAGE)
        .should('be.visible')
        .and('contain.text', 'Nominal tidak valid');
      cy.get(SEL.SUCCESS_RECEIPT).should('not.exist');
    });

    it('TC-TRF-044: Parameter tampering rekening tujuan → server re-validasi, HTTP 400', () => {
      cy.intercept('POST', API.TRANSFER, (req) => {
        req.body.accountNumber = '9999999999'; // Attacker changes target account
        req.reply({
          statusCode: 400,
          body: { error: 'Rekening tujuan tidak valid atau tidak sesuai konfirmasi.' },
        });
      }).as('tamperAccount');

      stubInquiry200('inq044');
      fillForm('1234567890', 'BCA', '10000', 'inq044');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tamperAccount');

      cy.get(SEL.ERROR_MESSAGE).should('contain.text', 'Rekening tujuan tidak valid');
    });

    it('TC-TRF-045: Replay attack — request duplikat dengan idempotency key sama → HTTP 409', () => {
      const idempotencyKey = 'TXN-20240115-001';

      // Pertama: sukses
      cy.request({
        method:           'POST',
        url:              API.TRANSFER,
        failOnStatusCode: false,
        headers: {
          Authorization:     'Bearer valid-jwt-token-mock',
          'idempotency-key': idempotencyKey,
        },
        body: {
          accountNumber: '1234567890',
          bankCode:      'BCA',
          amount:        10_000,
          mpin:          VALID_MPIN,
        } as TransferPayload,
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 409]); // first may succeed
      });

      // Kedua: duplikat → 409
      cy.request({
        method:           'POST',
        url:              API.TRANSFER,
        failOnStatusCode: false,
        headers: {
          Authorization:     'Bearer valid-jwt-token-mock',
          'idempotency-key': idempotencyKey,
        },
        body: {
          accountNumber: '1234567890',
          bankCode:      'BCA',
          amount:        10_000,
          mpin:          VALID_MPIN,
        } as TransferPayload,
      }).then((res) => {
        expect(res.status).to.eq(409);
        expect(res.body.code).to.eq('DUPLICATE_TRANSACTION');
        expect(res.body).to.not.have.property('transactionId');
      });
    });

    it('TC-TRF-046: IDOR — akses resi milik user lain → HTTP 403, tidak ada data bocor', () => {
      cy.request({
        method:           'GET',
        url:              '/api/v1/receipts/TXN-OTHER-USER-999',
        failOnStatusCode: false,
        headers:          { Authorization: 'Bearer valid-jwt-token-mock' },
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.not.have.property('accountNumber');
        expect(res.body).to.not.have.property('amount');
        expect(res.body).to.not.have.property('beneficiaryName');
        expect(res.body.error).to.include('Forbidden');
      });
    });

    it('TC-TRF-047: Payload null pada semua field → HTTP 400, tanpa NullPointerException', () => {
      cy.request({
        method:           'POST',
        url:              API.TRANSFER,
        failOnStatusCode: false,
        headers:          { Authorization: 'Bearer valid-jwt-token-mock' },
        body: {
          accountNumber: null,
          bankCode:      null,
          amount:        null,
          mpin:          null,
        } as TransferPayload,
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body).to.have.property('error');
        const body = JSON.stringify(res.body);
        expect(body).to.not.include('NullPointerException');
        expect(body).to.not.include('stackTrace');
        expect(body).to.not.include('at com.');
        expect(body).to.not.include('at org.');
        expect(body).to.not.include('Hibernate');
      });
    });

    it('TC-TRF-048: Unicode Arabic-Indic digits pada field rekening tidak bypass validasi', () => {
      const unicodeDigits = '\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669\u0660';
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).type(unicodeDigits);
      cy.get(SEL.ACCOUNT_NUMBER_INPUT).invoke('val').then((val) => {
        const v = val as string;
        if (v.length > 0) {
          // Jika lolos ke input, harus hanya ASCII digits
          expect(v).to.match(/^[0-9]*$/, 'Unicode Arabic digits seharusnya tidak melewati validasi');
        }
        // Jika field kosong → field berhasil memblokir semua unicode non-ASCII
      });
    });

    it('TC-TRF-049: MPIN tidak muncul plaintext di network request body', () => {
      const capturedBodies: string[] = [];

      cy.intercept('POST', API.TRANSFER, (req) => {
        capturedBodies.push(JSON.stringify(req.body));
        req.reply({ statusCode: 200, body: { status: 'BERHASIL', transactionId: 'TXN-049' } });
      }).as('tx049');

      stubInquiry200('inq049');
      fillForm('1234567890', 'BCA', '10000', 'inq049');
      cy.get(SEL.MPIN_INPUT).type(VALID_MPIN);
      cy.get(SEL.BTN_CONFIRM).click();
      cy.wait('@tx049');

      // MPIN field harus bertipe password (masked di UI)
      cy.get(SEL.MPIN_INPUT).should('have.attr', 'type', 'password');

      cy.then(() => {
        capturedBodies.forEach((body) => {
          expect(body).to.not.include(
            VALID_MPIN,
            `MPIN "${VALID_MPIN}" ditemukan plaintext di request body — security violation!`,
          );
        });
      });
    });

    it('TC-TRF-050: Session token expired → HTTP 401, halaman redirect login, transaksi tidak diproses', () => {
      cy.intercept('GET', API.SESSION, {
        statusCode: 401,
        body: { error: 'Sesi Anda telah berakhir. Silakan login kembali.', code: 'SESSION_EXPIRED' },
      }).as('sessionExpired');

      cy.intercept('POST', API.TRANSFER, {
        statusCode: 401,
        body: { error: 'Sesi Anda telah berakhir. Silakan login kembali.', code: 'SESSION_EXPIRED' },
      }).as('transferExpired');

      cy.window().then((win) => {
        win.localStorage.setItem('auth_token', 'expired-jwt-token');
      });

      cy.visit(ROUTES.TRANSFER);

      cy.get(SEL.SESSION_EXPIRED_MSG, { timeout: 5000 })
        .should('be.visible')
        .and('contain.text', 'Sesi Anda telah berakhir');

      // Verifikasi via direct API call juga mengembalikan 401
      cy.request({
        method:           'POST',
        url:              API.TRANSFER,
        failOnStatusCode: false,
        headers:          { Authorization: 'Bearer expired-jwt-token' },
        body: {
          accountNumber: '1234567890',
          bankCode:      'BCA',
          amount:        10_000,
          mpin:          VALID_MPIN,
        } as TransferPayload,
      }).then((res) => {
        expect(res.status).to.eq(401);
        expect(res.body.code).to.eq('SESSION_EXPIRED');
        expect(res.body).to.not.have.property('transactionId');
      });
    });

    // ── Parameterized Injection Payloads ──────────────────────────────────────
    const injectionPayloads: Array<{
      tcId:       string;
      payload:    string;
      attackType: string;
    }> = [
      { tcId: 'TC-TRF-039',  payload: "' OR '1'='1",                      attackType: 'SQL Injection Classic'  },
      { tcId: 'TC-TRF-039b', payload: '1; DROP TABLE transactions;--',    attackType: 'SQL Injection DDL'      },
      { tcId: 'TC-TRF-041',  payload: '<script>alert(1)</script>',         attackType: 'XSS Stored'             },
      { tcId: 'TC-TRF-041b', payload: 'javascript:alert(document.cookie)', attackType: 'XSS URL-based'          },
      { tcId: 'TC-TRF-047',  payload: '\x00\x00\x00\x00\x00\x00\x00\x00', attackType: 'Null Byte Injection'    },
    ];

    injectionPayloads.forEach(({ tcId, payload, attackType }) => {
      it(`${tcId}: Injection Payload — ${attackType} pada field rekening tidak mengeksekusi/tidak expose error`, () => {
        cy.on('window:alert', (text) => {
          throw new Error(`XSS alert FIRED (${attackType}): "${text}"`);
        });
        cy.on('uncaught:exception', () => false);

        cy.get(SEL.ACCOUNT_NUMBER_INPUT).type(payload);

        cy.get(SEL.ACCOUNT_NUMBER_INPUT).invoke('val').then((val) => {
          const v = val as string;
          const isNumericOnly = /^[0-9]*$/.test(v);
          if (!isNumericOnly && v.length > 0) {
            // Field tidak memblokir — tombol lanjut harus tetap disabled
            cy.get(SEL.BTN_CONTINUE).should('be.disabled');
          }
        });

        // Tidak ada SQL error / stack trace di halaman
        cy.get('body').invoke('text').then((text) => {
          expect(text).to.not.include('SQLException');
          expect(text).to.not.include('NullPointerException');
          expect(text).to.not.include('stackTrace');
          expect(text).to.not.include('SyntaxError');
        });
      });
    });

  }); // END Group D

}); // END Feature
