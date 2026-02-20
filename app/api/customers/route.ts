import { NextResponse } from "next/server"
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
 * GET /api/customers
 * Get all customers for the tenant
 * Optional filters: search (name, email, phone, documentNumber)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { documentNumber: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        _count: {
          select: {
            sales: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("GET customers error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers
 * Create a new customer
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = customerSchema.parse(body)

    // Check if email already exists for this tenant (if email provided)
    if (validatedData.email) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          tenantId: user.tenantId,
          email: validatedData.email,
        },
      })

      if (existingCustomer) {
        return NextResponse.json(
          { error: "Customer with this email already exists" },
          { status: 400 }
        )
      }
    }

    const customer = await prisma.customer.create({
      data: {
        ...validatedData,
        email: validatedData.email || null,
        tenantId: user.tenantId,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
