import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const variantAttributeSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").optional(),
  displayName: z.string().min(1, "El nombre para mostrar es requerido").optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// PUT /api/variant-attributes/[id] - Update a variant attribute
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can manage variant attributes
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar atributos de variantes" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validatedData = variantAttributeSchema.parse(body)

    // Check if attribute exists and belongs to tenant
    const existing = await prisma.variantAttribute.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Atributo no encontrado" },
        { status: 404 }
      )
    }

    // If name is being changed, check for conflicts
    if (validatedData.name && validatedData.name !== existing.name) {
      const conflict = await prisma.variantAttribute.findFirst({
        where: {
          tenantId: user.tenantId,
          name: validatedData.name,
          id: { not: params.id },
        },
      })

      if (conflict) {
        return NextResponse.json(
          { error: "Ya existe un atributo con ese nombre" },
          { status: 400 }
        )
      }
    }

    const attribute = await prisma.variantAttribute.update({
      where: { id: params.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.displayName && { displayName: validatedData.displayName }),
        ...(validatedData.sortOrder !== undefined && { sortOrder: validatedData.sortOrder }),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(attribute)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT variant-attribute error:", error)
    return NextResponse.json(
      { error: "Error al actualizar atributo de variante" },
      { status: 500 }
    )
  }
}

// DELETE /api/variant-attributes/[id] - Delete a variant attribute (soft delete)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can manage variant attributes
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar atributos de variantes" },
        { status: 403 }
      )
    }

    // Check if attribute exists and belongs to tenant
    const existing = await prisma.variantAttribute.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Atributo no encontrado" },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.variantAttribute.update({
      where: { id: params.id },
      data: { isActive: false, updatedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("DELETE variant-attribute error:", error)
    return NextResponse.json(
      { error: "Error al eliminar atributo de variante" },
      { status: 500 }
    )
  }
}
