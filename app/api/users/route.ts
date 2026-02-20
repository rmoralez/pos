import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import bcrypt from "bcryptjs"

const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "CASHIER", "STOCK_MANAGER", "VIEWER"]),
  locationId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/users
 * Get all users for the tenant
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can list users
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        locationId: true,
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        _count: {
          select: {
            sales: true,
            cashRegisters: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("GET users error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create users
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = userCreateSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya existe en el sistema" },
        { status: 400 }
      )
    }

    // Verify location belongs to tenant if provided
    if (validatedData.locationId) {
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
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    const newUser = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        locationId: validatedData.locationId || null,
        isActive: validatedData.isActive,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        locationId: true,
        createdAt: true,
      },
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
