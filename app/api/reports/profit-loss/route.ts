import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

// -----------------------------------------------------------------------
// Helper: default date range (current month)
// -----------------------------------------------------------------------
function defaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10) // "YYYY-MM-DD"
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

// -----------------------------------------------------------------------
// GET /api/reports/profit-loss?from=YYYY-MM-DD&to=YYYY-MM-DD
// -----------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const defaults = defaultDateRange()

    const fromParam = searchParams.get("from") ?? defaults.from
    const toParam = searchParams.get("to") ?? defaults.to

    // Parse dates: start of day (UTC midnight) for `from`,
    // end of day (23:59:59.999 UTC) for `to`.
    const fromDate = new Date(`${fromParam}T00:00:00.000Z`)
    const toDate = new Date(`${toParam}T23:59:59.999Z`)

    const tenantId = user.tenantId

    // ----------------------------------------------------------------
    // 1. Revenue: completed sales in date range
    // ----------------------------------------------------------------
    const completedSales = await prisma.sale.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        items: {
          select: {
            quantity: true,
            costPrice: true,
          },
        },
        payments: {
          select: {
            method: true,
            amount: true,
          },
        },
      },
    })

    // Gross revenue = sum of all completed sale totals
    let grossRevenue = 0
    const byPaymentMethod: Record<string, number> = {}
    let cogs = 0

    for (const sale of completedSales) {
      // Revenue: sum from payments (authoritative amount per method)
      for (const payment of sale.payments) {
        const amount = Number(payment.amount)
        byPaymentMethod[payment.method] =
          (byPaymentMethod[payment.method] ?? 0) + amount
        grossRevenue += amount
      }

      // COGS: only items with a non-null costPrice snapshot
      for (const item of sale.items) {
        if (item.costPrice !== null) {
          cogs += Number(item.costPrice) * item.quantity
        }
      }
    }

    const grossProfit = grossRevenue - cogs
    const grossMargin =
      grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0

    // ----------------------------------------------------------------
    // 2. Expenses — three sources, grouped by movementTypeId
    // ----------------------------------------------------------------

    // Map: movementTypeId (or null) -> { categoryName, amount, sources }
    type ExpenseAccumulator = {
      categoryName: string
      amount: number
      sources: Set<string>
    }
    const expenseMap = new Map<string | null, ExpenseAccumulator>()

    const accumulateExpense = (
      movementTypeId: string | null,
      movementTypeName: string | null,
      amount: number,
      source: string
    ) => {
      const key = movementTypeId // null key is valid in Map
      if (!expenseMap.has(key)) {
        expenseMap.set(key, {
          categoryName: movementTypeName ?? "Sin categoría",
          amount: 0,
          sources: new Set(),
        })
      }
      const entry = expenseMap.get(key)!
      entry.amount += amount
      entry.sources.add(source)
    }

    // Source 1: CashTransaction (EXPENSE movement types only)
    // CashTransaction has no direct tenantId; scoped via cashRegister.tenantId
    const cashTransactions = await prisma.cashTransaction.findMany({
      where: {
        cashRegister: {
          tenantId,
        },
        movementType: {
          transactionType: "EXPENSE",
        },
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        amount: true,
        movementTypeId: true,
        movementType: {
          select: { name: true },
        },
      },
    })

    for (const tx of cashTransactions) {
      accumulateExpense(
        tx.movementTypeId,
        tx.movementType?.name ?? null,
        Number(tx.amount),
        "Caja"
      )
    }

    // Source 2: PettyCashMovement where type = EXPENSE
    const pettyCashMovements = await prisma.pettyCashMovement.findMany({
      where: {
        tenantId,
        type: "EXPENSE",
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        amount: true,
        movementTypeId: true,
        movementType: {
          select: { name: true },
        },
      },
    })

    for (const mov of pettyCashMovements) {
      accumulateExpense(
        mov.movementTypeId,
        mov.movementType?.name ?? null,
        Number(mov.amount),
        "Caja Chica"
      )
    }

    // Source 3: CashAccountMovement where type = PAID
    const cashAccountMovements = await prisma.cashAccountMovement.findMany({
      where: {
        tenantId,
        type: "PAID",
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        amount: true,
        movementTypeId: true,
        movementType: {
          select: { name: true },
        },
      },
    })

    for (const mov of cashAccountMovements) {
      accumulateExpense(
        mov.movementTypeId,
        mov.movementType?.name ?? null,
        Number(mov.amount),
        "Cuentas"
      )
    }

    // Build the byCategory array and total
    let expensesTotal = 0
    const byCategory = Array.from(expenseMap.entries()).map(
      ([categoryId, entry]) => {
        expensesTotal += entry.amount
        return {
          categoryId,
          categoryName: entry.categoryName,
          amount: entry.amount,
          sources: Array.from(entry.sources),
        }
      }
    )

    // ----------------------------------------------------------------
    // 3. Net profit / margin
    // ----------------------------------------------------------------
    const netProfit = grossProfit - expensesTotal
    const netMargin =
      grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

    // ----------------------------------------------------------------
    // Response
    // ----------------------------------------------------------------
    return NextResponse.json({
      period: {
        from: fromParam,
        to: toParam,
      },
      revenue: {
        gross: grossRevenue,
        byPaymentMethod,
      },
      cogs,
      grossProfit,
      grossMargin,
      expenses: {
        total: expensesTotal,
        byCategory,
      },
      netProfit,
      netMargin,
    })
  } catch (error) {
    console.error("GET /api/reports/profit-loss error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
