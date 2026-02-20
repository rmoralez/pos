import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

/**
 * GET /api/stock
 * Get stock levels for all products
 * Optional filters: locationId, search (product name/SKU), lowStock
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get("locationId") || user.locationId
    const search = searchParams.get("search") || ""
    const lowStock = searchParams.get("lowStock") === "true"

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      )
    }

    // Get stock levels with product information
    const stockItems = await prisma.stock.findMany({
      where: {
        locationId,
        product: {
          tenantId: user.tenantId,
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
            ],
          }),
        },
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { product: { name: "asc" } },
      ],
    })

    // Filter by low stock if requested
    const filteredStock = lowStock
      ? stockItems.filter((item) => item.quantity <= item.product.minStock)
      : stockItems

    return NextResponse.json(filteredStock)
  } catch (error) {
    console.error("GET stock error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
