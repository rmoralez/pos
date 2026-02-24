import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const suspendedSaleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cartData: z.string(),
  discountType: z.string().optional(),
  discountValue: z.number().optional(),
  customerId: z.string().optional(),
  locationId: z.string().optional(),
})

// GET - List suspended sales
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const suspended = await prisma.suspendedSale.findMany({
      where: {
        tenantId: user.tenantId,
      },
      include: {
        customer: {
          select: {
            id: true,
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
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(suspended)
  } catch (error) {
    console.error("Error fetching suspended sales:", error)
    return NextResponse.json(
      { error: "Failed to fetch suspended sales" },
      { status: 500 }
    )
  }
}

// POST - Create suspended sale
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = suspendedSaleSchema.parse(body)

    const suspended = await prisma.suspendedSale.create({
      data: {
        name: data.name,
        cartData: data.cartData,
        discountType: data.discountType,
        discountValue: data.discountValue,
        customerId: data.customerId,
        locationId: data.locationId || user.locationId,
        tenantId: user.tenantId,
        userId: user.id,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(suspended, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating suspended sale:", error)
    return NextResponse.json(
      { error: "Failed to create suspended sale" },
      { status: 500 }
    )
  }
}
