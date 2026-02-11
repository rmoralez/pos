import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

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

    const searchParams = request.nextUrl.searchParams
    const locationId = searchParams.get("locationId") || user.locationId

    // Build where clause
    const where: any = {
      tenantId: user.tenantId,
      status: "OPEN",
    }

    // Add locationId if available
    if (locationId) {
      where.locationId = locationId
    }

    // Find open cash register
    const cashRegister = await prisma.cashRegister.findFirst({
      where,
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
    const [salesTotal, transactions] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          cashRegisterId: cashRegister.id,
          status: "COMPLETED",
        },
        _sum: {
          total: true,
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

    // Calculate current balance
    const salesAmount = Number(salesTotal._sum.total || 0)
    const incomes = transactions
      .filter((t) => t.movementType?.transactionType === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenses = transactions
      .filter((t) => t.movementType?.transactionType === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const currentBalance =
      Number(cashRegister.openingBalance) + salesAmount + incomes - expenses

    return NextResponse.json({
      ...cashRegister,
      currentBalance,
      salesTotal: salesAmount,
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
