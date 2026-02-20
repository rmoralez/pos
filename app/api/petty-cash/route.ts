import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"

/**
 * GET /api/petty-cash
 * Returns the tenant's active petty cash fund with recent movements.
 * Auto-creates one if none exists.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  let fund = await prisma.pettyCashFund.findFirst({
    where: { tenantId, isActive: true },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { name: true } },
          cashAccount: { select: { id: true, name: true, type: true } },
          movementType: true,
        },
      },
    },
  })

  if (!fund) {
    fund = await prisma.pettyCashFund.create({
      data: { tenantId, name: "Caja Chica", currentBalance: 0 },
      include: {
        movements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { name: true } },
            cashAccount: { select: { id: true, name: true, type: true } },
            movementType: true,
          },
        },
      },
    })
  }

  return NextResponse.json(fund)
}

/**
 * POST /api/petty-cash
 * Create a movement: INCOME | EXPENSE | TRANSFER_OUT | TRANSFER_IN
 * Uses prisma.$transaction for atomic balance updates.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.tenantId || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId
  const userId = user.id

  try {
    const body = await request.json()
    const { type, amount, concept, reference, cashAccountId, movementTypeId } = body

    if (!type || !amount || !concept) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const amountDecimal = new Decimal(amount)
    if (amountDecimal.lte(0)) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
    }

    const validTypes = ["INCOME", "EXPENSE", "TRANSFER_OUT", "TRANSFER_IN"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get or create fund
      let fund = await tx.pettyCashFund.findFirst({
        where: { tenantId, isActive: true },
      })
      if (!fund) {
        fund = await tx.pettyCashFund.create({
          data: { tenantId, name: "Caja Chica", currentBalance: 0 },
        })
      }

      const balanceBefore = new Decimal(fund.currentBalance.toString())
      let delta: Decimal
      if (type === "INCOME" || type === "TRANSFER_IN") {
        delta = amountDecimal
      } else {
        delta = amountDecimal.neg()
      }
      const balanceAfter = balanceBefore.add(delta)

      if (balanceAfter.lt(0)) {
        throw new Error("Saldo insuficiente en Caja Chica")
      }

      // Create petty cash movement
      const movement = await tx.pettyCashMovement.create({
        data: {
          type,
          amount: amountDecimal,
          concept,
          reference: reference || null,
          balanceBefore,
          balanceAfter,
          cashAccountId: cashAccountId || null,
          movementTypeId: movementTypeId || null,
          pettyCashFundId: fund.id,
          tenantId,
          userId,
        },
      })

      // Update fund balance
      await tx.pettyCashFund.update({
        where: { id: fund.id },
        data: { currentBalance: balanceAfter },
      })

      // TRANSFER_OUT: credit the CashAccount
      if (type === "TRANSFER_OUT" && cashAccountId) {
        const account = await tx.cashAccount.findFirst({
          where: { id: cashAccountId, tenantId },
        })
        if (!account) throw new Error("Cuenta no encontrada")

        const accBefore = new Decimal(account.currentBalance.toString())
        const accAfter = accBefore.add(amountDecimal)

        await tx.cashAccountMovement.create({
          data: {
            type: "RECEIVED",
            amount: amountDecimal,
            concept: `Ingreso desde Caja Chica: ${concept}`,
            reference: reference || null,
            balanceBefore: accBefore,
            balanceAfter: accAfter,
            cashAccountId,
            tenantId,
            userId,
          },
        })

        await tx.cashAccount.update({
          where: { id: cashAccountId },
          data: { currentBalance: accAfter },
        })
      }

      // TRANSFER_IN: debit the CashAccount
      if (type === "TRANSFER_IN" && cashAccountId) {
        const account = await tx.cashAccount.findFirst({
          where: { id: cashAccountId, tenantId },
        })
        if (!account) throw new Error("Cuenta no encontrada")

        const accBefore = new Decimal(account.currentBalance.toString())
        const accAfter = accBefore.sub(amountDecimal)

        if (accAfter.lt(0)) throw new Error("Saldo insuficiente en la cuenta")

        await tx.cashAccountMovement.create({
          data: {
            type: "RETURNED",
            amount: amountDecimal,
            concept: `Devolución a Caja Chica: ${concept}`,
            reference: reference || null,
            balanceBefore: accBefore,
            balanceAfter: accAfter,
            cashAccountId,
            tenantId,
            userId,
          },
        })

        await tx.cashAccount.update({
          where: { id: cashAccountId },
          data: { currentBalance: accAfter },
        })
      }

      return movement
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Petty cash error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
