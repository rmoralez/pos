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

    // Calculate totals
    const salesTotal = cashRegister.sales
      .filter((s) => s.status === "COMPLETED")
      .reduce((sum, s) => sum + Number(s.total), 0)

    const incomes = cashRegister.transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = cashRegister.transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const calculatedBalance =
      Number(cashRegister.openingBalance) + salesTotal + incomes - expenses

    return NextResponse.json({
      ...cashRegister,
      salesTotal,
      incomes,
      expenses,
      calculatedBalance,
    })
  } catch (error) {
    console.error("Error fetching cash register:", error)
    return NextResponse.json(
      { error: "Failed to fetch cash register" },
      { status: 500 }
    )
  }
}
