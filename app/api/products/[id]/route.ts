import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const productUpdateSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  trackStock: z.boolean().optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  brand: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        category: true,
        supplier: true,
        stock: true,
        alternativeCodes: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error("GET product error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = productUpdateSchema.parse(body)

    // Check product exists and belongs to tenant
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // If updating SKU, check it's not taken
    if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: {
          tenantId_sku: {
            tenantId: user.tenantId,
            sku: validatedData.sku,
          },
        },
      })

      if (duplicateSku) {
        return NextResponse.json(
          { error: "Product with this SKU already exists" },
          { status: 400 }
        )
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        category: true,
        supplier: true,
      },
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT product error:", error)
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

    // Check product exists and belongs to tenant
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Soft delete by marking as inactive
    await prisma.product.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "Product deleted successfully" })
  } catch (error) {
    console.error("DELETE product error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
