import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const tenantUpdateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  zipCode: z.string().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  afipPuntoVenta: z.number().int().positive().optional(),
})

/**
 * GET /api/tenants/current
 * Get current tenant information
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        cuit: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        zipCode: true,
        defaultTaxRate: true,
        afipPuntoVenta: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            locations: true,
            products: true,
            sales: true,
          },
        },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    console.error("GET tenant error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tenants/current
 * Update current tenant information
 */
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPER_ADMIN can update tenant settings
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = tenantUpdateSchema.parse(body)

    const tenant = await prisma.tenant.update({
      where: { id: user.tenantId },
      data: validatedData,
    })

    return NextResponse.json(tenant)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT tenant error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
