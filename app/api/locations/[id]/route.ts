import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/locations/[id]
 * Get a specific location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const location = await prisma.location.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
            stock: true,
            sales: true,
            cashRegisters: true,
          },
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error("GET location error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/locations/[id]
 * Update a location
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can update locations
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify location belongs to tenant
    const existingLocation = await prisma.location.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingLocation) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = locationSchema.parse(body)

    const location = await prisma.location.update({
      where: { id: params.id },
      data: validatedData,
    })

    return NextResponse.json(location)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT location error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/locations/[id]
 * Delete a location
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPER_ADMIN can delete locations
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify location belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
            stock: true,
            sales: true,
            cashRegisters: true,
          },
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    // Check if location has related data
    const hasData =
      location._count.users > 0 ||
      location._count.stock > 0 ||
      location._count.sales > 0 ||
      location._count.cashRegisters > 0

    if (hasData) {
      return NextResponse.json(
        {
          error: `Cannot delete location with associated data (${location._count.users} users, ${location._count.stock} stock items, ${location._count.sales} sales, ${location._count.cashRegisters} cash registers)`,
        },
        { status: 400 }
      )
    }

    await prisma.location.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE location error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
