import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

// Payment methods that represent physical cash in the drawer.
// All other methods (DEBIT_CARD, CREDIT_CARD, QR, TRANSFER, CHECK, ACCOUNT, OTHER)
// are settled externally and never enter the cash register physically.
const CASH_ONLY = new Set(["CASH"])

/**
 * GET /api/cash-registers/current
 * Get the current open cash register for the user's location
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the current user's open cash register
    // Each user has their own independent cash register
    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        status: "OPEN",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            sales: true,
            transactions: true,
          },
        },
      },
    })

    console.log('[API] Cash register found:', cashRegister ? `ID: ${cashRegister.id}` : 'null')

    if (!cashRegister) {
      console.log('[API] No cash register found - returning 404')
      return NextResponse.json(
        { error: "No open cash register found" },
        { status: 404 }
      )
    }

    // Calculate current balance
    console.log('[API] Fetching sales and transactions for cash register:', cashRegister.id)
    const [sales, transactions] = await Promise.all([
      prisma.sale.findMany({
        where: {
          cashRegisterId: cashRegister.id,
          status: "COMPLETED",
        },
        include: {
          payments: {
            select: { method: true, amount: true },
          },
        },
      }),
      prisma.cashTransaction.findMany({
        where: {
          cashRegisterId: cashRegister.id,
        },
        include: {
          movementType: true,
        },
      }),
    ])

    console.log('[API] Sales and transactions fetched successfully')

    // Build per-method payment breakdown (all methods for reconciliation)
    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      DEBIT_CARD: 0,
      CREDIT_CARD: 0,
      QR: 0,
      TRANSFER: 0,
      ACCOUNT: 0,
      CHECK: 0,
      OTHER: 0,
    }

    for (const sale of sales) {
      for (const p of sale.payments) {
        const method = p.method as string
        if (method in paymentBreakdown) {
          paymentBreakdown[method] += Number(p.amount)
        } else {
          paymentBreakdown.OTHER += Number(p.amount)
        }
      }
    }

    // Total fiscal sales (all payment methods)
    const salesFiscalTotal = Object.values(paymentBreakdown).reduce((a, b) => a + b, 0)

    // Cash-only amount: what physically entered the register
    const cashSalesTotal = paymentBreakdown.CASH

    // Only count transactions that have a valid movementType (avoids phantom amounts)
    const incomes = transactions
      .filter((t) => t.movementType?.transactionType === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenses = transactions
      .filter((t) => t.movementType?.transactionType === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Current balance = only physical cash (openingBalance + CASH sales + manual cash in/out)
    const currentBalance =
      Number(cashRegister.openingBalance) + cashSalesTotal + incomes - expenses

    return NextResponse.json({
      ...cashRegister,
      currentBalance,          // Physical cash in the drawer
      salesTotal: cashSalesTotal,        // CASH sales only (contributes to balance)
      salesFiscalTotal,        // All sales regardless of payment method (fiscal)
      paymentBreakdown,        // Per-method breakdown for reconciliation
      incomes,
      expenses,
    })
  } catch (error) {
    console.error("Error fetching current cash register:", error)
    return NextResponse.json(
      { error: "Failed to fetch current cash register" },
      { status: 500 }
    )
  }
}
