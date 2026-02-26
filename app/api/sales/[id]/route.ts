import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

/**
 * GET /api/sales/[id]
 * Get sale by ID with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sale = await prisma.sale.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        items: {
          include: {
            product: true,
            ProductVariant: true,
          },
        },
        payments: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        customer: true,
        cashRegister: {
          select: {
            id: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        invoice: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (error: any) {
    console.error("GET /api/sales/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
