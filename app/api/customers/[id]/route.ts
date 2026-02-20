import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  address: z.string().optional(),
})

/**
 * GET /api/customers/[id]
 * Get a specific customer by ID
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

    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        sales: {
          select: {
            id: true,
            saleNumber: true,
            total: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("GET customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/[id]
 * Update a customer
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

    // Verify customer belongs to tenant
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = customerSchema.parse(body)

    // Check if email is being changed and if it already exists
    if (validatedData.email && validatedData.email !== existingCustomer.email) {
      const emailExists = await prisma.customer.findFirst({
        where: {
          tenantId: user.tenantId,
          email: validatedData.email,
          id: { not: params.id },
        },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: "Customer with this email already exists" },
          { status: 400 }
        )
      }
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...validatedData,
        email: validatedData.email || null,
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/[id]
 * Delete a customer
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

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            sales: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      )
    }

    // Check if customer has sales
    if (customer._count.sales > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete customer with ${customer._count.sales} associated sales`,
        },
        { status: 400 }
      )
    }

    await prisma.customer.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
