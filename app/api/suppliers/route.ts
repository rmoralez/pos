import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  cuit: z.string().optional(),
  address: z.string().optional(),
})

/**
 * GET /api/suppliers
 * Get all suppliers for the tenant
 * Optional filters: search (name, email, phone, cuit)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""

    const suppliers = await prisma.supplier.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { cuit: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        SupplierAccount: {
          select: {
            balance: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            PurchaseOrder: true,
            SupplierInvoice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error("GET suppliers error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier with associated account
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = supplierSchema.parse(body)

    // Check if email already exists for this tenant (if email provided)
    if (validatedData.email) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          tenantId: user.tenantId,
          email: validatedData.email,
          isActive: true,
        },
      })

      if (existingSupplier) {
        return NextResponse.json(
          { error: "Supplier with this email already exists" },
          { status: 400 }
        )
      }
    }

    // Check if CUIT already exists for this tenant (if CUIT provided)
    if (validatedData.cuit) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          tenantId: user.tenantId,
          cuit: validatedData.cuit,
          isActive: true,
        },
      })

      if (existingSupplier) {
        return NextResponse.json(
          { error: "Supplier with this CUIT already exists" },
          { status: 400 }
        )
      }
    }

    // Create supplier and account in a transaction
    const supplier = await prisma.supplier.create({
      data: {
        ...validatedData,
        email: validatedData.email || null,
        tenantId: user.tenantId,
        SupplierAccount: {
          create: {
            id: crypto.randomUUID(),
            balance: 0,
            creditLimit: 0,
            isActive: true,
            tenantId: user.tenantId,
            updatedAt: new Date(),
          },
        },
      },
      include: {
        SupplierAccount: true,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
