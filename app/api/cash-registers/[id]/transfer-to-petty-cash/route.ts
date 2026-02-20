import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const transferSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a cero"),
  notes: z.string().optional(),
})

/**
 * POST /api/cash-registers/[id]/transfer-to-petty-cash
 * Transfer cash from an open cash register to the petty cash fund.
 * Creates an atomic double-entry: expense in CashRegister + TRANSFER_IN in PettyCashFund.
 * Both records share the same transferId (stored in `reference` field) for audit traceability.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const data = transferSchema.parse(body)

    const amountDecimal = new Decimal(data.amount)
    const transferId = `TRANSFER-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const now = new Date()
    const dateStr = now.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify cash register is OPEN and belongs to tenant
      const cashRegister = await tx.cashRegister.findFirst({
        where: {
          id: params.id,
          tenantId: user.tenantId,
          status: "OPEN",
        },
      })

      if (!cashRegister) {
        throw new Error("La caja no existe o no está abierta")
      }

      // 2. Find or create the system MovementType for petty cash transfers (EXPENSE)
      let movementType = await tx.movementType.findFirst({
        where: {
          tenantId: user.tenantId,
          name: "Transferencia a Caja Chica",
          isSystem: true,
        },
      })

      if (!movementType) {
        movementType = await tx.movementType.create({
          data: {
            tenantId: user.tenantId,
            name: "Transferencia a Caja Chica",
            description: "Egreso de caja de ventas hacia la caja chica",
            transactionType: "EXPENSE",
            isSystem: true,
            isActive: true,
          },
        })
      }

      // 3. Create expense transaction in CashRegister
      const cashTransaction = await tx.cashTransaction.create({
        data: {
          cashRegisterId: params.id,
          userId: user.id,
          movementTypeId: movementType.id,
          amount: amountDecimal,
          reason: data.notes || "Transferencia a Caja Chica",
          reference: transferId,
        },
      })

      // 4. Find or auto-create PettyCashFund for tenant
      let fund = await tx.pettyCashFund.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
      })

      if (!fund) {
        fund = await tx.pettyCashFund.create({
          data: {
            tenantId: user.tenantId,
            name: "Caja Chica",
            currentBalance: new Decimal(0),
          },
        })
      }

      const balanceBefore = new Decimal(fund.currentBalance)
      const balanceAfter = balanceBefore.add(amountDecimal)

      // 5. Create TRANSFER_IN movement in PettyCashFund
      const pettyCashMovement = await tx.pettyCashMovement.create({
        data: {
          pettyCashFundId: fund.id,
          tenantId: user.tenantId,
          userId: user.id,
          type: "TRANSFER_IN",
          amount: amountDecimal,
          concept: `Transferencia desde Caja de Ventas - ${dateStr}`,
          balanceBefore,
          balanceAfter,
          reference: transferId,
        },
      })

      // 6. Update PettyCashFund balance
      await tx.pettyCashFund.update({
        where: { id: fund.id },
        data: { currentBalance: balanceAfter },
      })

      return {
        transferId,
        cashTransaction,
        pettyCashMovement,
        newPettyCashBalance: balanceAfter,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      )
    }

    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Error en transferencia a caja chica:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
