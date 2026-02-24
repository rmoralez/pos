import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

/**
 * GET /api/suppliers/[id]/account
 * Get supplier account details with all movements (invoices and payments)
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

    // Verify supplier belongs to tenant
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        SupplierAccount: {
          include: {
            SupplierInvoice: {
              include: {
                SupplierPaymentAllocation: {
                  include: {
                    SupplierPayment: {
                      select: {
                        paymentNumber: true,
                        paymentDate: true,
                        paymentMethod: true,
                      },
                    },
                  },
                },
              },
              orderBy: { invoiceDate: "desc" },
            },
          },
        },
        SupplierPayment: {
          include: {
            SupplierPaymentAllocation: {
              include: {
                SupplierInvoice: {
                  select: {
                    invoiceNumber: true,
                    invoiceDate: true,
                  },
                },
              },
            },
          },
          orderBy: { paymentDate: "desc" },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    if (!supplier.SupplierAccount) {
      return NextResponse.json(
        { error: "Supplier account not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      account: supplier.SupplierAccount,
      invoices: supplier.SupplierAccount.SupplierInvoice,
      payments: supplier.SupplierPayment,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        cuit: supplier.cuit,
        email: supplier.email,
        phone: supplier.phone,
      },
    })
  } catch (error) {
    console.error("GET supplier account error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
