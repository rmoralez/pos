import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

/**
 * GET /api/products/[id]/price-history
 * Get price history for a product (including both product and variant price changes)
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

    // Get all price history for this product and its variants
    const priceHistory = await prisma.productPriceHistory.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          { productId: params.id },
          {
            ProductVariant: {
              productId: params.id,
            },
          },
        ],
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        ProductVariant: {
          select: {
            id: true,
            sku: true,
            variantValues: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(priceHistory)
  } catch (error) {
    console.error("GET price history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
