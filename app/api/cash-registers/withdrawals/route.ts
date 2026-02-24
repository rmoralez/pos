import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const createWithdrawalSchema = z.object({
  cashRegisterId: z.string(),
  amount: z.number().positive(),
  concept: z.string().min(1),
  reason: z.enum([
    "BANK_DEPOSIT",
    "PETTY_CASH",
    "OWNER_DRAW",
    "EXPENSE",
    "OTHER",
  ]),
  recipientName: z.string().min(1),
  destinationAccountId: z.string().optional(),
  reference: z.string().optional(),
})

/**
 * GET /api/cash-registers/withdrawals
 * List all withdrawals with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const cashRegisterId = searchParams.get("cashRegisterId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const reason = searchParams.get("reason")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Build where clause with multi-tenant isolation
    const where: any = {
      tenantId: user.tenantId,
    }

    if (cashRegisterId) {
      where.cashRegisterId = cashRegisterId
    }

    if (reason) {
      where.concept = {
        contains: reason,
        mode: "insensitive",
      }
    }

    if (startDate || endDate) {
      where.withdrawnAt = {}
      if (startDate) {
        where.withdrawnAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.withdrawnAt.lte = new Date(endDate)
      }
    }

    // Get withdrawals with related data
    const [withdrawals, total] = await Promise.all([
      prisma.cashWithdrawal.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          CashRegister: {
            select: {
              id: true,
              openedAt: true,
              closedAt: true,
              status: true,
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          withdrawnAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.cashWithdrawal.count({ where }),
    ])

    return NextResponse.json({
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching withdrawals:", error)
    return NextResponse.json(
      { error: "Failed to fetch withdrawals" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cash-registers/withdrawals
 * Create a new cash withdrawal
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createWithdrawalSchema.parse(body)

    // Check role-based limits
    const withdrawalLimits = {
      CASHIER: 500,
      STOCK_MANAGER: 500,
      MANAGER: 5000,
      ADMIN: Infinity,
      SUPER_ADMIN: Infinity,
    }

    const userLimit = withdrawalLimits[user.role as keyof typeof withdrawalLimits] || 0
    if (data.amount > userLimit) {
      return NextResponse.json(
        {
          error: `Withdrawal amount exceeds your limit of ${userLimit}. Manager approval required.`,
        },
        { status: 403 }
      )
    }

    // Verify cash register exists, is open, and belongs to tenant
    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        id: data.cashRegisterId,
        tenantId: user.tenantId,
        status: "OPEN",
      },
      include: {
        location: true,
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: "Cash register not found or is closed" },
        { status: 404 }
      )
    }

    // Calculate current balance (similar to cash register detail logic)
    const completedSales = await prisma.sale.findMany({
      where: {
        cashRegisterId: data.cashRegisterId,
        status: "COMPLETED",
      },
      include: {
        payments: true,
      },
    })

    const cashSalesTotal = completedSales.reduce((total, sale) => {
      const cashPayments = sale.payments
        .filter((p) => p.method === "CASH")
        .reduce((sum, p) => sum + Number(p.amount), 0)
      return total + cashPayments
    }, 0)

    const transactions = await prisma.cashTransaction.findMany({
      where: {
        cashRegisterId: data.cashRegisterId,
      },
      include: {
        movementType: true,
      },
    })

    const incomes = transactions
      .filter((t) => t.movementType?.transactionType === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = transactions
      .filter((t) => t.movementType?.transactionType === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Get existing withdrawals for this register
    const existingWithdrawals = await prisma.cashWithdrawal.findMany({
      where: {
        cashRegisterId: data.cashRegisterId,
      },
    })

    const totalWithdrawals = existingWithdrawals.reduce(
      (sum, w) => sum + Number(w.amount),
      0
    )

    const currentBalance =
      Number(cashRegister.openingBalance) +
      cashSalesTotal +
      incomes -
      expenses -
      totalWithdrawals

    // Validate sufficient balance
    if (data.amount > currentBalance) {
      return NextResponse.json(
        {
          error: `Insufficient cash balance. Available: ${currentBalance.toFixed(2)}`,
        },
        { status: 400 }
      )
    }

    // If destination account specified, verify it exists
    if (data.destinationAccountId) {
      const account = await prisma.cashAccount.findFirst({
        where: {
          id: data.destinationAccountId,
          tenantId: user.tenantId,
          isActive: true,
        },
      })

      if (!account) {
        return NextResponse.json(
          { error: "Destination account not found or inactive" },
          { status: 404 }
        )
      }
    }

    // Generate withdrawal reference number
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "")
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    )

    const todayWithdrawalsCount = await prisma.cashWithdrawal.count({
      where: {
        tenantId: user.tenantId,
        withdrawnAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    })

    const sequence = String(todayWithdrawalsCount + 1).padStart(3, "0")
    const reference = `WD-${dateStr}-${sequence}`

    // Create withdrawal in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create withdrawal record
      const withdrawal = await tx.cashWithdrawal.create({
        data: {
          id: `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          amount: new Decimal(data.amount),
          concept: `${data.reason}: ${data.concept} - Recipient: ${data.recipientName}`,
          reference: data.reference || reference,
          cashRegisterId: data.cashRegisterId,
          userId: user.id,
          tenantId: user.tenantId,
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          CashRegister: {
            select: {
              id: true,
              openedAt: true,
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      // If destination account specified, create cash account movement
      if (data.destinationAccountId) {
        const account = await tx.cashAccount.findFirst({
          where: { id: data.destinationAccountId, tenantId: user.tenantId },
        })

        if (account) {
          const accountBalanceBefore = new Decimal(account.currentBalance.toString())
          const accountBalanceAfter = accountBalanceBefore.add(new Decimal(data.amount))

          await tx.cashAccountMovement.create({
            data: {
              type: "RECEIVED",
              amount: new Decimal(data.amount),
              concept: `Withdrawal from cash register: ${data.concept}`,
              reference: data.reference || reference,
              balanceBefore: accountBalanceBefore,
              balanceAfter: accountBalanceAfter,
              cashAccountId: data.destinationAccountId,
              tenantId: user.tenantId,
              userId: user.id,
            },
          })

          await tx.cashAccount.update({
            where: { id: data.destinationAccountId },
            data: { currentBalance: accountBalanceAfter },
          })
        }
      }

      return withdrawal
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating withdrawal:", error)
    return NextResponse.json(
      { error: "Failed to create withdrawal" },
      { status: 500 }
    )
  }
}
