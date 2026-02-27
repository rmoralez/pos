import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const paymentAllocationSchema = z.object({
  movementId: z.string().min(1),
  amount: z.number().positive(),
})

const paymentEntrySchema = z.object({
  method: z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "QR", "CHECK"]),
  amount: z.number().positive(),
})

const paymentSchema = z.object({
  amount: z.number().positive(),
  concept: z.string().min(1),
  reference: z.string().optional(),
  paymentDate: z.string().optional(),
  payments: z.array(paymentEntrySchema).min(1),
  allocations: z.array(paymentAllocationSchema).optional(),
})

/**
 * POST /api/accounts/[customerId]/payments
 * Register a payment for a customer account
 *
 * Business logic:
 * 1. Create payment movement (PAYMENT type)
 * 2. Update account balance
 * 3. If allocations provided, allocate payment to specific charges:
 *    - Update isPaid, paidAmount, paidDate for each charge
 *    - Mark as fully paid if paidAmount >= charge amount
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

    // Validate allocations if provided
    if (data.allocations && data.allocations.length > 0) {
      const totalAllocated = data.allocations.reduce(
        (sum, alloc) => sum + alloc.amount,
        0
      )

      if (totalAllocated > data.amount) {
        return NextResponse.json(
          { error: "Total allocated amount exceeds payment amount" },
          { status: 400 }
        )
      }

      // Verify all movements belong to this customer account and are charges
      for (const allocation of data.allocations) {
        const movement = await prisma.customerAccountMovement.findFirst({
          where: {
            id: allocation.movementId,
            customerAccountId: account.id,
            tenantId: user.tenantId,
            type: "CHARGE",
          },
        })

        if (!movement) {
          return NextResponse.json(
            {
              error: `Charge ${allocation.movementId} not found or does not belong to this customer`,
            },
            { status: 400 }
          )
        }

        // Check remaining balance on the charge
        const remainingBalance = Number(movement.amount) - Number(movement.paidAmount)
        if (remainingBalance < allocation.amount) {
          return NextResponse.json(
            {
              error: `Allocation amount for charge exceeds remaining balance`,
            },
            { status: 400 }
          )
        }
      }
    }

    // Perform payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment movement (reduces debt - increases balance toward 0)
      const movement = await tx.customerAccountMovement.create({
        data: {
          customerAccountId: account.id,
          tenantId: user.tenantId,
          userId: user.id,
          type: "PAYMENT",
          amount: data.amount,
          concept: data.concept,
          reference: data.reference,
          balanceBefore: account.balance,
          balanceAfter: Number(account.balance) + data.amount, // Payment increases balance (reduces negative debt)
          paidDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
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
      await tx.customerAccount.update({
        where: { id: account.id },
        data: {
          balance: movement.balanceAfter,
        },
      })

      // Register each payment method in corresponding cash accounts
      for (const payment of data.payments) {
        // Find the payment method account mapping
        const paymentMethodAccount = await tx.paymentMethodAccount.findFirst({
          where: {
            tenantId: user.tenantId,
            paymentMethod: payment.method,
          },
          include: {
            CashAccount: true,
          },
        })

        if (!paymentMethodAccount) {
          throw new Error(
            `No cash account configured for payment method: ${payment.method}`
          )
        }

        const cashAccount = paymentMethodAccount.CashAccount
        const balanceBefore = cashAccount.currentBalance
        const balanceAfter = Number(balanceBefore) + payment.amount

        // Create cash account movement
        await tx.cashAccountMovement.create({
          data: {
            type: "RECEIVED",
            amount: payment.amount,
            concept: `Cobro de cuenta corriente - ${data.concept}`,
            balanceBefore,
            balanceAfter,
            reference: data.reference,
            cashAccountId: cashAccount.id,
            tenantId: user.tenantId,
            userId: user.id,
          },
        })

        // Update cash account balance
        await tx.cashAccount.update({
          where: { id: cashAccount.id },
          data: { currentBalance: balanceAfter },
        })
      }

      // Process allocations if provided
      if (data.allocations && data.allocations.length > 0) {
        for (const allocation of data.allocations) {
          const charge = await tx.customerAccountMovement.findUnique({
            where: { id: allocation.movementId },
          })

          if (!charge) {
            throw new Error(`Charge ${allocation.movementId} not found`)
          }

          const newPaidAmount = Number(charge.paidAmount) + allocation.amount
          const isFullyPaid = newPaidAmount >= Number(charge.amount)

          await tx.customerAccountMovement.update({
            where: { id: allocation.movementId },
            data: {
              paidAmount: newPaidAmount,
              isPaid: isFullyPaid,
              paidDate: isFullyPaid ? new Date() : charge.paidDate,
            },
          })
        }
      }

      return movement
    })

    return NextResponse.json(result, { status: 201 })
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
