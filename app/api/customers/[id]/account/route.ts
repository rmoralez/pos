import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const updateSchema = z.object({
  creditLimit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

// GET /api/customers/[id]/account — get account (creates if not exists)
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Get or create account
    let account = await prisma.customerAccount.findUnique({
      where: { customerId: params.id },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!account) {
      account = await prisma.customerAccount.create({
        data: {
          customerId: params.id,
          tenantId: user.tenantId,
        },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error("GET customer account error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/customers/[id]/account — update credit limit, notes, isActive
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = updateSchema.parse(body)

    const account = await prisma.customerAccount.upsert({
      where: { customerId: params.id },
      create: {
        customerId: params.id,
        tenantId: user.tenantId,
        ...validatedData,
      },
      update: validatedData,
    })

    return NextResponse.json(account)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("PATCH customer account error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
