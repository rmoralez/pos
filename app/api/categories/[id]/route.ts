import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const categoryId = params.id
    const body = await req.json()
    const validatedData = categoryUpdateSchema.parse(body)

    // Verify category exists and belongs to tenant
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, tenantId: user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Prevent circular hierarchy
    if (validatedData.parentId) {
      // Check if new parent would create a cycle
      const wouldCreateCycle = await checkCycle(categoryId, validatedData.parentId)
      if (wouldCreateCycle) {
        return NextResponse.json(
          { error: "No se puede crear una jerarquía circular de categorías" },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: validatedData,
      include: {
        parent: true,
        children: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT category error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const categoryId = params.id

    // Verify category exists and belongs to tenant
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, tenantId: user.tenantId },
      include: {
        children: true,
        products: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Prevent deletion if category has children
    if (existing.children.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una categoría que tiene subcategorías" },
        { status: 400 }
      )
    }

    // Prevent deletion if category has products
    if (existing.products.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una categoría que tiene productos asignados" },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id: categoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE category error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Helper function to check for circular hierarchies
async function checkCycle(categoryId: string, newParentId: string): Promise<boolean> {
  // If the new parent is the category itself, that's a cycle
  if (categoryId === newParentId) {
    return true
  }

  // Traverse up the parent chain to check if we encounter the category
  let currentParentId: string | null = newParentId

  while (currentParentId) {
    if (currentParentId === categoryId) {
      return true // Found a cycle
    }

    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    })

    currentParentId = parent?.parentId ?? null
  }

  return false // No cycle detected
}
