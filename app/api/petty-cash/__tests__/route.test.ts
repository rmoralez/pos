/**
 * @jest-environment node
 */

import { GET, POST } from '../route'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/db'

jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    pettyCashFund: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pettyCashMovement: {
      create: jest.fn(),
    },
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

describe('Petty Cash API', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'ADMIN' as const,
  }

  const mockFund = {
    id: 'fund-1',
    tenantId: 'tenant-1',
    name: 'Caja Chica',
    currentBalance: '500',
    isActive: true,
    movements: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // GET /api/petty-cash
  // -----------------------------------------------------------------------
  describe('GET /api/petty-cash', () => {
    function makeGetRequest(): any {
      const req = new Request('http://localhost/api/petty-cash') as any
      req.nextUrl = { searchParams: new URLSearchParams() }
      return req
    }

    describe('Authentication', () => {
      it('should return 401 when user is not authenticated', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

        const response = await GET(makeGetRequest())
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Unauthorized')
      })

      it('should return 401 when user has no tenantId', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1', tenantId: null })

        const response = await GET(makeGetRequest())
        const data = await response.json()

        expect(response.status).toBe(401)
      })
    })

    describe('Fund retrieval', () => {
      it('should return existing active fund', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
        ;(prisma.pettyCashFund.findFirst as jest.Mock).mockResolvedValue(mockFund)

        const response = await GET(makeGetRequest())
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.id).toBe('fund-1')
        expect(prisma.pettyCashFund.create).not.toHaveBeenCalled()
      })

      it('should auto-create fund when none exists', async () => {
        const newFund = { ...mockFund, id: 'fund-new', currentBalance: '0', movements: [] }
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
        ;(prisma.pettyCashFund.findFirst as jest.Mock).mockResolvedValue(null)
        ;(prisma.pettyCashFund.create as jest.Mock).mockResolvedValue(newFund)

        const response = await GET(makeGetRequest())
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(prisma.pettyCashFund.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tenantId: 'tenant-1',
              name: 'Caja Chica',
              currentBalance: 0,
            }),
          })
        )
      })

      it('should scope fund lookup by tenantId', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
        ;(prisma.pettyCashFund.findFirst as jest.Mock).mockResolvedValue(mockFund)

        await GET(makeGetRequest())

        expect(prisma.pettyCashFund.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { tenantId: 'tenant-1', isActive: true },
          })
        )
      })

      it('should include movementType in movements include', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
        ;(prisma.pettyCashFund.findFirst as jest.Mock).mockResolvedValue(mockFund)

        await GET(makeGetRequest())

        const callArg = (prisma.pettyCashFund.findFirst as jest.Mock).mock.calls[0][0]
        expect(callArg.include.movements.include).toHaveProperty('movementType')
      })
    })
  })

  // -----------------------------------------------------------------------
  // POST /api/petty-cash
  // -----------------------------------------------------------------------
  describe('POST /api/petty-cash', () => {
    function makePostRequest(body: Record<string, unknown>): any {
      const req = new Request('http://localhost/api/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }) as any
      req.nextUrl = { searchParams: new URLSearchParams() }
      return req
    }

    // Build a minimal $transaction mock that runs the callback
    function mockTransaction(fundBalance: number, accountBalance?: number) {
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          pettyCashFund: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'fund-1',
              tenantId: 'tenant-1',
              currentBalance: { toString: () => String(fundBalance) },
            }),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
          pettyCashMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-1',
              type: 'EXPENSE',
              amount: '100',
            }),
          },
          cashAccount: {
            findFirst: jest.fn().mockResolvedValue(
              accountBalance !== undefined
                ? { id: 'account-1', currentBalance: { toString: () => String(accountBalance) } }
                : null
            ),
            update: jest.fn().mockResolvedValue({}),
          },
          cashAccountMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })
    }

    describe('Authentication', () => {
      it('should return 401 when user is not authenticated', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

        const response = await POST(makePostRequest({ type: 'EXPENSE', amount: 100, concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Unauthorized')
      })
    })

    describe('Input validation', () => {
      beforeEach(() => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      })

      it('should return 400 when type is missing', async () => {
        const response = await POST(makePostRequest({ amount: 100, concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Faltan campos requeridos')
      })

      it('should return 400 when amount is missing', async () => {
        const response = await POST(makePostRequest({ type: 'EXPENSE', concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Faltan campos requeridos')
      })

      it('should return 400 when concept is missing', async () => {
        const response = await POST(makePostRequest({ type: 'EXPENSE', amount: 100 }))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Faltan campos requeridos')
      })

      it('should return 400 for amount of zero', async () => {
        // amount: 0 is falsy — triggers the "missing fields" check before the Decimal guard
        const response = await POST(makePostRequest({ type: 'EXPENSE', amount: 0, concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Faltan campos requeridos')
      })

      it('should return 400 for negative amount', async () => {
        const response = await POST(makePostRequest({ type: 'EXPENSE', amount: -50, concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('El monto debe ser mayor a 0')
      })

      it('should return 400 for invalid movement type', async () => {
        const response = await POST(makePostRequest({ type: 'INVALID_TYPE', amount: 100, concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Tipo de movimiento inválido')
      })
    })

    describe('EXPENSE movement', () => {
      beforeEach(() => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      })

      it('should create EXPENSE movement and return 201', async () => {
        mockTransaction(500)

        const response = await POST(makePostRequest({ type: 'EXPENSE', amount: 100, concept: 'Papelería' }))

        expect(response.status).toBe(201)
      })

      it('should fail when fund balance would go negative', async () => {
        mockTransaction(50) // fund has only 50

        const response = await POST(makePostRequest({ type: 'EXPENSE', amount: 200, concept: 'test' }))
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Saldo insuficiente en Caja Chica')
      })

      it('should pass movementTypeId to the movement creation', async () => {
        let capturedMovementCreate: jest.Mock | undefined
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '500' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'EXPENSE', amount: '100' }),
            },
            cashAccount: { findFirst: jest.fn(), update: jest.fn() },
            cashAccountMovement: { create: jest.fn() },
          }
          capturedMovementCreate = mockTx.pettyCashMovement.create
          return callback(mockTx)
        })

        await POST(makePostRequest({ type: 'EXPENSE', amount: 100, concept: 'test', movementTypeId: 'mt-sueldos' }))

        expect(capturedMovementCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ movementTypeId: 'mt-sueldos' }),
          })
        )
      })

      it('should set movementTypeId to null when not provided', async () => {
        let capturedMovementCreate: jest.Mock | undefined
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '500' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'EXPENSE', amount: '100' }),
            },
            cashAccount: { findFirst: jest.fn(), update: jest.fn() },
            cashAccountMovement: { create: jest.fn() },
          }
          capturedMovementCreate = mockTx.pettyCashMovement.create
          return callback(mockTx)
        })

        await POST(makePostRequest({ type: 'EXPENSE', amount: 100, concept: 'test' }))

        expect(capturedMovementCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ movementTypeId: null }),
          })
        )
      })
    })

    describe('INCOME movement', () => {
      beforeEach(() => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      })

      it('should increase fund balance for INCOME', async () => {
        let capturedFundUpdate: jest.Mock | undefined
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '100' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'INCOME', amount: '200' }),
            },
            cashAccount: { findFirst: jest.fn(), update: jest.fn() },
            cashAccountMovement: { create: jest.fn() },
          }
          capturedFundUpdate = mockTx.pettyCashFund.update
          return callback(mockTx)
        })

        await POST(makePostRequest({ type: 'INCOME', amount: 200, concept: 'Reposición' }))

        // balanceBefore=100, delta=+200 → balanceAfter=300
        // The route passes a Decimal to currentBalance; Prisma serialises it as a string "300"
        expect(capturedFundUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              currentBalance: expect.anything(), // Decimal object whose value equals 300
            }),
          })
        )
        // Verify the numeric value by inspecting the actual call
        const callArg = capturedFundUpdate!.mock.calls[0][0]
        expect(String(callArg.data.currentBalance)).toBe('300')
      })
    })

    describe('TRANSFER_OUT — send money to cash account', () => {
      beforeEach(() => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      })

      it('should create RECEIVED movement on cash account for TRANSFER_OUT', async () => {
        let capturedAccountMovementCreate: jest.Mock | undefined
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '500' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'TRANSFER_OUT', amount: '100' }),
            },
            cashAccount: {
              findFirst: jest.fn().mockResolvedValue({ id: 'acct-1', currentBalance: { toString: () => '1000' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            cashAccountMovement: {
              create: jest.fn().mockResolvedValue({}),
            },
          }
          capturedAccountMovementCreate = mockTx.cashAccountMovement.create
          return callback(mockTx)
        })

        await POST(makePostRequest({
          type: 'TRANSFER_OUT',
          amount: 100,
          concept: 'Envío a cuenta',
          cashAccountId: 'acct-1',
        }))

        expect(capturedAccountMovementCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ type: 'RECEIVED', cashAccountId: 'acct-1' }),
          })
        )
      })

      it('should fail when cash account not found during TRANSFER_OUT', async () => {
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '500' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'TRANSFER_OUT', amount: '100' }),
            },
            cashAccount: {
              findFirst: jest.fn().mockResolvedValue(null), // account not found
              update: jest.fn(),
            },
            cashAccountMovement: { create: jest.fn() },
          }
          return callback(mockTx)
        })

        const response = await POST(makePostRequest({
          type: 'TRANSFER_OUT',
          amount: 100,
          concept: 'test',
          cashAccountId: 'nonexistent',
        }))
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Cuenta no encontrada')
      })
    })

    describe('TRANSFER_IN — receive money from cash account', () => {
      beforeEach(() => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
      })

      it('should create RETURNED movement on cash account for TRANSFER_IN', async () => {
        let capturedAccountMovementCreate: jest.Mock | undefined
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '100' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'TRANSFER_IN', amount: '200' }),
            },
            cashAccount: {
              findFirst: jest.fn().mockResolvedValue({ id: 'acct-1', currentBalance: { toString: () => '1000' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            cashAccountMovement: {
              create: jest.fn().mockResolvedValue({}),
            },
          }
          capturedAccountMovementCreate = mockTx.cashAccountMovement.create
          return callback(mockTx)
        })

        await POST(makePostRequest({
          type: 'TRANSFER_IN',
          amount: 200,
          concept: 'Retiro de cuenta',
          cashAccountId: 'acct-1',
        }))

        expect(capturedAccountMovementCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ type: 'RETURNED', cashAccountId: 'acct-1' }),
          })
        )
      })

      it('should fail when account has insufficient balance for TRANSFER_IN', async () => {
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '0' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1' }),
            },
            cashAccount: {
              findFirst: jest.fn().mockResolvedValue({ id: 'acct-1', currentBalance: { toString: () => '50' } }),
              update: jest.fn(),
            },
            cashAccountMovement: { create: jest.fn() },
          }
          return callback(mockTx)
        })

        const response = await POST(makePostRequest({
          type: 'TRANSFER_IN',
          amount: 200, // more than account balance (50)
          concept: 'test',
          cashAccountId: 'acct-1',
        }))
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Saldo insuficiente en la cuenta')
      })
    })

    describe('Multi-tenant isolation', () => {
      it('should create movement with correct tenantId', async () => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

        let capturedMovementCreate: jest.Mock | undefined
        ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const mockTx = {
            pettyCashFund: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fund-1', currentBalance: { toString: () => '500' } }),
              update: jest.fn().mockResolvedValue({}),
            },
            pettyCashMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mv-1', type: 'EXPENSE', amount: '100' }),
            },
            cashAccount: { findFirst: jest.fn(), update: jest.fn() },
            cashAccountMovement: { create: jest.fn() },
          }
          capturedMovementCreate = mockTx.pettyCashMovement.create
          return callback(mockTx)
        })

        await POST(makePostRequest({ type: 'EXPENSE', amount: 100, concept: 'test' }))

        expect(capturedMovementCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
          })
        )
      })
    })
  })
})
