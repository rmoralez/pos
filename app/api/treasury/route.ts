import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/treasury
 * Returns treasury dashboard summary with aggregated data from all cash sources.
 *
 * Returns:
 * - totalCash: Total balance across all active accounts
 * - cashInRegisters: Sum of current balance from open cash registers
 * - bankAccounts: Sum of balances from bank-type cash accounts
 * - pettyCash: Balance of petty cash fund
 * - accountBreakdown: List of all accounts with balances
 * - recentMovements: Last 20 movements across all accounts
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  try {
    // Fetch all active cash accounts
    const cashAccounts = await prisma.cashAccount.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        currentBalance: true,
        description: true,
      },
      orderBy: { name: "asc" },
    })

    // Fetch open cash registers with current balance
    const openRegisters = await prisma.cashRegister.findMany({
      where: {
        tenantId,
        status: "OPEN",
      },
      select: {
        id: true,
        openingBalance: true,
        openedAt: true,
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Calculate current balance for each open register
    const registersWithBalances = await Promise.all(
      openRegisters.map(async (register) => {
        // Get all transactions for this register
        const transactions = await prisma.cashTransaction.aggregate({
          where: { cashRegisterId: register.id },
          _sum: { amount: true },
        })

        // Get all sales for this register
        const sales = await prisma.sale.aggregate({
          where: { cashRegisterId: register.id },
          _sum: { total: true },
        })

        const transactionsTotal = Number(transactions._sum.amount || 0)
        const salesTotal = Number(sales._sum.total || 0)
        const currentBalance =
          Number(register.openingBalance) + transactionsTotal + salesTotal

        return {
          id: register.id,
          name: `Caja ${register.location.name}`,
          type: "CASH_REGISTER" as const,
          currentBalance,
          description: `Usuario: ${register.user.name || "Sin nombre"}`,
          openedAt: register.openedAt,
        }
      })
    )

    // Fetch petty cash fund
    const pettyCashFund = await prisma.pettyCashFund.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
      },
    })

    // Calculate totals
    const totalFromAccounts = cashAccounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance),
      0
    )

    const totalFromRegisters = registersWithBalances.reduce(
      (sum, reg) => sum + reg.currentBalance,
      0
    )

    const pettyCashBalance = Number(pettyCashFund?.currentBalance || 0)

    const totalCash = totalFromAccounts + totalFromRegisters + pettyCashBalance

    // Bank accounts total (only BANK type)
    const bankAccountsTotal = cashAccounts
      .filter((acc) => acc.type === "BANK")
      .reduce((sum, acc) => sum + Number(acc.currentBalance), 0)

    // Recent movements across all cash accounts (last 20)
    const recentAccountMovements = await prisma.cashAccountMovement.findMany({
      where: { tenantId },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        amount: true,
        concept: true,
        reference: true,
        createdAt: true,
        cashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Recent petty cash movements (last 10)
    const recentPettyCashMovements = await prisma.pettyCashMovement.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        amount: true,
        concept: true,
        reference: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Combine and sort movements by date
    const allMovements = [
      ...recentAccountMovements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        concept: m.concept,
        reference: m.reference,
        createdAt: m.createdAt,
        accountName: m.cashAccount.name,
        accountType: m.cashAccount.type,
        userName: m.user.name,
        source: "CASH_ACCOUNT" as const,
      })),
      ...recentPettyCashMovements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        concept: m.concept,
        reference: m.reference,
        createdAt: m.createdAt,
        accountName: pettyCashFund?.name || "Caja Chica",
        accountType: "PETTY_CASH" as const,
        userName: m.user.name,
        source: "PETTY_CASH" as const,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)

    // Combine all accounts for breakdown
    const accountBreakdown = [
      ...registersWithBalances.map((reg) => ({
        id: reg.id,
        name: reg.name,
        type: reg.type,
        currentBalance: reg.currentBalance,
        description: reg.description,
        status: "OPEN" as const,
      })),
      ...cashAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currentBalance: Number(acc.currentBalance),
        description: acc.description,
        status: "ACTIVE" as const,
      })),
      ...(pettyCashFund
        ? [
            {
              id: pettyCashFund.id,
              name: pettyCashFund.name,
              type: "PETTY_CASH" as const,
              currentBalance: pettyCashBalance,
              description: "Fondo de caja chica",
              status: "ACTIVE" as const,
            },
          ]
        : []),
    ]

    return NextResponse.json({
      totalCash,
      cashInRegisters: totalFromRegisters,
      bankAccounts: bankAccountsTotal,
      pettyCash: pettyCashBalance,
      accountBreakdown,
      recentMovements: allMovements,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Treasury summary error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
