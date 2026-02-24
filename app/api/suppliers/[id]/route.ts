import { NextRequest, NextResponse } from "next/server"
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
 * GET /api/suppliers/[id]
 * Get a specific supplier by ID with account details
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

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        SupplierAccount: {
          include: {
            SupplierInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                balance: true,
                status: true,
                invoiceDate: true,
                dueDate: true,
              },
              orderBy: { invoiceDate: "desc" },
              take: 10,
            },
          },
        },
        PurchaseOrder: {
          select: {
            id: true,
            purchaseNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        SupplierInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            balance: true,
            status: true,
            invoiceDate: true,
            dueDate: true,
          },
          orderBy: { invoiceDate: "desc" },
          take: 10,
        },
        SupplierPayment: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
          },
          orderBy: { paymentDate: "desc" },
          take: 10,
        },
        _count: {
          select: {
            PurchaseOrder: true,
            SupplierInvoice: true,
            SupplierPayment: true,
            products: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error("GET supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/suppliers/[id]
 * Update a supplier
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

    // Verify supplier belongs to tenant
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingSupplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = supplierSchema.parse(body)

    // Check if email is being changed and if it already exists
    if (validatedData.email && validatedData.email !== existingSupplier.email) {
      const emailExists = await prisma.supplier.findFirst({
        where: {
          tenantId: user.tenantId,
          email: validatedData.email,
          id: { not: params.id },
          isActive: true,
        },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: "Supplier with this email already exists" },
          { status: 400 }
        )
      }
    }

    // Check if CUIT is being changed and if it already exists
    if (validatedData.cuit && validatedData.cuit !== existingSupplier.cuit) {
      const cuitExists = await prisma.supplier.findFirst({
        where: {
          tenantId: user.tenantId,
          cuit: validatedData.cuit,
          id: { not: params.id },
          isActive: true,
        },
      })

      if (cuitExists) {
        return NextResponse.json(
          { error: "Supplier with this CUIT already exists" },
          { status: 400 }
        )
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        ...validatedData,
        email: validatedData.email || null,
      },
      include: {
        SupplierAccount: true,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Soft delete a supplier (set isActive to false)
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

    // Verify supplier belongs to tenant
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            PurchaseOrder: true,
            SupplierInvoice: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    // Prevent deletion if supplier has purchase orders or invoices
    if (supplier._count.PurchaseOrder > 0 || supplier._count.SupplierInvoice > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete supplier with ${supplier._count.PurchaseOrder} purchase orders and ${supplier._count.SupplierInvoice} invoices. Use soft delete instead.`,
        },
        { status: 400 }
      )
    }

    // Soft delete - set isActive to false
    await prisma.supplier.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
