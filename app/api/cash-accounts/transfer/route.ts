import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Source account is required"),
  toAccountId: z.string().min(1, "Destination account is required"),
  amount: z.number().positive("Amount must be positive"),
  concept: z.string().min(1, "Concept is required"),
  reference: z.string().optional(),
})

/**
 * POST /api/cash-accounts/transfer
 * Transfer money between two cash accounts
 *
 * Business logic:
 * 1. Validate both accounts exist and belong to tenant
 * 2. Validate sufficient balance in source account
 * 3. Create TWO movements in a transaction:
 *    - TRANSFER_OUT from source account (decrease balance)
 *    - TRANSFER_IN to destination account (increase balance)
 * 4. Link movements via relatedAccountId
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can perform transfers
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can perform transfers" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = transferSchema.parse(body)

    // Validate accounts are different
    if (data.fromAccountId === data.toAccountId) {
      return NextResponse.json(
        { error: "Source and destination accounts must be different" },
        { status: 400 }
      )
    }

    // Fetch both accounts with multi-tenant isolation
    const [fromAccount, toAccount] = await Promise.all([
      prisma.cashAccount.findFirst({
        where: {
          id: data.fromAccountId,
          tenantId: user.tenantId,
          isActive: true,
        },
      }),
      prisma.cashAccount.findFirst({
        where: {
          id: data.toAccountId,
          tenantId: user.tenantId,
          isActive: true,
        },
      }),
    ])

    if (!fromAccount) {
      return NextResponse.json(
        { error: "Source account not found or inactive" },
        { status: 404 }
      )
    }

    if (!toAccount) {
      return NextResponse.json(
        { error: "Destination account not found or inactive" },
        { status: 404 }
      )
    }

    // Validate sufficient balance
    const currentBalance = Number(fromAccount.currentBalance)
    if (currentBalance < data.amount) {
      return NextResponse.json(
        {
          error: "Insufficient balance in source account",
          details: {
            available: currentBalance,
            required: data.amount,
          }
        },
        { status: 400 }
      )
    }

    // Perform transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create TRANSFER_OUT movement from source account
      const outMovement = await tx.cashAccountMovement.create({
        data: {
          type: "TRANSFER_OUT",
          amount: data.amount,
          concept: data.concept,
          reference: data.reference || null,
          balanceBefore: fromAccount.currentBalance,
          balanceAfter: currentBalance - data.amount,
          relatedAccountId: toAccount.id,
          cashAccountId: fromAccount.id,
          tenantId: user.tenantId,
          userId: user.id,
        },
      })

      // Update source account balance
      await tx.cashAccount.update({
        where: { id: fromAccount.id },
        data: {
          currentBalance: currentBalance - data.amount,
        },
      })

      const toCurrentBalance = Number(toAccount.currentBalance)
      const newToBalance = toCurrentBalance + data.amount

      // Create TRANSFER_IN movement to destination account
      const inMovement = await tx.cashAccountMovement.create({
        data: {
          type: "TRANSFER_IN",
          amount: data.amount,
          concept: data.concept,
          reference: data.reference || null,
          balanceBefore: toAccount.currentBalance,
          balanceAfter: newToBalance,
          relatedAccountId: fromAccount.id,
          cashAccountId: toAccount.id,
          tenantId: user.tenantId,
          userId: user.id,
        },
      })

      // Update destination account balance
      await tx.cashAccount.update({
        where: { id: toAccount.id },
        data: {
          currentBalance: newToBalance,
        },
      })

      return { outMovement, inMovement, newToBalance }
    })

    // Fetch complete movement data with relations
    const movements = await prisma.cashAccountMovement.findMany({
      where: {
        id: {
          in: [result.outMovement.id, result.inMovement.id],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        CashAccount_CashAccountMovement_relatedAccountIdToCashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        transfer: {
          amount: data.amount,
          fromAccount: {
            id: fromAccount.id,
            name: fromAccount.name,
            newBalance: currentBalance - data.amount,
          },
          toAccount: {
            id: toAccount.id,
            name: toAccount.name,
            newBalance: result.newToBalance,
          },
          movements,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("POST transfer error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
