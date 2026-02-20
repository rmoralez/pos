import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/cash-registers/[id]
 * Get specific cash register details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
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
        sales: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    sku: true,
                  },
                },
              },
            },
            payments: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        transactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            movementType: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: "Cash register not found" },
        { status: 404 }
      )
    }

    const completedSales = cashRegister.sales.filter((s) => s.status === "COMPLETED")

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

    for (const sale of completedSales) {
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

    // Cash-only: physical cash that entered the register
    const cashSalesTotal = paymentBreakdown.CASH

    // Only count transactions with a valid movementType (avoids phantom amounts)
    const incomes = cashRegister.transactions
      .filter((t) => t.movementType?.transactionType === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = cashRegister.transactions
      .filter((t) => t.movementType?.transactionType === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Calculated balance = physical cash only
    const calculatedBalance =
      Number(cashRegister.openingBalance) + cashSalesTotal + incomes - expenses

    return NextResponse.json({
      ...cashRegister,
      salesTotal: cashSalesTotal,     // CASH sales only (affects register balance)
      salesFiscalTotal,               // All payment methods combined (fiscal total)
      paymentBreakdown,               // Per-method for reconciliation
      incomes,
      expenses,
      calculatedBalance,              // Physical cash balance
    })
  } catch (error) {
    console.error("Error fetching cash register:", error)
    return NextResponse.json(
      { error: "Failed to fetch cash register" },
      { status: 500 }
    )
  }
}
