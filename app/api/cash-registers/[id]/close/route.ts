import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const closeCashRegisterSchema = z.object({
  closingBalance: z.number().min(0),
  notes: z.string().optional(),
})

/**
 * POST /api/cash-registers/[id]/close
 * Close a cash register
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = closeCashRegisterSchema.parse(body)

    // Get cash register
    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        sales: {
          where: {
            status: "COMPLETED",
          },
        },
        transactions: true,
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: "Cash register not found" },
        { status: 404 }
      )
    }

    if (cashRegister.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cash register is already closed" },
        { status: 400 }
      )
    }

    // Calculate expected balance
    const salesTotal = cashRegister.sales.reduce(
      (sum, s) => sum + Number(s.total),
      0
    )
    const incomes = cashRegister.transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenses = cashRegister.transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expectedBalance =
      Number(cashRegister.openingBalance) + salesTotal + incomes - expenses

    const difference = data.closingBalance - expectedBalance

    // Close cash register
    const updated = await prisma.cashRegister.update({
      where: {
        id: params.id,
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance: data.closingBalance,
        expectedBalance,
        difference,
        notes: data.notes
          ? `${cashRegister.notes || ""}\n${data.notes}`.trim()
          : cashRegister.notes,
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

    return NextResponse.json({
      ...updated,
      salesTotal,
      incomes,
      expenses,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error closing cash register:", error)
    return NextResponse.json(
      { error: "Failed to close cash register" },
      { status: 500 }
    )
  }
}
