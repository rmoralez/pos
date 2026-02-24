import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

// PUT /api/denominations/[id] - Update a denomination
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can manage denominations
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar denominaciones" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { value, label, sortOrder } = body

    // Check if denomination exists and belongs to tenant
    const existing = await prisma.cashDenomination.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Denominación no encontrada" },
        { status: 404 }
      )
    }

    // If value is being changed, check for conflicts
    if (value && parseFloat(value) !== Number(existing.value)) {
      const conflict = await prisma.cashDenomination.findFirst({
        where: {
          tenantId: user.tenantId,
          value: parseFloat(value),
          id: { not: params.id },
        },
      })

      if (conflict) {
        return NextResponse.json(
          { error: "Ya existe una denominación con ese valor" },
          { status: 400 }
        )
      }
    }

    const denomination = await prisma.cashDenomination.update({
      where: { id: params.id },
      data: {
        ...(value && { value: parseFloat(value) }),
        ...(label && { label }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
      },
    })

    return NextResponse.json(denomination)
  } catch (error: any) {
    console.error("Update denomination error:", error)
    return NextResponse.json(
      { error: "Error al actualizar denominación" },
      { status: 500 }
    )
  }
}

// DELETE /api/denominations/[id] - Delete a denomination
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can manage denominations
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar denominaciones" },
        { status: 403 }
      )
    }

    // Check if denomination exists and belongs to tenant
    const existing = await prisma.cashDenomination.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Denominación no encontrada" },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.cashDenomination.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete denomination error:", error)
    return NextResponse.json(
      { error: "Error al eliminar denominación" },
      { status: 500 }
    )
  }
}
