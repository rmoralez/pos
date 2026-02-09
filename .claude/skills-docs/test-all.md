# Complete Test Suite

**COMPREHENSIVE COVERAGE**: Runs all tests with detailed coverage reports.

## Description

Executes the complete test suite including unit tests, integration tests, and E2E tests for all user roles. Generates detailed coverage reports.

## When to Use

- Before merging pull requests
- After major feature development
- Weekly for regression testing
- Before production releases

## What It Does

### 1. Unit & Integration Tests
```bash
npm run test:coverage
```
- Runs all 48+ unit tests
- Generates coverage report
- Target: 80%+ coverage
- Reports uncovered code

### 2. E2E Tests - Professional User Flows
- Login/Logout
- Search locations and rooms
- Create single booking ✅ (tested)
- Create recurring bookings
- View my reservations
- Cancel bookings
- Update profile

### 3. E2E Tests - Locatario User Flows
- Manage locations (CRUD)
- Manage rooms (CRUD)
- Set room schedules
- Configure pricing
- View booking calendar
- Generate reports

### 4. E2E Tests - Admin User Flows
- User management
- Role assignment
- System configuration
- View all bookings
- Financial reports

### 5. E2E Tests - Payment & Billing
- Mercado Pago integration
- Payment processing
- Invoice generation
- Payment history
- AFIP electronic invoicing

### 6. API Endpoint Tests
- All API routes tested
- Error handling verified
- Validation logic checked
- Database transactions tested

---

## Output

Generates comprehensive reports:

### Coverage Report
```
File                     | % Stmts | % Branch | % Funcs | % Lines
-------------------------|---------|----------|---------|--------
All files                |   84.23 |    76.45 |   88.92 |   85.17
 src/lib                 |   92.31 |    85.71 |   95.00 |   93.12
  utils.ts               |   95.45 |    90.00 |  100.00 |   96.77
  db.ts                  |   88.89 |    80.00 |   90.00 |   89.47
 src/app/api/bookings    |   78.26 |    68.42 |   81.25 |   79.41
  route.ts               |   78.26 |    68.42 |   81.25 |   79.41
```

### E2E Test Summary
```
✅ Professional Flows: 9/9 passed
✅ Locatario Flows: 12/12 passed
✅ Admin Flows: 7/7 passed
✅ Payment Flows: 5/5 passed

Total: 33/33 tests passed in 8m 42s
```

### Test Report
Saved to: `test-results/full-coverage-report.html`

---

## Commands Run

```bash
# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Generate HTML report
npx nyc report --reporter=html
```

---

## Expected Runtime

- Unit tests: ~15-30 seconds
- E2E tests: ~8-12 minutes
- Total: ~10-15 minutes

**Tip**: Run in parallel where possible to reduce time.
