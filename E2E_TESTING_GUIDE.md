# E2E Testing Guide - SuperCommerce POS

Comprehensive guide for running and writing end-to-end tests for the POS system.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses **Playwright** for end-to-end testing. The test suite validates the entire application from the browser, ensuring all features work together correctly.

### Test Statistics

- **Total Tests**: 105+
- **Test Files**: 4
- **Coverage Areas**: 4 major features
- **Average Runtime**: 2-5 minutes
- **Browser**: Chromium (configurable for Firefox/WebKit)

## Setup

### Prerequisites

1. Node.js 18+ installed
2. Database running (PostgreSQL)
3. Environment variables configured in `.env`

### Installation

```bash
# Install dependencies (already done if you ran npm install)
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Environment Setup

Create a `.env` file with test database credentials:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/pos_test"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Test Suites

```bash
# Authentication tests only
npm run test:e2e:auth

# Product management tests only
npm run test:e2e:products

# POS and sales tests only
npm run test:e2e:pos
```

### Interactive UI Mode (Recommended for Development)

```bash
npm run test:e2e:ui
```

Features:
- Visual test runner with timeline
- Watch mode - tests re-run on file changes
- Time travel debugging
- Network activity inspector
- Screenshots and videos

### Debug Mode

```bash
npm run test:e2e:debug
```

Features:
- Step through each test action
- Pause execution at any point
- Inspect DOM and browser state
- Use browser DevTools

### Headed Mode

```bash
npm run test:e2e:headed
```

Watch tests execute in a real browser window.

### View Test Reports

```bash
npm run test:e2e:report
```

Opens an HTML report with:
- Test results and timings
- Screenshots of failures
- Video recordings
- Trace viewer for failed tests

## Test Coverage

### 1. Authentication (20 tests)

**File**: `e2e/auth/authentication.spec.ts`

- User registration with tenant creation
- Login/logout flows
- Session persistence
- Password validation
- Email uniqueness validation
- CUIT uniqueness validation
- Protected route access control

**Key Scenarios**:
- ✅ New user registration creates tenant and location
- ✅ Duplicate email/CUIT rejected
- ✅ Password requirements enforced
- ✅ Session persists across page refreshes
- ✅ Unauthenticated users redirected to login

### 2. Product Management (25 tests)

**File**: `e2e/products/product-management.spec.ts`

- Create, read, update, delete products
- SKU uniqueness per tenant
- Price validation (decimal precision)
- Tax rate validation
- Stock management
- Product search (name, SKU, barcode)
- Active/inactive status

**Key Scenarios**:
- ✅ Product creation with validation
- ✅ SKU must be unique within tenant
- ✅ Decimal prices handled correctly
- ✅ Search by name, SKU, or barcode
- ✅ Stock displayed with badges
- ✅ Soft delete (isActive flag)

### 3. Point of Sale & Sales (45 tests)

**File**: `e2e/pos/pos-sales.spec.ts`

- Product search in POS
- Shopping cart management
- Quantity adjustments
- Price calculations (subtotal, tax, total)
- Payment processing (cash, card, transfer)
- Stock validation
- Stock updates after sale
- Sales history

**Key Scenarios**:
- ✅ Search only shows active products
- ✅ Cart calculates totals correctly
- ✅ Cannot add out-of-stock products
- ✅ Cannot exceed available stock
- ✅ Payment methods: Cash, Credit, Debit, Transfer
- ✅ Change calculated for cash payments
- ✅ Stock decremented after successful sale
- ✅ Sales appear in history

### 4. Multi-Tenant Isolation (15 tests)

**File**: `e2e/pos/multi-tenant-isolation.spec.ts`

- Product isolation between tenants
- Sales isolation between tenants
- POS search isolation
- SKU uniqueness per tenant

**Key Scenarios**:
- ✅ Tenant A cannot see Tenant B's products
- ✅ Tenant A cannot see Tenant B's sales
- ✅ POS search only returns current tenant's products
- ✅ Same SKU can exist in different tenants

## Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Feature Name', () => {
  test.describe('Sub-Feature', () => {
    test('should do something specific', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Arrange - Set up test data
      const productData = generateTestData.product();

      // Act - Perform actions
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.clickButton('Guardar Producto');

      // Assert - Verify results
      await actions.waitForToast('Producto creado exitosamente');
      await assertions.assertProductInList(productData.name);
    });
  });
});
```

### Helper Functions

#### Generate Test Data

```typescript
// Generate unique email
const email = generateTestData.email('prefix');

// Generate unique CUIT
const cuit = generateTestData.cuit();

// Generate product data
const product = generateTestData.product({
  name: 'Custom Name',
  salePrice: '1000',
});

// Generate user data
const user = generateTestData.user();

// Generate tenant data
const tenant = generateTestData.tenant();
```

#### Page Actions

```typescript
const actions = new PageActions(page);

// Fill form fields
await actions.fillField('Label', 'value');

// Click buttons
await actions.clickButton('Button Text');

// Navigate
await actions.goto('/path');
await actions.waitForNavigation('/expected-path');

// Search
await actions.search('Placeholder', 'query');

// Wait for toast
await actions.waitForToast('Success message');
```

#### Assertions

```typescript
const assertions = new Assertions(page);

// Page assertions
await assertions.assertOnLoginPage();
await assertions.assertOnDashboard();

// Message assertions
await assertions.assertErrorMessage('Error text');
await assertions.assertSuccessMessage('Success text');

// Product assertions
await assertions.assertProductInList('Product Name');
await assertions.assertProductNotInList('Product Name');

// Cart assertions
await assertions.assertCartItemCount(3);
await assertions.assertTotal('1.234,56');
```

### Multi-Tenant Testing Pattern

```typescript
test('tenant isolation test', async ({ browser }) => {
  const contexts = {
    tenantA: null as any,
    tenantB: null as any,
  };

  try {
    // Create isolated contexts
    contexts.tenantA = await browser.newContext();
    contexts.tenantB = await browser.newContext();

    const pageA = await contexts.tenantA.newPage();
    const pageB = await contexts.tenantB.newPage();

    // Register different tenants
    // Perform actions
    // Verify isolation

  } finally {
    // Always cleanup
    if (contexts.tenantA) await contexts.tenantA.close();
    if (contexts.tenantB) await contexts.tenantB.close();
  }
});
```

## Best Practices

### 1. Test Isolation

- Each test should be independent
- Don't rely on test execution order
- Clean up test data after tests
- Use unique identifiers (timestamps, random values)

### 2. Selectors

```typescript
// ✅ Good - Semantic selectors
page.getByRole('button', { name: 'Guardar' })
page.getByLabel('Email')
page.getByText('Producto creado')

// ❌ Avoid - Brittle selectors
page.locator('#submit-btn')
page.locator('.css-class-xyz')
```

### 3. Waiting

```typescript
// ✅ Good - Auto-waiting with assertions
await expect(page.getByText('Success')).toBeVisible();

// ✅ Good - Wait for specific condition
await page.waitForURL('**/dashboard');
await actions.waitForToast('Saved');

// ❌ Avoid - Arbitrary timeouts
await page.waitForTimeout(3000);
```

### 4. Test Data

```typescript
// ✅ Good - Unique test data
const product = generateTestData.product();

// ❌ Avoid - Hardcoded data
const product = { sku: 'PROD-001', ... };
```

### 5. Assertions

```typescript
// ✅ Good - Specific assertions
await expect(page.getByText('Producto creado exitosamente')).toBeVisible();

// ❌ Avoid - Vague assertions
await expect(page.locator('div')).toBeTruthy();
```

## Configuration

### Playwright Config

File: `playwright.config.ts`

Key settings:
- `baseURL`: http://localhost:3000
- `workers`: 1 (sequential execution to avoid conflicts)
- `retries`: 2 on CI, 0 locally
- `reporter`: HTML + List + JSON
- `webServer`: Auto-starts dev server

### Browser Configuration

```typescript
// Current: Chromium only
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
]

// To add Firefox/WebKit, uncomment in playwright.config.ts
```

### Authentication State

Tests use persistent authentication:
- Setup runs once: `e2e/auth/auth.setup.ts`
- Creates test user and tenant
- Saves auth state to `.auth/user.json`
- All other tests reuse this session

## Troubleshooting

### Tests Failing: "Not authenticated"

**Solution**: Delete `.auth/user.json` and re-run tests
```bash
rm -rf .auth
npm run test:e2e
```

### Tests Failing: "Database connection error"

**Solution**: Ensure database is running and migrations applied
```bash
npm run db:push
npm run db:seed
```

### Tests Timing Out

**Solution**: Increase timeout in specific test
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### Browser Not Launching

**Solution**: Reinstall Playwright browsers
```bash
npx playwright install --force chromium
```

### Port Already in Use

**Solution**: Kill process on port 3000
```bash
lsof -ti:3000 | xargs kill -9
```

### View Trace for Failed Test

```bash
npm run test:e2e:report
# Click on failed test → View trace
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run db:push
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Performance Tips

### 1. Run Tests in Parallel (with caution)

```typescript
// In playwright.config.ts
workers: process.env.CI ? 2 : 1,
```

Note: Our tests modify database, so parallel execution may cause conflicts.

### 2. Run Specific Tests During Development

```bash
# Run single file
npx playwright test e2e/products/product-management.spec.ts

# Run single test
npx playwright test -g "should create product"
```

### 3. Use UI Mode for Debugging

```bash
npm run test:e2e:ui
```

Faster iteration cycle with watch mode.

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Debugging Guide](https://playwright.dev/docs/debug)

## Support

For issues or questions:
1. Check this guide
2. Review test examples in `e2e/` directory
3. Check Playwright docs
4. Run tests in debug mode to investigate
