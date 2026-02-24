import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const disputeSchema = z.object({
  disputeReason: z.string().min(1, "Dispute reason is required"),
})

/**
 * POST /api/supplier-invoices/[id]/dispute
 * Mark a supplier invoice as disputed
 *
 * Business logic:
 * 1. Validate invoice exists and belongs to tenant
 * 2. Validate invoice is in PENDING or PARTIAL status (can't dispute PAID/CANCELLED/DISPUTED)
 * 3. Update status to DISPUTED
 * 4. Set disputeReason field
 * 5. Prevent payment allocation while disputed (handled by payment route)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can dispute invoices
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can dispute invoices" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = disputeSchema.parse(body)

    // Fetch the invoice with multi-tenant isolation
    const invoice = await prisma.supplierInvoice.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Validate invoice can be disputed
    if (invoice.status === "DISPUTED") {
      return NextResponse.json(
        { error: "Invoice is already disputed" },
        { status: 400 }
      )
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot dispute a fully paid invoice" },
        { status: 400 }
      )
    }

    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot dispute a cancelled invoice" },
        { status: 400 }
      )
    }

    // Update invoice to disputed status
    const updatedInvoice = await prisma.supplierInvoice.update({
      where: { id: params.id },
      data: {
        status: "DISPUTED",
        disputeReason: data.disputeReason,
        updatedAt: new Date(),
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: `Invoice ${invoice.invoiceNumber} marked as disputed`,
    })
  } catch (error: any) {
    console.error("POST dispute error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
