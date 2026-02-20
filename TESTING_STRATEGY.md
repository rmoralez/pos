# Testing Strategy for SuperCommerce POS

This document outlines the comprehensive testing approach for the SuperCommerce POS system, following a Test-Driven Development (TDD) methodology.

## Testing Philosophy

We follow a **unit-first, then E2E** approach:
1. **Unit Tests First**: Test business logic in isolation
2. **E2E Tests Second**: Validate user workflows and integration

## Test Pyramid

```
        /\
       /  \      E2E Tests (Playwright)
      /----\     Integration Tests (fewer)
     /------\    Unit Tests (many)
    /________\
```

## 1. Unit Testing Strategy

### When to Write Unit Tests
Write unit tests for **EVERY** API route handler that contains business logic:
- ✅ Before implementing a new API endpoint
- ✅ Before modifying existing business logic
- ✅ When fixing bugs (write failing test first)

### Unit Test Structure

**Location**: `app/api/[feature]/__tests__/route.test.ts`

**Template**:
```typescript
/**
 * @jest-environment node
 */

import { GET, POST, PUT, DELETE } from '../route';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    // Mock all Prisma methods used
    model: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Feature API - [METHOD] /api/feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Cases', () => {
    it('should handle valid request correctly', async () => {
      // Arrange: Setup mocks
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      // Act: Call API handler
      const response = await GET(request);
      const data = await response.json();

      // Assert: Verify results
      expect(response.status).toBe(200);
      expect(data).toMatchObject({ /* expected */ });
    });
  });

  describe('Error Cases', () => {
    it('should return 401 when unauthenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return data for current tenant', async () => {
      // Test tenant isolation
    });
  });
});
```

### What to Test (Checklist)

For EACH API endpoint, ensure tests cover:

#### ✅ Happy Path
- [ ] Valid request with correct data
- [ ] Correct response status (200, 201, 204)
- [ ] Correct response shape/data
- [ ] Database changes are correct

#### ✅ Authentication & Authorization
- [ ] Returns 401 when not authenticated
- [ ] Returns 403 when lacking permissions
- [ ] Validates user's role/tenant

#### ✅ Multi-Tenant Isolation
- [ ] Can only access own tenant's data
- [ ] Cannot access other tenant's data
- [ ] Creates records with correct tenantId
- [ ] Filters queries by tenantId

#### ✅ Input Validation
- [ ] Returns 400 for invalid JSON
- [ ] Returns 400 for missing required fields
- [ ] Returns 400 for invalid data types
- [ ] Returns 400 for invalid IDs/references

#### ✅ Business Logic
- [ ] Calculations are correct (taxes, totals, etc.)
- [ ] State transitions work correctly
- [ ] Side effects occur (stock updates, movements, etc.)
- [ ] Idempotency where required

#### ✅ Error Handling
- [ ] Database errors return 500 with error message
- [ ] Transaction rollback on error
- [ ] Proper error messages for user
- [ ] Logging occurs for debugging

#### ✅ Edge Cases
- [ ] Empty results handled correctly
- [ ] Large datasets handled correctly
- [ ] Concurrent requests handled correctly
- [ ] Boundary conditions (min/max values)

## 2. E2E Testing Strategy

### When to Write E2E Tests
Write E2E tests for **complete user workflows**:
- ✅ After unit tests pass
- ✅ For critical business paths
- ✅ For multi-step processes
- ✅ For UI interactions

### E2E Test Structure

**Location**: `e2e/[feature]/[feature-name].spec.ts`

**What to Test**:
- Complete user workflows (register → login → create product → sell)
- UI interactions and feedback
- Navigation flows
- Form validations
- Toast/error messages
- Multi-tenant isolation at UI level
- Real database transactions

**Example**:
```typescript
test('complete sales flow', async ({ page }) => {
  // 1. Login
  await actions.login(testUser);

  // 2. Open cash register
  await actions.openCashRegister();

  // 3. Create sale
  await actions.goToPOS();
  await actions.searchProduct('Test Product');
  await actions.addToCart();
  await actions.checkout();

  // 4. Verify sale
  await expect(page.getByText('Venta completada')).toBeVisible();
});
```

## 3. Testing Workflow for Changes

### For New Features

```bash
# 1. Write unit tests first (TDD)
npm test -- app/api/[feature]/__tests__/route.test.ts --watch

# 2. Implement feature until tests pass
# ... coding ...

# 3. Write E2E tests
npm run test:e2e:ui

# 4. Run all tests
npm test                    # All unit tests
npm run test:e2e           # All E2E tests
```

### For Bug Fixes

```bash
# 1. Write failing unit test reproducing the bug
npm test -- app/api/[feature]/__tests__/route.test.ts

# 2. Fix the bug

# 3. Verify test passes
npm test -- app/api/[feature]/__tests__/route.test.ts

# 4. Write E2E test if needed
npm run test:e2e
```

### For Refactoring

```bash
# 1. Ensure existing tests pass
npm test
npm run test:e2e

# 2. Refactor code

# 3. Ensure tests still pass
npm test
npm run test:e2e
```

## 4. Test Coverage Goals

### Unit Test Coverage
- **Target**: 80% code coverage minimum
- **Critical paths**: 100% coverage (auth, payments, multi-tenant)

### E2E Test Coverage
- **Target**: All critical user workflows
- **Critical paths**:
  - User registration and login
  - Product management (CRUD)
  - POS sales flow
  - Cash register operations
  - Stock management
  - Multi-tenant isolation

## 5. Current Coverage Status

### Unit Tests ❌ INCOMPLETE
```
✅ Sales API        [10/19 tests passing]
❌ Products API     [0 tests]
❌ Categories API   [0 tests]
❌ Cash Registers   [0 tests]
❌ Stock API        [0 tests]
❌ Customers API    [0 tests]
❌ Users API        [0 tests]
❌ Locations API    [0 tests]
❌ Tenants API      [0 tests]
❌ Auth/Register    [0 tests]
```

### E2E Tests ✅ COMPREHENSIVE
```
✅ Authentication   [passing]
✅ Products        [passing]
✅ POS/Sales       [1 test flaky - toast timing]
✅ Cash Register   [passing]
✅ Stock           [passing]
✅ Customers       [passing]
✅ Settings        [passing]
✅ Multi-tenant    [3/4 passing]
```

## 6. Testing Commands

### Run All Tests
```bash
npm test                          # All unit tests
npm test -- --coverage           # With coverage report
npm run test:e2e                 # All E2E tests
```

### Run Specific Tests
```bash
# Unit tests for specific route
npm test -- app/api/products/__tests__/route.test.ts

# E2E tests for specific feature
npm run test:e2e -- e2e/products/product-management.spec.ts

# Watch mode for TDD
npm test -- --watch

# Debug mode
npm run test:e2e:debug
```

### Run Tests by Type
```bash
npm run test:e2e:auth          # Authentication tests
npm run test:e2e:products      # Product tests
npm run test:e2e:pos           # POS tests
```

## 7. CI/CD Integration

### Pre-commit Hook
```bash
# Run on every commit
npm test                    # Fast unit tests

# Optional: Run linting
npm run lint
```

### Pre-push Hook
```bash
# Run before push
npm test                    # All unit tests
npm run test:e2e:auth      # Critical E2E tests
```

### CI Pipeline
```bash
# On pull request
1. npm test -- --coverage
2. npm run test:e2e
3. Generate coverage report
4. Block merge if < 80% coverage
```

## 8. Test Data Management

### Unit Tests
- Use mock data in tests
- Create factory functions for common objects
- Keep tests isolated (no shared state)

### E2E Tests
- Use unique identifiers per test run (timestamps)
- Clean up test data after tests
- Use separate test database
- Seed minimal required data

## 9. Best Practices

### DO ✅
- Write tests before code (TDD)
- Keep tests simple and focused
- Use descriptive test names
- Test one thing per test
- Mock external dependencies
- Test error cases thoroughly
- Test multi-tenant isolation
- Run tests before committing

### DON'T ❌
- Don't test implementation details
- Don't share state between tests
- Don't skip failing tests
- Don't write tests after code
- Don't test framework code
- Don't ignore flaky tests
- Don't commit untested code

## 10. Next Steps - Priority Action Items

### Immediate (This Week)
1. ✅ Create unit tests for Products API
2. ✅ Create unit tests for Cash Registers API
3. ✅ Create unit tests for Stock API
4. ⚠️  Fix flaky POS sales test (toast timing)

### Short Term (Next 2 Weeks)
5. ✅ Create unit tests for Customers API
6. ✅ Create unit tests for Users API
7. ✅ Create unit tests for Locations API
8. ✅ Add coverage reporting to CI

### Long Term (Next Month)
9. ✅ Achieve 80% unit test coverage
10. ✅ Document all test patterns
11. ✅ Create test data factories
12. ✅ Set up automated test reporting

## 11. Resources

### Documentation
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

### Examples
- `/app/api/sales/__tests__/route.test.ts` - Complete unit test example
- `/e2e/products/product-management.spec.ts` - E2E test example

### Test Utilities
- `/e2e/utils/test-helpers.ts` - Reusable E2E helpers
- `/e2e/auth/auth.setup.ts` - Authentication setup

---

**Remember**: Good tests are an investment, not a cost. They:
- Catch bugs early
- Enable confident refactoring
- Document expected behavior
- Improve code quality
- Reduce debugging time
- Ensure multi-tenant isolation

**Test-first mindset**: Write the test that fails, then write the code that makes it pass.
