import { NextResponse } from "next/server"
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
 * GET /api/locations
 * Get all locations for the tenant
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const locations = await prisma.location.findMany({
      where: { tenantId: user.tenantId },
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
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(locations)
  } catch (error) {
    console.error("GET locations error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/locations
 * Create a new location
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create locations
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = locationSchema.parse(body)

    const location = await prisma.location.create({
      data: {
        ...validatedData,
        tenantId: user.tenantId,
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST location error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
