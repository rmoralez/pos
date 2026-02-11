import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, isActive } = body

    // Verificar que el tipo de movimiento existe y pertenece al tenant
    const movementType = await prisma.movementType.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
    })

    if (!movementType) {
      return NextResponse.json(
        { error: "Tipo de movimiento no encontrado" },
        { status: 404 }
      )
    }

    // No permitir editar tipos de sistema
    if (movementType.isSystem) {
      return NextResponse.json(
        { error: "No se pueden editar tipos de movimiento del sistema" },
        { status: 403 }
      )
    }

    // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
    if (name && name !== movementType.name) {
      const existing = await prisma.movementType.findFirst({
        where: {
          tenantId: session.user.tenantId,
          name,
          id: { not: params.id },
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: "Ya existe un tipo de movimiento con ese nombre" },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.movementType.update({
      where: { id: params.id },
      data: {
        name,
        description,
        isActive,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating movement type:", error)
    return NextResponse.json(
      { error: "Error al actualizar tipo de movimiento" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Verificar que el tipo de movimiento existe y pertenece al tenant
    const movementType = await prisma.movementType.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
    })

    if (!movementType) {
      return NextResponse.json(
        { error: "Tipo de movimiento no encontrado" },
        { status: 404 }
      )
    }

    // No permitir eliminar tipos de sistema
    if (movementType.isSystem) {
      return NextResponse.json(
        { error: "No se pueden eliminar tipos de movimiento del sistema" },
        { status: 403 }
      )
    }

    // Verificar si hay transacciones usando este tipo
    const transactionCount = await prisma.cashTransaction.count({
      where: { movementTypeId: params.id },
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar. Hay ${transactionCount} transacciones usando este tipo de movimiento`,
        },
        { status: 400 }
      )
    }

    await prisma.movementType.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting movement type:", error)
    return NextResponse.json(
      { error: "Error al eliminar tipo de movimiento" },
      { status: 500 }
    )
  }
}
