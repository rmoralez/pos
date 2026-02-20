import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const paymentSchema = z.object({
  amount: z.number().positive(),
  concept: z.string().min(1).default("Pago de cuenta corriente"),
  reference: z.string().optional(),
})

// POST /api/customers/[id]/account/payments — register a payment from customer
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN", "CASHIER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = paymentSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      // Get or create account
      let account = await tx.customerAccount.findUnique({
        where: { customerId: params.id },
      })

      if (!account) {
        account = await tx.customerAccount.create({
          data: {
            customerId: params.id,
            tenantId: user.tenantId,
          },
        })
      }

      if (!account.isActive) {
        throw new Error("ACCOUNT_INACTIVE")
      }

      const balanceBefore = account.balance
      // PAYMENT increases balance (reduces debt)
      const newBalance = new Decimal(balanceBefore).plus(new Decimal(validatedData.amount))

      // Update account balance
      const updatedAccount = await tx.customerAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      })

      // Create movement record
      const movement = await tx.customerAccountMovement.create({
        data: {
          type: "PAYMENT",
          amount: validatedData.amount,
          concept: validatedData.concept,
          balanceBefore,
          balanceAfter: newBalance,
          reference: validatedData.reference,
          customerAccountId: account.id,
          tenantId: user.tenantId,
          userId: user.id,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      })

      return { account: updatedAccount, movement }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta corriente está inactiva" },
        { status: 400 }
      )
    }
    console.error("POST account payment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
