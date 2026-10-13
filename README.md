# spec2test — Mobile Banking Transfer Dana

Automation test suite dihasilkan oleh **Spec2Test Master** dari spesifikasi fitur _Transfer Dana Antar Rekening Mobile Banking_.

## Stack

| Layer | Pilihan |
|-------|---------|
| Test runner | [Cypress 13](https://docs.cypress.io) |
| Language | TypeScript 5 |
| Viewport | 390 × 844 px (iPhone 14 Pro) |
| API mocking | `cy.intercept()` + `cy.request()` |

## Struktur Folder

```
spec2test/
├── cypress/
│   ├── e2e/
│   │   └── transfer-dana/
│   │       └── transfer-dana.cy.ts   ← 50 test cases
│   └── support/
│       ├── commands.ts               ← custom commands
│       └── e2e.ts                    ← global support file
├── cypress.config.ts
├── tsconfig.json
└── package.json
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Buka Cypress Test Runner (interactive)
npm run cy:open

# 3. Jalankan semua test headless
npm run cy:run

# 4. Jalankan hanya spec transfer dana
npm run cy:run:transfer

# 5. Type-check tanpa run
npm run typecheck
```

## Coverage Matrix

| Kategori | Test Cases | Teknik |
|----------|-----------|--------|
| **A — Positive** | TC-TRF-001 s/d TC-TRF-007 | Happy path, resi, notifikasi |
| **B — Negative** | TC-TRF-008 s/d TC-TRF-023 | Validasi input, lockout, saldo, timeout |
| **C — Boundary** | TC-TRF-024 s/d TC-TRF-038 | BVA nominal, limit, saldo, waktu |
| **D — Security** | TC-TRF-039 s/d TC-TRF-050 | SQLi, XSS, brute-force, IDOR, replay, session |
| **Total** | **50** | EP, BVA, Decision Table, Fault Injection |

## data-cy Attributes yang Dibutuhkan

Test suite menggunakan `data-cy` selector. Pastikan aplikasi mengimplementasikan atribut berikut pada elemen yang relevan:

```
account-number-input     bank-dropdown            amount-input
notes-input              mpin-input               btn-check-account
btn-continue             btn-confirm              beneficiary-name
error-message            inline-error             success-receipt
receipt-status           receipt-amount           receipt-admin-fee
receipt-total-debit      receipt-transaction-id   receipt-timestamp
receipt-sender-name      receipt-sender-account   receipt-beneficiary-name
receipt-beneficiary-account  receipt-bank-destination  receipt-notes
balance-after-transfer   account-lock-message     session-expired-modal
login-redirect-message   push-notification-toast  daily-limit-remaining
txn-status-latest
```

## Environment Variables

| Variable | Default | Keterangan |
|----------|---------|------------|
| `CYPRESS_BASE_URL` | `http://localhost:3000` | Override via env untuk staging/prod |
| `API_BASE_URL` | `http://localhost:8080` | Base URL backend API |

Override saat run:
```bash
CYPRESS_BASE_URL=https://staging.mybank.com npm run cy:run:transfer
```
