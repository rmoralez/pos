import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const variantSchema = z.object({
  variantValues: z.string().min(1), // JSON string of {size: "L", color: "Red"}
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.number().positive(),
  salePrice: z.number().positive(),
  weight: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  depth: z.string().optional(),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/products/[id]/variants
 * List all variants for a specific product with stock information
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
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

    // Get all variants with stock information
    const variants = await prisma.productVariant.findMany({
      where: {
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
      },
      orderBy: { createdAt: "asc" },
    })

    // Transform variants to include formatted stock data
    const formattedVariants = variants.map((variant) => ({
      ...variant,
      stockByLocation: variant.Stock.map((stock) => ({
        locationId: stock.locationId,
        locationName: stock.location.name,
        quantity: stock.quantity,
      })),
      totalStock: variant.Stock.reduce((sum, stock) => sum + stock.quantity, 0),
    }))

    return NextResponse.json(formattedVariants)
  } catch (error) {
    console.error("GET variants error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/variants
 * Create a new variant for a product
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

    const body = await req.json()
    const validatedData = variantSchema.parse(body)

    // Generate SKU if not provided
    let variantSku = validatedData.sku
    if (!variantSku) {
      // Parse variant values to create a suffix
      try {
        const variantObj = JSON.parse(validatedData.variantValues)
        const suffix = Object.values(variantObj).join("-").toUpperCase().replace(/\s+/g, "")
        variantSku = `${product.sku || product.id.slice(0, 8)}-${suffix}`
      } catch {
        // If parsing fails, use a timestamp-based suffix
        variantSku = `${product.sku || product.id.slice(0, 8)}-${Date.now()}`
      }
    }

    // Check SKU uniqueness within tenant
    const existingVariant = await prisma.productVariant.findUnique({
      where: {
        tenantId_sku: {
          tenantId: user.tenantId,
          sku: variantSku,
        },
      },
    })

    if (existingVariant) {
      return NextResponse.json(
        { error: "A variant with this SKU already exists" },
        { status: 400 }
      )
    }

    // Check if variant with same values already exists for this product
    const duplicateVariant = await prisma.productVariant.findUnique({
      where: {
        productId_variantValues: {
          productId: params.id,
          variantValues: validatedData.variantValues,
        },
      },
    })

    if (duplicateVariant) {
      return NextResponse.json(
        { error: "A variant with these attributes already exists for this product" },
        { status: 400 }
      )
    }

    // Create variant and initial stock records in a transaction
    const variant = await prisma.$transaction(async (tx) => {
      // Create the variant
      const newVariant = await tx.productVariant.create({
        data: {
          id: `pv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          productId: params.id,
          tenantId: user.tenantId,
          sku: variantSku,
          barcode: validatedData.barcode || null,
          variantValues: validatedData.variantValues,
          costPrice: validatedData.costPrice,
          salePrice: validatedData.salePrice,
          weight: validatedData.weight || "0",
          width: validatedData.width || null,
          height: validatedData.height || null,
          depth: validatedData.depth || null,
          isActive: validatedData.isActive,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          updatedAt: new Date(),
        },
      })

      // Get all locations for this tenant
      const locations = await tx.location.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
        },
      })

      // Create stock records for all locations with initial quantity 0
      if (locations.length > 0) {
        await Promise.all(
          locations.map((location) =>
            tx.stock.create({
              data: {
                id: `stk_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                productVariantId: newVariant.id,
                locationId: location.id,
                quantity: 0,
              },
            })
          )
        )
      }

      // Update parent product to mark it has variants
      await tx.product.update({
        where: { id: params.id },
        data: { hasVariants: true },
      })

      return newVariant
    })

    // Fetch the variant with stock information
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

    return NextResponse.json(variantWithStock, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST variant error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
