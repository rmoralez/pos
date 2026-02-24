import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const variantUpdateSchema = z.object({
  variantValues: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  weight: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  depth: z.string().optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/products/[id]/variants/[variantId]
 * Get a single variant with detailed information
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the product belongs to this tenant
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Get the variant
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: params.variantId,
        productId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        Stock: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        SaleItem: {
          select: {
            id: true,
            quantity: true,
            sale: {
              select: {
                id: true,
                saleNumber: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10, // Last 10 sales
        },
      },
    })

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 })
    }

    // Format the response
    const formattedVariant = {
      ...variant,
      stockByLocation: variant.Stock.map((stock) => ({
        locationId: stock.locationId,
        locationName: stock.location.name,
        quantity: stock.quantity,
      })),
      totalStock: variant.Stock.reduce((sum, stock) => sum + stock.quantity, 0),
      recentSales: variant.SaleItem,
    }

    return NextResponse.json(formattedVariant)
  } catch (error) {
    console.error("GET variant error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/products/[id]/variants/[variantId]
 * Update a variant
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the product belongs to this tenant
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Verify the variant exists and belongs to this product
    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        id: params.variantId,
        productId: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingVariant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = variantUpdateSchema.parse(body)

    // If SKU is being updated, check uniqueness
    if (validatedData.sku && validatedData.sku !== existingVariant.sku) {
      const duplicateSku = await prisma.productVariant.findFirst({
        where: {
          tenantId: user.tenantId,
          sku: validatedData.sku,
          id: { not: params.variantId },
        },
      })

      if (duplicateSku) {
        return NextResponse.json(
          { error: "A variant with this SKU already exists" },
          { status: 400 }
        )
      }
    }

    // If variantValues is being updated, check uniqueness for this product
    if (
      validatedData.variantValues &&
      validatedData.variantValues !== existingVariant.variantValues
    ) {
      const duplicateVariant = await prisma.productVariant.findFirst({
        where: {
          productId: params.id,
          variantValues: validatedData.variantValues,
          id: { not: params.variantId },
        },
      })

      if (duplicateVariant) {
        return NextResponse.json(
          { error: "A variant with these attributes already exists for this product" },
          { status: 400 }
        )
      }
    }

    // Track price changes for history
    const priceChanged =
      (validatedData.costPrice && validatedData.costPrice !== Number(existingVariant.costPrice)) ||
      (validatedData.salePrice && validatedData.salePrice !== Number(existingVariant.salePrice))

    // Update the variant
    const variant = await prisma.$transaction(async (tx) => {
      const updatedVariant = await tx.productVariant.update({
        where: { id: params.variantId },
        data: {
          ...(validatedData.variantValues && { variantValues: validatedData.variantValues }),
          ...(validatedData.sku && { sku: validatedData.sku }),
          ...(validatedData.barcode !== undefined && { barcode: validatedData.barcode || null }),
          ...(validatedData.costPrice && { costPrice: validatedData.costPrice }),
          ...(validatedData.salePrice && { salePrice: validatedData.salePrice }),
          ...(validatedData.weight !== undefined && { weight: validatedData.weight || "0" }),
          ...(validatedData.width !== undefined && { width: validatedData.width || null }),
          ...(validatedData.height !== undefined && { height: validatedData.height || null }),
          ...(validatedData.depth !== undefined && { depth: validatedData.depth || null }),
          ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
          updatedByUserId: user.id,
          updatedAt: new Date(),
        },
      })

      // Create price history record if prices changed
      if (priceChanged) {
        await tx.productPriceHistory.create({
          data: {
            id: `pph_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            productVariantId: params.variantId,
            oldCostPrice: existingVariant.costPrice,
            oldSalePrice: existingVariant.salePrice,
            newCostPrice: validatedData.costPrice ?? existingVariant.costPrice,
            newSalePrice: validatedData.salePrice ?? existingVariant.salePrice,
            changeReason: "Manual update",
            changedByUserId: user.id,
            tenantId: user.tenantId,
          },
        })
      }

      return updatedVariant
    })

    // Fetch updated variant with stock
    const variantWithStock = await prisma.productVariant.findUnique({
      where: { id: variant.id },
      include: {
        Stock: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(variantWithStock)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT variant error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]/variants/[variantId]
 * Delete a variant (only if no stock movements or sales exist)
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the product belongs to this tenant
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Verify the variant exists
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: params.variantId,
        productId: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 })
    }

    // Check if variant has any stock movements
    const stockMovements = await prisma.stockMovement.count({
      where: { productVariantId: params.variantId },
    })

    if (stockMovements > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete variant with stock movements. Consider deactivating it instead.",
        },
        { status: 400 }
      )
    }

    // Check if variant has any sales
    const sales = await prisma.saleItem.count({
      where: { productVariantId: params.variantId },
    })

    if (sales > 0) {
      return NextResponse.json(
        { error: "Cannot delete variant with sales history. Consider deactivating it instead." },
        { status: 400 }
      )
    }

    // Check if variant has any purchase orders
    const purchaseOrders = await prisma.purchaseOrderItem.count({
      where: { productVariantId: params.variantId },
    })

    if (purchaseOrders > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete variant with purchase orders. Consider deactivating it instead.",
        },
        { status: 400 }
      )
    }

    // Delete the variant and its stock records
    await prisma.$transaction(async (tx) => {
      // Delete stock records
      await tx.stock.deleteMany({
        where: { productVariantId: params.variantId },
      })

      // Delete the variant
      await tx.productVariant.delete({
        where: { id: params.variantId },
      })

      // Check if this was the last variant for the product
      const remainingVariants = await tx.productVariant.count({
        where: { productId: params.id },
      })

      // If no variants remain, update product to mark hasVariants as false
      if (remainingVariants === 0) {
        await tx.product.update({
          where: { id: params.id },
          data: { hasVariants: false },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE variant error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
