# E2E Testing

Run end-to-end tests using Playwright to validate the entire application from the browser.

## Test Coverage

The e2e test suite covers:
- **Authentication**: Registration, login, logout, session management, protected routes
- **Product Management**: CRUD operations, validation, search, stock display
- **Point of Sale**: Product search, cart management, payment processing, stock updates
- **Multi-Tenant Isolation**: Data segregation between tenants

## Steps to Execute

1. **Ensure Development Server is Running**
   - The tests will auto-start the dev server if not running
   - Or manually start: `npm run dev`

2. **Run All E2E Tests**
   ```bash
   npm run test:e2e
   ```

3. **Run Specific Test Suites**
   - Authentication tests: `npm run test:e2e:auth`
   - Product tests: `npm run test:e2e:products`
   - POS/Sales tests: `npm run test:e2e:pos`

4. **Interactive UI Mode** (recommended for development)
   ```bash
   npm run test:e2e:ui
   ```
   - Visual test runner
   - Watch mode
   - Time travel debugging

5. **Debug Mode**
   ```bash
   npm run test:e2e:debug
   ```
   - Step through tests
   - Pause on failures
   - Inspect browser state

6. **Headed Mode** (see browser while testing)
   ```bash
   npm run test:e2e:headed
   ```

7. **View Test Report**
   ```bash
   npm run test:e2e:report
   ```

## Output Format

```
Running 45 tests using 1 worker

  ✓ [chromium] › auth/authentication.spec.ts:7:5 › Authentication › User Registration › should successfully register (5s)
  ✓ [chromium] › auth/authentication.spec.ts:35:5 › Authentication › User Login › should successfully login (3s)
  ✓ [chromium] › products/product-management.spec.ts:12:5 › Product Management › Create Product › should create product (4s)
  ...

  45 passed (2m 30s)

To view the HTML report run: npm run test:e2e:report
```

## Environment Variables

Optional configuration:
- `E2E_USE_EXISTING_USER=true` - Reuse existing test user instead of creating new ones
- `E2E_TEST_EMAIL` - Email for existing test user
- `E2E_TEST_PASSWORD` - Password for existing test user
- `PLAYWRIGHT_BASE_URL` - Base URL for testing (default: http://localhost:3000)

## Test Files Structure

```
e2e/
├── auth/
│   ├── auth.setup.ts          # Authentication setup
│   └── authentication.spec.ts  # Auth tests (20 tests)
├── products/
│   └── product-management.spec.ts  # Product CRUD (25 tests)
├── pos/
│   ├── pos-sales.spec.ts      # POS and sales (45 tests)
│   └── multi-tenant-isolation.spec.ts  # Tenant isolation (15 tests)
└── utils/
    └── test-helpers.ts         # Shared utilities
```

## Summary

- **Total Tests**: 105+
- **Test Suites**: 4
- **Estimated Runtime**: 2-5 minutes
- **Browser**: Chromium (can be configured for Firefox/WebKit)

**Note:** E2E tests require a running database. Ensure your database is set up and migrations are applied before running tests.
