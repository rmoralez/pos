import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

/**
 * GET /api/stock/movements
 * Get stock movement history
 * Optional filters: productId, type, startDate, endDate
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("productId")
    const type = searchParams.get("type")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "100")

    const movements = await prisma.stockMovement.findMany({
      where: {
        product: {
          tenantId: user.tenantId,
        },
        ...(productId && { productId }),
        ...(type && { type: type as any }),
        ...(startDate && {
          createdAt: {
            gte: new Date(startDate),
          },
        }),
        ...(endDate && {
          createdAt: {
            lte: new Date(endDate),
          },
        }),
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sale: {
          select: {
            id: true,
            saleNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error("GET stock movements error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

const stockMovementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum([
    "PURCHASE",
    "SALE",
    "ADJUSTMENT",
    "TRANSFER",
    "RETURN",
    "LOSS",
  ]),
  quantity: z.number().int(),
  reason: z.string().optional(),
  locationId: z.string().min(1),
})

/**
 * POST /api/stock/movements
 * Create a stock movement (adjustment, purchase, etc.)
 * Note: SALE movements are automatically created by the POS system
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role - only stock managers and admins can create movements
    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = stockMovementSchema.parse(body)

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: {
        id: validatedData.productId,
        tenantId: user.tenantId,
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    // Verify location belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: validatedData.locationId,
        tenantId: user.tenantId,
      },
    })

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      )
    }

    // Create movement and update stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          productId: validatedData.productId,
          type: validatedData.type,
          quantity: validatedData.quantity,
          reason: validatedData.reason,
          userId: user.id,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // Update stock quantity
      // For PURCHASE, RETURN, ADJUSTMENT (positive): increase stock
      // For SALE, LOSS, ADJUSTMENT (negative): decrease stock
      const stockChange =
        validatedData.type === "PURCHASE" || validatedData.type === "RETURN"
          ? validatedData.quantity
          : validatedData.type === "SALE" || validatedData.type === "LOSS"
          ? -Math.abs(validatedData.quantity)
          : validatedData.quantity // ADJUSTMENT can be positive or negative

      // Find or create stock record for this location
      const existingStock = await tx.stock.findUnique({
        where: {
          productId_locationId: {
            productId: validatedData.productId,
            locationId: validatedData.locationId,
          },
        },
      })

      if (existingStock) {
        // Update existing stock
        const newQuantity = existingStock.quantity + stockChange

        if (newQuantity < 0) {
          throw new Error("Insufficient stock for this operation")
        }

        await tx.stock.update({
          where: {
            id: existingStock.id,
          },
          data: {
            quantity: newQuantity,
          },
        })
      } else {
        // Create new stock record
        if (stockChange < 0) {
          throw new Error("Cannot create stock with negative quantity")
        }

        await tx.stock.create({
          data: {
            productId: validatedData.productId,
            locationId: validatedData.locationId,
            quantity: stockChange,
          },
        })
      }

      return movement
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes("stock")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("POST stock movement error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
