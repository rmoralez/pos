import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/cash-accounts/[id]
 * Returns account detail with movement history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  const account = await prisma.cashAccount.findFirst({
    where: { id: params.id, tenantId },
    include: {
      supplier: { select: { id: true, name: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { name: true } },
          movementType: true,
        },
      },
    },
  })

  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 })
  }

  return NextResponse.json(account)
}

/**
 * PATCH /api/cash-accounts/[id]
 * Update account name, description, type, or active status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  try {
    const body = await request.json()
    const { name, description, type, isActive } = body

    const account = await prisma.cashAccount.update({
      where: { id: params.id, tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(account)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Patch cash account error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/cash-accounts/[id]
 * Soft delete account (sets isActive to false).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "No tienes permisos para eliminar cuentas" },
      { status: 403 }
    )
  }

  const tenantId = user.tenantId

  try {
    // Check if account exists and belongs to tenant
    const account = await prisma.cashAccount.findFirst({
      where: { id: params.id, tenantId },
      include: { _count: { select: { movements: true } } },
    })

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      )
    }

    // Warn if account has movements
    if (account._count.movements > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar una cuenta con ${account._count.movements} movimientos registrados`,
        },
        { status: 400 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.cashAccount.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "Cuenta eliminada correctamente" })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Delete cash account error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
