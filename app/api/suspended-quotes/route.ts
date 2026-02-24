import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const suspendedQuoteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cartData: z.string(),
  customerId: z.string().optional(),
  notes: z.string().optional(),
})

// GET - List suspended quotes
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const suspended = await prisma.suspendedQuote.findMany({
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
    console.error("Error fetching suspended quotes:", error)
    return NextResponse.json(
      { error: "Failed to fetch suspended quotes" },
      { status: 500 }
    )
  }
}

// POST - Create suspended quote
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = suspendedQuoteSchema.parse(body)

    const suspended = await prisma.suspendedQuote.create({
      data: {
        name: data.name,
        cartData: data.cartData,
        customerId: data.customerId,
        notes: data.notes,
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

    console.error("Error creating suspended quote:", error)
    return NextResponse.json(
      { error: "Failed to create suspended quote" },
      { status: 500 }
    )
  }
}
