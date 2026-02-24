import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/payment-methods/accounts/[id]
 * Get a single payment method account mapping by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const mapping = await prisma.paymentMethodAccount.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        CashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    })

    if (!mapping) {
      return NextResponse.json(
        { error: "Mapeo no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(mapping)
  } catch (error) {
    console.error("Error fetching payment method account:", error)
    return NextResponse.json(
      { error: "Error al obtener mapeo de método de pago" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/payment-methods/accounts/[id]
 * Update a payment method account mapping.
 * Only allows changing the linked cash account, not the payment method itself.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is ADMIN or SUPER_ADMIN
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden editar mapeos" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { cashAccountId } = body

    // Validate required fields
    if (!cashAccountId) {
      return NextResponse.json(
        { error: "Cuenta es requerida" },
        { status: 400 }
      )
    }

    // Check if mapping exists and belongs to tenant
    const existing = await prisma.paymentMethodAccount.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Mapeo no encontrado" },
        { status: 404 }
      )
    }

    // Check if cash account exists and belongs to tenant
    const cashAccount = await prisma.cashAccount.findFirst({
      where: {
        id: cashAccountId,
        tenantId: user.tenantId,
      },
    })

    if (!cashAccount) {
      return NextResponse.json(
        { error: "La cuenta de efectivo no existe o no pertenece al tenant" },
        { status: 404 }
      )
    }

    if (!cashAccount.isActive) {
      return NextResponse.json(
        { error: "La cuenta de efectivo no está activa" },
        { status: 400 }
      )
    }

    // Update the mapping
    const updated = await prisma.paymentMethodAccount.update({
      where: {
        id: params.id,
      },
      data: {
        cashAccountId,
        updatedAt: new Date(),
      },
      include: {
        CashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating payment method account:", error)
    return NextResponse.json(
      { error: "Error al actualizar mapeo de método de pago" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/payment-methods/accounts/[id]
 * Delete a payment method account mapping.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is ADMIN or SUPER_ADMIN
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden eliminar mapeos" },
      { status: 403 }
    )
  }

  try {
    // Check if mapping exists and belongs to tenant
    const existing = await prisma.paymentMethodAccount.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Mapeo no encontrado" },
        { status: 404 }
      )
    }

    // Delete the mapping
    await prisma.paymentMethodAccount.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting payment method account:", error)
    return NextResponse.json(
      { error: "Error al eliminar mapeo de método de pago" },
      { status: 500 }
    )
  }
}
