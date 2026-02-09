---
name: test-all
description: Complete test coverage - runs all tests with detailed reports
---

# Complete Test Suite

Run comprehensive test coverage across all test types.

## Steps to Execute

### 1. Unit & Integration Tests with Coverage
```bash
npm run test:coverage
```
- Runs all unit tests
- Generates coverage report
- Target: 80%+ coverage

### 2. E2E Tests - All User Flows
```bash
npm run test:e2e
```

Test all user journeys:
- **Professional flows:** Booking creation, reservations, profile
- **Locatario flows:** Locations, rooms, schedules, bookings
- **Admin flows:** User management, configuration
- **Payment flows:** Mercado Pago, invoicing

### 3. Generate Reports

Create comprehensive reports:
- HTML coverage report
- Test results summary
- Failed test details

Save to: `test-results/full-coverage-report.html`

## Output Format

```
📊 COMPLETE TEST SUITE
======================

Unit Tests:
  Total: 48 tests
  Passed: 48
  Failed: 0
  Coverage: 84.23%

E2E Tests:
  Professional flows: ✅ 9/9
  Locatario flows: ✅ 12/12
  Admin flows: ✅ 7/7
  Payment flows: ✅ 5/5

Total: ✅ 33/33 E2E tests passed

Time: 12m 18s

Reports generated:
  - test-results/full-coverage-report.html
  - test-results/test-summary.md

✅ ALL TESTS PASSED
```

## Coverage Goals

- Unit test coverage: 80%+
- E2E coverage: All critical user flows
- API routes: 100% of endpoints tested

**Use this before:**
- Merging pull requests
- Major releases
- Weekly regression testing
