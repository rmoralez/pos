import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const cancelSchema = z.object({
  cancellationNote: z.string().optional(),
})

/**
 * POST /api/purchase-orders/[id]/cancel
 * Cancel a purchase order
 * Only PENDING or APPROVED purchase orders can be cancelled
 * Adds cancellation note to the purchase order notes
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = cancelSchema.parse(body)

    // Check if purchase order exists and belongs to tenant
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      )
    }

    // Only PENDING, DRAFT, or APPROVED purchase orders can be cancelled
    if (
      purchaseOrder.status !== "PENDING" &&
      purchaseOrder.status !== "DRAFT" &&
      purchaseOrder.status !== "APPROVED"
    ) {
      return NextResponse.json(
        { error: `Purchase orders with status ${purchaseOrder.status} cannot be cancelled` },
        { status: 400 }
      )
    }

    // Build cancellation note
    let notes = purchaseOrder.notes || ""
    if (validatedData.cancellationNote) {
      const cancellationText = `\n\n[CANCELADA - ${new Date().toLocaleString("es-AR")}]\n${validatedData.cancellationNote}`
      notes += cancellationText
    } else {
      notes += `\n\n[CANCELADA - ${new Date().toLocaleString("es-AR")}]`
    }

    // Update purchase order status
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        notes: notes.trim(),
        updatedAt: new Date(),
      },
      include: {
        PurchaseOrderItem: {
          include: {
            Product: true,
            ProductVariant: true,
          },
        },
        PurchaseOrderExtraItem: true,
        Supplier: true,
        Location: true,
      },
    })

    return NextResponse.json(updatedPO)
  } catch (error: any) {
    console.error("POST cancel purchase-order error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: (error as any).message || "Internal server error" },
      { status: 500 }
    )
  }
}
