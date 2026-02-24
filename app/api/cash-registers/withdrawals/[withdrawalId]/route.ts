import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"

/**
 * GET /api/cash-registers/withdrawals/[withdrawalId]
 * Get withdrawal details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { withdrawalId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const withdrawal = await prisma.cashWithdrawal.findFirst({
      where: {
        id: params.withdrawalId,
        tenantId: user.tenantId,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        CashRegister: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            status: true,
            openingBalance: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(withdrawal)
  } catch (error) {
    console.error("Error fetching withdrawal:", error)
    return NextResponse.json(
      { error: "Failed to fetch withdrawal" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cash-registers/withdrawals/[withdrawalId]
 * Void a withdrawal (only same day, requires admin)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { withdrawalId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin or super admin role
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can void withdrawals" },
        { status: 403 }
      )
    }

    // Get withdrawal
    const withdrawal = await prisma.cashWithdrawal.findFirst({
      where: {
        id: params.withdrawalId,
        tenantId: user.tenantId,
      },
      include: {
        CashRegister: true,
      },
    })

    if (!withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      )
    }

    // Check if withdrawal is from today (same business day)
    const withdrawnDate = new Date(withdrawal.withdrawnAt)
    const today = new Date()
    const isSameDay =
      withdrawnDate.getFullYear() === today.getFullYear() &&
      withdrawnDate.getMonth() === today.getMonth() &&
      withdrawnDate.getDate() === today.getDate()

    if (!isSameDay && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Withdrawals can only be voided on the same day" },
        { status: 400 }
      )
    }

    // Check if cash register is still open (optional - allow voiding even if closed)
    // if (withdrawal.CashRegister?.status !== "OPEN") {
    //   return NextResponse.json(
    //     { error: "Cannot void withdrawal - cash register is closed" },
    //     { status: 400 }
    //   )
    // }

    // Void withdrawal in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if withdrawal was linked to a cash account
      // Search for cash account movement with matching reference
      const accountMovement = await tx.cashAccountMovement.findFirst({
        where: {
          reference: withdrawal.reference,
          tenantId: user.tenantId,
          concept: {
            contains: "Withdrawal from cash register",
          },
        },
        include: {
          cashAccount: true,
        },
      })

      // If there was an account movement, reverse it
      if (accountMovement) {
        const account = accountMovement.cashAccount
        const accountBalanceBefore = new Decimal(account.currentBalance.toString())
        const accountBalanceAfter = accountBalanceBefore.sub(
          new Decimal(withdrawal.amount.toString())
        )

        // Create reversal movement
        await tx.cashAccountMovement.create({
          data: {
            type: "RETURNED",
            amount: new Decimal(withdrawal.amount.toString()),
            concept: `VOID: Reversal of withdrawal ${withdrawal.reference}`,
            reference: `VOID-${withdrawal.reference}`,
            balanceBefore: accountBalanceBefore,
            balanceAfter: accountBalanceAfter,
            cashAccountId: account.id,
            tenantId: user.tenantId,
            userId: user.id,
          },
        })

        // Update account balance
        await tx.cashAccount.update({
          where: { id: account.id },
          data: { currentBalance: accountBalanceAfter },
        })
      }

      // Update withdrawal to mark as voided
      const voidedWithdrawal = await tx.cashWithdrawal.update({
        where: { id: params.withdrawalId },
        data: {
          concept: `VOIDED: ${withdrawal.concept}`,
          reference: `VOID-${withdrawal.reference}`,
        },
      })

      return {
        withdrawal: voidedWithdrawal,
        accountMovementReversed: !!accountMovement,
      }
    })

    return NextResponse.json({
      message: "Withdrawal voided successfully",
      ...result,
    })
  } catch (error) {
    console.error("Error voiding withdrawal:", error)
    return NextResponse.json(
      { error: "Failed to void withdrawal" },
      { status: 500 }
    )
  }
}
