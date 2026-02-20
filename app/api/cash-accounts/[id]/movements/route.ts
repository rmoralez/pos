import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"

/**
 * POST /api/cash-accounts/[id]/movements
 * Create a manual movement on a cash account (PAID or RECEIVED).
 * Uses prisma.$transaction for atomic balance updates.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId
  const userId = user.id

  try {
    const body = await request.json()
    const { type, amount, concept, reference, movementTypeId } = body

    if (!type || !amount || !concept) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    const validTypes = ["PAID", "RECEIVED"]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Tipo de movimiento inválido" },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.cashAccount.findFirst({
        where: { id: params.id, tenantId },
      })
      if (!account) throw new Error("Cuenta no encontrada")

      const amountDecimal = new Decimal(amount)
      if (amountDecimal.lte(0)) throw new Error("El monto debe ser mayor a 0")

      const balanceBefore = new Decimal(account.currentBalance.toString())
      let balanceAfter: Decimal

      if (type === "PAID") {
        balanceAfter = balanceBefore.sub(amountDecimal)
        if (balanceAfter.lt(0)) throw new Error("Saldo insuficiente en la cuenta")
      } else {
        // RECEIVED
        balanceAfter = balanceBefore.add(amountDecimal)
      }

      const movement = await tx.cashAccountMovement.create({
        data: {
          type,
          amount: amountDecimal,
          concept,
          reference: reference || null,
          balanceBefore,
          balanceAfter,
          cashAccountId: params.id,
          movementTypeId: movementTypeId || null,
          tenantId,
          userId,
        },
      })

      await tx.cashAccount.update({
        where: { id: params.id },
        data: { currentBalance: balanceAfter },
      })

      return movement
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Cash account movement error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
