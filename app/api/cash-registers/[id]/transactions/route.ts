import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const cashTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive(),
  reason: z.string().min(1),
  reference: z.string().optional(),
})

/**
 * POST /api/cash-registers/[id]/transactions
 * Add a cash transaction (income or expense)
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
    const data = cashTransactionSchema.parse(body)

    // Verify cash register exists and is open
    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
        status: "OPEN",
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: "Cash register not found or is closed" },
        { status: 404 }
      )
    }

    // Create transaction
    const transaction = await prisma.cashTransaction.create({
      data: {
        cashRegisterId: params.id,
        userId: user.id,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        reference: data.reference,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating cash transaction:", error)
    return NextResponse.json(
      { error: "Failed to create cash transaction" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cash-registers/[id]/transactions
 * List transactions for a cash register
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

    // Verify cash register exists and belongs to tenant
    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: "Cash register not found" },
        { status: 404 }
      )
    }

    // Get transactions
    const transactions = await prisma.cashTransaction.findMany({
      where: {
        cashRegisterId: params.id,
      },
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
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    )
  }
}
