# SuperCommerce POS System - Codebase Exploration Report

## 1. FULL DIRECTORY STRUCTURE

### Top-Level Structure
```
/Users/rodri/development2/pos/
├── app/                          # Next.js app directory
│   ├── (auth)/                   # Auth routes (login, register)
│   ├── (dashboard)/              # Dashboard routes
│   └── api/                       # API routes
├── components/                   # React components
├── lib/                          # Utility functions and configurations
├── e2e/                          # End-to-end tests (Playwright)
├── hooks/                        # Custom React hooks
├── prisma/                       # Database schema and migrations
├── types/                        # TypeScript type definitions
├── public/                       # Static assets
├── .claude/                      # Claude config
├── .auth/                        # Auth related files
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Jest setup
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies
├── playwright.config.ts          # E2E test configuration
└── middleware.ts                 # Next.js middleware
```

### Key API Routes Structure
```
app/api/
├── auth/                         # Authentication endpoints
│   ├── [...nextauth]/route.ts
│   └── register/route.ts
├── cash-accounts/                # Cash account management
│   ├── route.ts (GET, POST)
│   ├── [id]/route.ts (GET, PATCH)
│   └── [id]/movements/route.ts (POST)
├── cash-registers/               # Cash register management
│   ├── route.ts
│   ├── current/route.ts
│   └── [id]/close/route.ts
├── customers/                    # Customer management
│   ├── route.ts (GET, POST)
│   ├── [id]/route.ts
│   ├── [id]/account/route.ts
│   ├── [id]/account/payments/route.ts
│   └── [id]/account/movements/route.ts
├── products/                     # Product management
│   ├── route.ts (GET, POST)
│   ├── [id]/route.ts
│   └── [id]/alternative-codes/route.ts
├── sales/                        # Sales endpoints
│   └── route.ts (GET, POST)
├── stock/                        # Stock management
├── petty-cash/                   # Petty cash operations
├── movement-types/               # Movement type management
├── reports/                      # Reporting
│   └── profit-loss/route.ts
├── categories/                   # Product categories
├── locations/                    # Location management
├── tenants/                      # Multi-tenant support
└── users/                        # User management
```

### Components Structure
```
components/
├── ui/                           # UI components (Radix UI based)
│   ├── alert.tsx
│   ├── checkbox.tsx
│   ├── tabs.tsx
│   └── textarea.tsx
├── pos/                          # POS related components
│   └── payment-dialog.tsx
├── cash-register/                # Cash register components
├── dashboard/                    # Dashboard components
├── products/                     # Product components
└── settings/                     # Settings components
```

### Lib Structure
```
lib/
├── __tests__/                    # Unit tests
│   └── pricing.test.ts
├── db.ts                         # Prisma client singleton
├── session.ts                    # Session/auth utilities
├── auth.ts                       # NextAuth configuration
├── pricing.ts                    # Pricing utilities
├── utils.ts                      # General utilities
└── middleware/                   # Middleware utilities
```

## 2. PACKAGE.JSON CONTENTS

### Test Scripts
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:debug": "playwright test --debug",
  "test:e2e:auth": "playwright test e2e/auth",
  "test:e2e:products": "playwright test e2e/products",
  "test:e2e:pos": "playwright test e2e/pos",
  "test:e2e:report": "playwright show-report"
}
```

### Jest Config Details
- testEnvironment: `jest-environment-jsdom`
- setupFilesAfterEnv: `jest.setup.js`
- Module name mapper: `@/*` maps to root directory
- Test path ignore patterns: `/node_modules/`, `/.next/`, `/e2e/`
- Coverage includes: `app/**`, `components/**`, `lib/**`

### Key Dependencies
- **Framework**: Next.js 14.2.15, React 18.3.1
- **Database**: @prisma/client 5.20.0
- **Auth**: next-auth 4.24.10
- **UI**: Radix UI components, tailwindcss 3.4.1
- **Validation**: zod 3.23.8
- **Testing**: jest 29.7.0, @testing-library/react 16.0.1, @playwright/test 1.58.2
- **Real-time**: pusher 5.2.0, pusher-js 8.4.0-rc2

## 3. EXISTING TEST FILES

### Unit Tests (6 files)
```
/Users/rodri/development2/pos/app/api/customers/__tests__/route.test.ts
/Users/rodri/development2/pos/app/api/products/__tests__/route.test.ts
/Users/rodri/development2/pos/app/api/sales/__tests__/route.test.ts
/Users/rodri/development2/pos/app/api/cash-registers/__tests__/route.test.ts
/Users/rodri/development2/pos/app/api/users/__tests__/route.test.ts
/Users/rodri/development2/pos/app/api/stock/__tests__/route.test.ts
/Users/rodri/development2/pos/lib/__tests__/pricing.test.ts
```

### E2E Tests (17 files)
```
/Users/rodri/development2/pos/e2e/auth/authentication.spec.ts
/Users/rodri/development2/pos/e2e/cash-register/cash-register.spec.ts
/Users/rodri/development2/pos/e2e/customers/customers-management.spec.ts
/Users/rodri/development2/pos/e2e/navigation/basic-navigation.spec.ts
/Users/rodri/development2/pos/e2e/pos/keyboard-shortcuts.spec.ts
/Users/rodri/development2/pos/e2e/pos/multi-tenant-isolation.spec.ts
/Users/rodri/development2/pos/e2e/pos/pos-sales.spec.ts
/Users/rodri/development2/pos/e2e/pos/purchase-flow.spec.ts
/Users/rodri/development2/pos/e2e/products/product-management.spec.ts
/Users/rodri/development2/pos/e2e/settings/movement-types.spec.ts
/Users/rodri/development2/pos/e2e/settings/settings-management.spec.ts
/Users/rodri/development2/pos/e2e/stock/stock-management.spec.ts
```

## 4. TEST CONFIGURATION FILES

### jest.config.js
```javascript
const nextJest = require('next/jest')
const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

### jest.setup.js
```javascript
import '@testing-library/jest-dom'
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## 5. KEY API FILES CONTENTS

### /api/reports/profit-loss/route.ts (265 lines)
**Purpose**: Calculate profit/loss reports for date ranges

**Key Features**:
- GET endpoint with optional date parameters (from, to)
- Default date range: current month
- Calculates revenue from completed sales by payment method
- Calculates COGS (Cost of Goods Sold) from item costPrice snapshots
- Aggregates expenses from 3 sources:
  1. CashTransaction (from cash register)
  2. PettyCashMovement (from petty cash)
  3. CashAccountMovement (from accounts)
- Groups expenses by movementTypeId and categoryName
- Returns: period, revenue (gross + by method), COGS, gross profit/margin, expenses (total + by category), net profit/margin
- Multi-tenant scoped via tenantId

**Authentication**: Requires getCurrentUser()

### /api/petty-cash/route.ts (205 lines)
**Purpose**: Manage petty cash fund operations

**GET Endpoint**:
- Returns active petty cash fund with recent movements (last 20)
- Auto-creates a default fund if none exists
- Includes: movements, users, cash accounts, movement types

**POST Endpoint** - Create Movement:
- Supported types: INCOME, EXPENSE, TRANSFER_OUT, TRANSFER_IN
- Uses prisma.$transaction for atomic balance updates
- Validates amount > 0
- Updates fund balance
- TRANSFER_OUT: credits a cash account with CashAccountMovement
- TRANSFER_IN: debits a cash account with CashAccountMovement
- Returns created movement with balance before/after

### /api/cash-accounts/[id]/route.ts (77 lines)
**Purpose**: Get and update cash accounts

**GET Endpoint**:
- Returns account detail with movement history (last 50)
- Includes supplier info and movement types
- 404 if account not found or unauthorized

**PATCH Endpoint**:
- Updates account: name, description, isActive status
- Partial updates supported
- Uses conditional spread operators for optional fields

### /api/cash-accounts/[id]/movements/route.ts (92 lines)
**Purpose**: Create manual movements on cash accounts

**POST Endpoint**:
- Types: PAID (debit) or RECEIVED (credit)
- Validates required fields: type, amount, concept
- Uses prisma.$transaction for atomic updates
- Validates: amount > 0, sufficient balance for PAID movements
- Records balance before/after
- Returns 400 on validation errors, 500 on db errors

### /api/sales/route.ts (first 100 lines shown)
**Purpose**: Sales management endpoints

**GET Endpoint**:
- Parameters: limit (default 50), cashRegisterId (optional)
- Returns sales with items, payments, user info, customer
- Scoped to tenant and optionally location/cashRegister
- Ordered by createdAt descending

**POST Endpoint** (continues beyond 100 lines):
- Creates a sale with items and payment method
- Validates location exists
- Checks for open cash register
- Uses Zod for input validation
- Decrements stock for each item
- Creates stockMovement records

## 6. DATABASE CLIENT EXPORT

### lib/db.ts
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Pattern**: Singleton pattern with hot-reload support for development

## 7. SESSION/AUTH IMPLEMENTATION

### lib/session.ts
```typescript
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  return user
}
```

### lib/auth.ts (97 lines)
**NextAuth Configuration**:
- Strategy: JWT (not compatible with PrismaAdapter for credentials provider)
- Session maxAge: 30 days
- Sign-in page: /login

**CredentialsProvider**:
- Email and password validation
- Queries: user with tenant and location includes
- Validates: user exists, password valid, user active, tenant active
- Returns: id, email, name, role, tenantId, tenantName, locationId, locationName

**JWT Callback**:
- Adds role, tenantId, tenantName, locationId, locationName to token

**Session Callback**:
- Populates session.user with token values
- Used throughout the app for authorization checks

## 8. TEST SETUP PATTERNS

### Common Testing Patterns Found

#### 1. **Module Mocking Pattern** (All API tests)
```typescript
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    cashRegister: { findFirst: jest.fn() },
    location: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    stock: { findFirst: jest.fn(), update: jest.fn() },
    sale: { findFirst: jest.fn(), create: jest.fn() },
    stockMovement: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
```

#### 2. **Jest Environment Declaration** (API tests)
```typescript
/**
 * @jest-environment node
 */
```
Used in API route tests to use Node environment instead of jsdom

#### 3. **Mock Data Fixtures Pattern**
Each test suite defines:
- mockUser (authenticated user with tenantId, locationId, role)
- mockCashRegister (with status, balances)
- mockProduct (with prices, stock info)
- mockStock (with quantities, location binding)
- mockCustomer objects
- validSaleData (typical request payload)

Example structure:
```typescript
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  tenantId: 'tenant-123',
  locationId: 'location-123',
  name: 'Test User',
  role: 'ADMIN' as const,
};
```

#### 4. **Test Organization by Feature**
```typescript
describe('Sales API - POST /api/sales', () => {
  describe('Successful Payment Processing', () => {
    it('should create a sale successfully...', () => {})
    it('should calculate sale totals correctly...', () => {})
    it('should update stock quantities...', () => {})
  })

  describe('Cash Register Validation', () => {
    it('should return 400 when no cash register is open', () => {})
  })

  describe('Stock Validation', () => {
    it('should return 400 when product has insufficient stock', () => {})
  })

  describe('Multi-Tenant Isolation', () => {
    it('should only access products from current tenant', () => {})
  })

  describe('Input Validation', () => {
    it('should return 400 for invalid JSON', () => {})
  })

  describe('Transaction Handling', () => {
    it('should rollback transaction on error', () => {})
  })
})
```

#### 5. **Request/Response Testing Pattern**
```typescript
const request = new Request('http://localhost/api/sales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(validSaleData),
});

const response = await POST(request);
const data = await response.json();

expect(response.status).toBe(201);
expect(data).toEqual(mockSale);
```

#### 6. **Transaction Mocking Pattern**
```typescript
(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
  const mockTx = {
    sale: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockSale),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue(mockProduct),
    },
    stock: {
      findFirst: jest.fn().mockResolvedValue(mockStock),
      update: jest.fn().mockResolvedValue({ ...mockStock, quantity: 8 }),
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return callback(mockTx);
});
```

#### 7. **Unit Test Pattern** (pricing.test.ts)
```typescript
describe('pricing utilities', () => {
  describe('calculateMargin', () => {
    it('should calculate margin correctly for standard prices', () => {
      expect(calculateMargin(100, 150)).toBe(50)
    })

    it('should return 0 for zero or negative cost price', () => {
      expect(calculateMargin(0, 100)).toBe(0)
    })

    it('should handle negative margins', () => {
      expect(calculateMargin(100, 80)).toBe(-20)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateMargin(100, 133.33)).toBe(33.33)
    })
  })
})
```

### Test Coverage Statistics
- **Unit Tests**: 7 test files covering APIs and utilities
- **E2E Tests**: 12 Playwright test files covering user workflows
- **Coverage Focus**: 
  - API authentication and authorization
  - Data validation
  - Multi-tenant isolation
  - Transaction handling
  - Stock management
  - Financial calculations

### Key Testing Dependencies
- **jest**: ^29.7.0 (testing framework)
- **@testing-library/react**: ^16.0.1 (React testing utilities)
- **@testing-library/jest-dom**: ^6.6.3 (jest-dom matchers)
- **@playwright/test**: ^1.58.2 (E2E testing)
- **jest-environment-jsdom**: ^29.7.0 (browser-like environment)

