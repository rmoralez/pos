import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const paymentSchema = z.object({
  amount: z.number().positive(),
  concept: z.string().min(1),
  reference: z.string().optional(),
})

/**
 * POST /api/accounts/[customerId]/payments
 * Register a payment for a customer account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = paymentSchema.parse(body)

    // Get customer account
    const account = await prisma.customerAccount.findFirst({
      where: {
        customerId: params.customerId,
        tenantId: user.tenantId,
      },
    })

    if (!account) {
      return NextResponse.json(
        { error: "Customer account not found" },
        { status: 404 }
      )
    }

    if (!account.isActive) {
      return NextResponse.json(
        { error: "Customer account is inactive" },
        { status: 400 }
      )
    }

    // Create payment movement (reduces debt)
    const movement = await prisma.customerAccountMovement.create({
      data: {
        customerAccountId: account.id,
        tenantId: user.tenantId,
        userId: user.id,
        type: "PAYMENT",
        amount: data.amount,
        concept: data.concept,
        reference: data.reference,
        balanceBefore: account.balance,
        balanceAfter: account.balance.toNumber() + data.amount, // Payment increases balance (reduces negative debt)
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

    // Update account balance
    await prisma.customerAccount.update({
      where: { id: account.id },
      data: {
        balance: movement.balanceAfter,
      },
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error registering payment:", error)
    return NextResponse.json(
      { error: "Failed to register payment" },
      { status: 500 }
    )
  }
}
