/**
 * @jest-environment node
 */

import { GET } from '../route'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/db'

jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    sale: { findMany: jest.fn() },
    cashTransaction: { findMany: jest.fn() },
    pettyCashMovement: { findMany: jest.fn() },
    cashAccountMovement: { findMany: jest.fn() },
  },
}))

function createRequest(queryString = ''): Request {
  return new Request(`http://localhost/api/reports/profit-loss${queryString}`)
}

describe('GET /api/reports/profit-loss', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'ADMIN' as const,
  }

  // Helpers to build minimal Prisma-shaped records
  const makeSale = (payments: { method: string; amount: number }[], items: { quantity: number; costPrice: number | null }[] = []) => ({
    payments: payments.map(p => ({ method: p.method, amount: String(p.amount) })),
    items: items.map(i => ({ quantity: i.quantity, costPrice: i.costPrice !== null ? String(i.costPrice) : null })),
  })

  const makeCashTx = (amount: number, movementTypeId: string | null, movementTypeName: string | null) => ({
    amount: String(amount),
    movementTypeId,
    movementType: movementTypeName ? { name: movementTypeName } : null,
  })

  const makePettyCash = (amount: number, movementTypeId: string | null, movementTypeName: string | null) => ({
    amount: String(amount),
    movementTypeId,
    movementType: movementTypeName ? { name: movementTypeName } : null,
  })

  const makeCashAccount = (amount: number, movementTypeId: string | null, movementTypeName: string | null) => ({
    amount: String(amount),
    movementTypeId,
    movementType: movementTypeName ? { name: movementTypeName } : null,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.pettyCashMovement.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.cashAccountMovement.findMany as jest.Mock).mockResolvedValue([])
  })

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should proceed when user is authenticated', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      const response = await GET(createRequest())
      expect(response.status).toBe(200)
    })
  })

  // -----------------------------------------------------------------------
  // Revenue calculation
  // -----------------------------------------------------------------------
  describe('Revenue Calculation', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should return zero revenue when no sales', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.revenue.gross).toBe(0)
      expect(data.revenue.byPaymentMethod).toEqual({})
    })

    it('should sum revenue from all payments across sales', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale([{ method: 'CASH', amount: 100 }, { method: 'DEBIT_CARD', amount: 50 }]),
        makeSale([{ method: 'CASH', amount: 200 }]),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.revenue.gross).toBe(350)
      expect(data.revenue.byPaymentMethod.CASH).toBe(300)
      expect(data.revenue.byPaymentMethod.DEBIT_CARD).toBe(50)
    })

    it('should accumulate same payment method from multiple sales', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale([{ method: 'CREDIT_CARD', amount: 120 }]),
        makeSale([{ method: 'CREDIT_CARD', amount: 80 }]),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.revenue.byPaymentMethod.CREDIT_CARD).toBe(200)
    })

    it('should scope sales query by tenantId', async () => {
      const response = await GET(createRequest('?from=2026-01-01&to=2026-01-31'))
      await response.json()

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1', status: 'COMPLETED' }),
        })
      )
    })
  })

  // -----------------------------------------------------------------------
  // COGS calculation
  // -----------------------------------------------------------------------
  describe('COGS Calculation', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should return zero COGS when no sales', async () => {
      const response = await GET(createRequest())
      const data = await response.json()
      expect(data.cogs).toBe(0)
    })

    it('should calculate COGS as costPrice * quantity for each item', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale(
          [{ method: 'CASH', amount: 300 }],
          [
            { quantity: 2, costPrice: 50 },  // 100
            { quantity: 1, costPrice: 30 },  // 30
          ]
        ),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.cogs).toBe(130)
    })

    it('should skip items with null costPrice', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale(
          [{ method: 'CASH', amount: 200 }],
          [
            { quantity: 2, costPrice: 40 },  // 80
            { quantity: 1, costPrice: null }, // skipped
          ]
        ),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.cogs).toBe(80)
    })

    it('should sum COGS across multiple sales', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale([{ method: 'CASH', amount: 100 }], [{ quantity: 1, costPrice: 60 }]),
        makeSale([{ method: 'CASH', amount: 200 }], [{ quantity: 3, costPrice: 20 }]),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.cogs).toBe(120) // 60 + 60
    })
  })

  // -----------------------------------------------------------------------
  // Gross profit calculation
  // -----------------------------------------------------------------------
  describe('Gross Profit Calculation', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should calculate grossProfit as revenue - COGS', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale(
          [{ method: 'CASH', amount: 500 }],
          [{ quantity: 2, costPrice: 100 }]
        ),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.grossProfit).toBe(300) // 500 - 200
    })

    it('should calculate gross margin percentage correctly', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale(
          [{ method: 'CASH', amount: 1000 }],
          [{ quantity: 1, costPrice: 400 }]
        ),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.grossMargin).toBeCloseTo(60, 5) // 60%
    })

    it('should return 0 grossMargin when revenue is zero', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.grossMargin).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Expense aggregation — three sources
  // -----------------------------------------------------------------------
  describe('Expense Aggregation', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should return zero expenses when no expense records', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.total).toBe(0)
      expect(data.expenses.byCategory).toHaveLength(0)
    })

    it('should aggregate expenses from CashTransaction source', async () => {
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(200, 'mt-1', 'Sueldos'),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.total).toBe(200)
      expect(data.expenses.byCategory).toHaveLength(1)
      expect(data.expenses.byCategory[0]).toMatchObject({
        categoryName: 'Sueldos',
        amount: 200,
        sources: ['Caja'],
      })
    })

    it('should aggregate expenses from PettyCashMovement source', async () => {
      ;(prisma.pettyCashMovement.findMany as jest.Mock).mockResolvedValue([
        makePettyCash(150, 'mt-2', 'Proveedores'),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.total).toBe(150)
      expect(data.expenses.byCategory[0]).toMatchObject({
        categoryName: 'Proveedores',
        amount: 150,
        sources: ['Caja Chica'],
      })
    })

    it('should aggregate expenses from CashAccountMovement source', async () => {
      ;(prisma.cashAccountMovement.findMany as jest.Mock).mockResolvedValue([
        makeCashAccount(300, 'mt-3', 'Servicios'),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.total).toBe(300)
      expect(data.expenses.byCategory[0]).toMatchObject({
        categoryName: 'Servicios',
        amount: 300,
        sources: ['Cuentas'],
      })
    })

    it('should merge expenses with same movementTypeId across sources', async () => {
      const sharedTypeId = 'mt-shared'
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(100, sharedTypeId, 'Sueldos'),
      ])
      ;(prisma.pettyCashMovement.findMany as jest.Mock).mockResolvedValue([
        makePettyCash(50, sharedTypeId, 'Sueldos'),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.total).toBe(150)
      expect(data.expenses.byCategory).toHaveLength(1)
      expect(data.expenses.byCategory[0].amount).toBe(150)
      expect(data.expenses.byCategory[0].sources).toContain('Caja')
      expect(data.expenses.byCategory[0].sources).toContain('Caja Chica')
    })

    it('should keep separate categories for different movementTypeIds', async () => {
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(100, 'mt-1', 'Sueldos'),
      ])
      ;(prisma.pettyCashMovement.findMany as jest.Mock).mockResolvedValue([
        makePettyCash(200, 'mt-2', 'Proveedores'),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.total).toBe(300)
      expect(data.expenses.byCategory).toHaveLength(2)
    })

    it('should group null movementTypeId as "Sin categoría"', async () => {
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(75, null, null),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.byCategory[0].categoryName).toBe('Sin categoría')
      expect(data.expenses.byCategory[0].categoryId).toBeNull()
    })

    it('should merge multiple null-category expenses into one group', async () => {
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(50, null, null),
      ])
      ;(prisma.pettyCashMovement.findMany as jest.Mock).mockResolvedValue([
        makePettyCash(30, null, null),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses.byCategory).toHaveLength(1)
      expect(data.expenses.byCategory[0].amount).toBe(80)
    })

    it('should scope cashTransaction query via cashRegister tenantId', async () => {
      await GET(createRequest('?from=2026-01-01&to=2026-01-31'))

      expect(prisma.cashTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cashRegister: { tenantId: 'tenant-1' },
            movementType: { transactionType: 'EXPENSE' },
          }),
        })
      )
    })

    it('should scope pettyCashMovement by tenantId and type EXPENSE', async () => {
      await GET(createRequest('?from=2026-01-01&to=2026-01-31'))

      expect(prisma.pettyCashMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            type: 'EXPENSE',
          }),
        })
      )
    })

    it('should scope cashAccountMovement by tenantId and type PAID', async () => {
      await GET(createRequest('?from=2026-01-01&to=2026-01-31'))

      expect(prisma.cashAccountMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            type: 'PAID',
          }),
        })
      )
    })
  })

  // -----------------------------------------------------------------------
  // Net profit calculation
  // -----------------------------------------------------------------------
  describe('Net Profit Calculation', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should calculate netProfit as grossProfit - expenses', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale(
          [{ method: 'CASH', amount: 1000 }],
          [{ quantity: 1, costPrice: 400 }]
        ),
      ])
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(200, 'mt-1', 'Sueldos'),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      // grossProfit = 1000 - 400 = 600
      // netProfit   = 600  - 200 = 400
      expect(data.netProfit).toBe(400)
    })

    it('should return negative netProfit when expenses exceed gross profit', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale([{ method: 'CASH', amount: 100 }], [{ quantity: 1, costPrice: 50 }]),
      ])
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(200, null, null),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      // grossProfit = 50, expenses = 200 → netProfit = -150
      expect(data.netProfit).toBe(-150)
    })

    it('should calculate netMargin as netProfit / revenue * 100', async () => {
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue([
        makeSale([{ method: 'CASH', amount: 1000 }], [{ quantity: 1, costPrice: 0 }]),
      ])
      ;(prisma.cashTransaction.findMany as jest.Mock).mockResolvedValue([
        makeCashTx(100, null, null),
      ])

      const response = await GET(createRequest())
      const data = await response.json()

      // netProfit = 1000 - 0 - 100 = 900; netMargin = 90%
      expect(data.netMargin).toBeCloseTo(90, 5)
    })

    it('should return 0 netMargin when revenue is zero', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.netMargin).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Date range filtering
  // -----------------------------------------------------------------------
  describe('Date Range Filtering', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should pass explicit date range to all queries', async () => {
      await GET(createRequest('?from=2026-01-01&to=2026-01-31'))

      const expectedRange = {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T23:59:59.999Z'),
      }

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: expectedRange }),
        })
      )
      expect(prisma.cashTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: expectedRange }),
        })
      )
      expect(prisma.pettyCashMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: expectedRange }),
        })
      )
      expect(prisma.cashAccountMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: expectedRange }),
        })
      )
    })

    it('should return the period in the response', async () => {
      const response = await GET(createRequest('?from=2026-01-01&to=2026-01-31'))
      const data = await response.json()

      expect(data.period).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    })

    it('should use default current-month range when no params provided', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      // Just verify period keys are present and non-empty
      expect(data.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(data.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  // -----------------------------------------------------------------------
  // Response shape
  // -----------------------------------------------------------------------
  describe('Response Shape', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should include all required top-level keys', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data).toHaveProperty('period')
      expect(data).toHaveProperty('revenue')
      expect(data).toHaveProperty('cogs')
      expect(data).toHaveProperty('grossProfit')
      expect(data).toHaveProperty('grossMargin')
      expect(data).toHaveProperty('expenses')
      expect(data).toHaveProperty('netProfit')
      expect(data).toHaveProperty('netMargin')
    })

    it('should include revenue.byPaymentMethod sub-object', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.revenue).toHaveProperty('gross')
      expect(data.revenue).toHaveProperty('byPaymentMethod')
    })

    it('should include expenses.total and expenses.byCategory array', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(data.expenses).toHaveProperty('total')
      expect(data.expenses).toHaveProperty('byCategory')
      expect(Array.isArray(data.expenses.byCategory)).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('Error Handling', () => {
    it('should return 500 when database throws', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.sale.findMany as jest.Mock).mockRejectedValue(new Error('DB error'))

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})
