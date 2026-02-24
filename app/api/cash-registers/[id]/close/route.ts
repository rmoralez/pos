import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const closeCashRegisterSchema = z.object({
  closingBalance: z.number().min(0).optional(),
  finalBalance: z.number().min(0).optional(),
  notes: z.string().optional(),
}).transform((data) => ({
  closingBalance: data.closingBalance ?? data.finalBalance ?? 0,
  notes: data.notes,
}))

/**
 * POST /api/cash-registers/[id]/close
 * Close a cash register
 *
 * expectedBalance and difference only account for physical CASH (Efectivo).
 * Card / QR / Transfer / Account payments are settled externally and never
 * enter the physical register — they appear in paymentBreakdown for reference.
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
          include: {
            payments: {
              select: { method: true, amount: true },
            },
          },
        },
        transactions: {
          include: {
            movementType: true,
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

    if (cashRegister.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cash register is already closed" },
        { status: 400 }
      )
    }

    // Build per-method payment breakdown (for reporting purposes)
    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      DEBIT_CARD: 0,
      CREDIT_CARD: 0,
      QR: 0,
      TRANSFER: 0,
      ACCOUNT: 0,
      CHECK: 0,
      OTHER: 0,
    }

    for (const sale of cashRegister.sales) {
      for (const p of sale.payments) {
        const method = p.method as string
        if (method in paymentBreakdown) {
          paymentBreakdown[method] += Number(p.amount)
        } else {
          paymentBreakdown.OTHER += Number(p.amount)
        }
      }
    }

    // Total fiscal sales (all payment methods — for informational display)
    const salesFiscalTotal = Object.values(paymentBreakdown).reduce((a, b) => a + b, 0)

    // Physical cash that entered the register: CASH sales only
    const cashSalesTotal = paymentBreakdown.CASH

    // Only count transactions with a valid movementType (avoids phantom amounts)
    const incomes = cashRegister.transactions
      .filter((t) => t.movementType?.transactionType === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenses = cashRegister.transactions
      .filter((t) => t.movementType?.transactionType === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Expected physical cash = opening + CASH sales + manual incomes - expenses
    // (Cards/QR/Transfer never enter the drawer)
    const expectedBalance =
      Number(cashRegister.openingBalance) + cashSalesTotal + incomes - expenses

    const difference = data.closingBalance - expectedBalance

    // Close cash register and return money to treasury
    const updated = await prisma.$transaction(async (tx) => {
      // Close the register
      const register = await tx.cashRegister.update({
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

      // If there's a closing balance, return it to main cash account
      // NOTE: Non-cash payments (cards, transfers, etc.) are now registered
      // immediately at sale time, so we only need to transfer the physical cash
      if (data.closingBalance > 0) {
        // Find main cash account (Efectivo)
        const mainCashAccount = await tx.cashAccount.findFirst({
          where: {
            tenantId: user.tenantId,
            type: { in: ["CASH", "OPERATIONAL"] },
            name: { contains: "Efectivo", mode: "insensitive" },
            isActive: true,
          },
        })

        if (!mainCashAccount) {
          throw new Error("No se encontró la cuenta de efectivo en tesorería")
        }

        // Calculate new balance
        const balanceBefore = mainCashAccount.currentBalance
        const balanceAfter = Number(balanceBefore) + data.closingBalance

        // Create movement to add to cash account
        await tx.cashAccountMovement.create({
          data: {
            type: "TRANSFER_IN",
            amount: data.closingBalance,
            concept: `Cierre de caja #${register.id.slice(-8)} - Efectivo`,
            balanceBefore,
            balanceAfter,
            reference: register.id,
            cashAccountId: mainCashAccount.id,
            tenantId: user.tenantId,
            userId: user.id,
          },
        })

        // Update cash account balance
        await tx.cashAccount.update({
          where: { id: mainCashAccount.id },
          data: { currentBalance: balanceAfter },
        })
      }

      return register
    })

    return NextResponse.json({
      ...updated,
      salesTotal: cashSalesTotal,   // Physical cash from sales
      salesFiscalTotal,             // All payment methods combined (fiscal)
      paymentBreakdown,             // Per-method breakdown
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
