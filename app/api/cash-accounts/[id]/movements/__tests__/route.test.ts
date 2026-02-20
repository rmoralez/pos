/**
 * @jest-environment node
 */

import { POST } from '../route'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/db'

jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    cashAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    cashAccountMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

describe('POST /api/cash-accounts/[id]/movements', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'ADMIN' as const,
  }

  const mockParams = { params: { id: 'account-1' } }

  function makeRequest(body: Record<string, unknown>): any {
    return new Request('http://localhost/api/cash-accounts/account-1/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
  }

  /**
   * Build a $transaction mock that runs the callback with a configurable account balance.
   */
  function mockTransaction(accountBalance: number, movementResult?: Record<string, unknown>) {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = {
        cashAccount: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'account-1',
            tenantId: 'tenant-1',
            currentBalance: { toString: () => String(accountBalance) },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        cashAccountMovement: {
          create: jest.fn().mockResolvedValue(
            movementResult ?? { id: 'movement-1', type: 'PAID', amount: '100' }
          ),
        },
      }
      return callback(mockTx)
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

      const response = await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when user has no tenantId', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1', tenantId: null })

      const response = await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)

      expect(response.status).toBe(401)
    })
  })

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------
  describe('Input Validation', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should return 400 when type is missing', async () => {
      const response = await POST(makeRequest({ amount: 100, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Faltan campos requeridos')
    })

    it('should return 400 when amount is missing', async () => {
      const response = await POST(makeRequest({ type: 'PAID', concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Faltan campos requeridos')
    })

    it('should return 400 when concept is missing', async () => {
      const response = await POST(makeRequest({ type: 'PAID', amount: 100 }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Faltan campos requeridos')
    })

    it('should return 400 for invalid type (not PAID or RECEIVED)', async () => {
      const response = await POST(makeRequest({ type: 'TRANSFER', amount: 100, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Tipo de movimiento inválido')
    })

    it('should reject amount of zero', async () => {
      mockTransaction(500)

      const response = await POST(makeRequest({ type: 'PAID', amount: 0, concept: 'test' }), mockParams)
      const data = await response.json()

      // amount: 0 is falsy — triggers the "missing fields" check (line 27: !amount) before the Decimal guard
      expect(response.status).toBe(400)
      expect(data.error).toBe('Faltan campos requeridos')
    })

    it('should reject negative amount', async () => {
      mockTransaction(500)

      const response = await POST(makeRequest({ type: 'PAID', amount: -50, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('El monto debe ser mayor a 0')
    })
  })

  // -----------------------------------------------------------------------
  // PAID movement (debit — decreases balance)
  // -----------------------------------------------------------------------
  describe('PAID movement', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should create PAID movement and return 201', async () => {
      mockTransaction(1000, { id: 'mv-1', type: 'PAID', amount: '200' })

      const response = await POST(makeRequest({ type: 'PAID', amount: 200, concept: 'Pago proveedor' }), mockParams)

      expect(response.status).toBe(201)
    })

    it('should fail when account has insufficient balance for PAID', async () => {
      mockTransaction(50) // only 50 available

      const response = await POST(makeRequest({ type: 'PAID', amount: 200, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Saldo insuficiente en la cuenta')
    })

    it('should allow PAID exactly equal to balance (edge case)', async () => {
      mockTransaction(200)

      const response = await POST(makeRequest({ type: 'PAID', amount: 200, concept: 'Pago exacto' }), mockParams)

      expect(response.status).toBe(201)
    })

    it('should fail when account does not exist', async () => {
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue(null), // account not found
            update: jest.fn(),
          },
          cashAccountMovement: { create: jest.fn() },
        }
        return callback(mockTx)
      })

      const response = await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Cuenta no encontrada')
    })

    it('should pass movementTypeId to movement creation', async () => {
      let capturedCreate: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '1000' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'PAID', amount: '100' }),
          },
        }
        capturedCreate = mockTx.cashAccountMovement.create
        return callback(mockTx)
      })

      await POST(
        makeRequest({ type: 'PAID', amount: 100, concept: 'Pago', movementTypeId: 'mt-proveedores' }),
        mockParams
      )

      expect(capturedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ movementTypeId: 'mt-proveedores' }),
        })
      )
    })

    it('should set movementTypeId to null when not provided', async () => {
      let capturedCreate: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '1000' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'PAID', amount: '100' }),
          },
        }
        capturedCreate = mockTx.cashAccountMovement.create
        return callback(mockTx)
      })

      await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)

      expect(capturedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ movementTypeId: null }),
        })
      )
    })
  })

  // -----------------------------------------------------------------------
  // RECEIVED movement (credit — increases balance)
  // -----------------------------------------------------------------------
  describe('RECEIVED movement', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should create RECEIVED movement and return 201', async () => {
      mockTransaction(500, { id: 'mv-1', type: 'RECEIVED', amount: '300' })

      const response = await POST(makeRequest({ type: 'RECEIVED', amount: 300, concept: 'Cobro cliente' }), mockParams)

      expect(response.status).toBe(201)
    })

    it('should allow RECEIVED even when account balance is zero', async () => {
      mockTransaction(0, { id: 'mv-1', type: 'RECEIVED', amount: '100' })

      const response = await POST(makeRequest({ type: 'RECEIVED', amount: 100, concept: 'Cobro' }), mockParams)

      expect(response.status).toBe(201)
    })

    it('should update account balance after RECEIVED', async () => {
      let capturedUpdate: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '200' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'RECEIVED', amount: '300' }),
          },
        }
        capturedUpdate = mockTx.cashAccount.update
        return callback(mockTx)
      })

      await POST(makeRequest({ type: 'RECEIVED', amount: 300, concept: 'test' }), mockParams)

      // balanceBefore=200, amount=300 → balanceAfter=500
      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'account-1' },
          data: expect.objectContaining({ currentBalance: expect.anything() }),
        })
      )
      const callArg = capturedUpdate!.mock.calls[0][0]
      expect(String(callArg.data.currentBalance)).toBe('500')
    })
  })

  // -----------------------------------------------------------------------
  // Multi-tenant isolation
  // -----------------------------------------------------------------------
  describe('Multi-Tenant Isolation', () => {
    it('should scope account lookup by tenantId', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      let capturedAccountFind: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '1000' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
          },
        }
        capturedAccountFind = mockTx.cashAccount.findFirst
        return callback(mockTx)
      })

      await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)

      expect(capturedAccountFind).toHaveBeenCalledWith({
        where: { id: 'account-1', tenantId: 'tenant-1' },
      })
    })

    it('should create movement with correct tenantId and userId', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      let capturedCreate: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '1000' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
          },
        }
        capturedCreate = mockTx.cashAccountMovement.create
        return callback(mockTx)
      })

      await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)

      expect(capturedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            userId: 'user-1',
            cashAccountId: 'account-1',
          }),
        })
      )
    })

    it('should not access account from different tenant', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue(null), // not found (different tenant)
            update: jest.fn(),
          },
          cashAccountMovement: { create: jest.fn() },
        }
        return callback(mockTx)
      })

      const response = await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Cuenta no encontrada')
    })
  })

  // -----------------------------------------------------------------------
  // Balance snapshot accuracy
  // -----------------------------------------------------------------------
  describe('Balance Snapshots', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    })

    it('should record balanceBefore and balanceAfter on PAID movement', async () => {
      let capturedCreate: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '800' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
          },
        }
        capturedCreate = mockTx.cashAccountMovement.create
        return callback(mockTx)
      })

      await POST(makeRequest({ type: 'PAID', amount: 300, concept: 'test' }), mockParams)

      expect(capturedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balanceBefore: expect.anything(),
            balanceAfter: expect.anything(),
          }),
        })
      )
      const createArg = capturedCreate!.mock.calls[0][0]
      expect(String(createArg.data.balanceBefore)).toBe('800')
      expect(String(createArg.data.balanceAfter)).toBe('500')
    })

    it('should record balanceBefore and balanceAfter on RECEIVED movement', async () => {
      let capturedCreate: jest.Mock | undefined
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              currentBalance: { toString: () => '200' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
          },
        }
        capturedCreate = mockTx.cashAccountMovement.create
        return callback(mockTx)
      })

      await POST(makeRequest({ type: 'RECEIVED', amount: 400, concept: 'test' }), mockParams)

      expect(capturedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balanceBefore: expect.anything(),
            balanceAfter: expect.anything(),
          }),
        })
      )
      const createArg = capturedCreate!.mock.calls[0][0]
      expect(String(createArg.data.balanceBefore)).toBe('200')
      expect(String(createArg.data.balanceAfter)).toBe('600')
    })
  })

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('Error Handling', () => {
    it('should return 500 when transaction throws unexpected error', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('DB connection error'))

      const response = await POST(makeRequest({ type: 'PAID', amount: 100, concept: 'test' }), mockParams)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DB connection error')
    })
  })
})
