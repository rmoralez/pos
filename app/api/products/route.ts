import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const productSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  costPrice: z.number().positive(),
  salePrice: z.number().positive(),
  taxRate: z.number().min(0).max(100).default(21),
  trackStock: z.boolean().default(true),
  minStock: z.number().int().min(0).default(0),
  maxStock: z.number().int().min(0).optional(),
  unit: z.string().default("UNIDAD"),
  brand: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category")
    const isActive = searchParams.get("isActive")

    const products = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(category && { categoryId: category }),
        ...(isActive !== null && { isActive: isActive === "true" }),
      },
      include: {
        category: true,
        supplier: true,
        stock: {
          where: user.locationId ? { locationId: user.locationId } : undefined,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("GET products error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = productSchema.parse(body)

    // Check if SKU already exists for this tenant
    const existingProduct = await prisma.product.findUnique({
      where: {
        tenantId_sku: {
          tenantId: user.tenantId,
          sku: validatedData.sku,
        },
      },
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: "Product with this SKU already exists" },
        { status: 400 }
      )
    }

    // Create product with initial stock
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          ...validatedData,
          tenantId: user.tenantId,
        },
      })

      // Create initial stock if specified (support both 'initialStock' and 'stock' fields)
      const stockQuantity = body.initialStock ?? body.stock
      if (stockQuantity !== undefined) {
        // Get or create location for stock
        let locationId = user.locationId

        if (!locationId) {
          // Find or create default location for this tenant
          let defaultLocation = await tx.location.findFirst({
            where: {
              tenantId: user.tenantId,
            },
          })

          if (!defaultLocation) {
            // Create a default location
            defaultLocation = await tx.location.create({
              data: {
                tenantId: user.tenantId,
                name: "Sucursal Principal",
                address: "",
                isMain: true,
              },
            })
          }

          locationId = defaultLocation.id
        }

        await tx.stock.create({
          data: {
            productId: newProduct.id,
            locationId,
            quantity: stockQuantity || 0,
          },
        })
      }

      return newProduct
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST product error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
