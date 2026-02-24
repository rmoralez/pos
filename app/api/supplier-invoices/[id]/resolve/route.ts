import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

const resolveSchema = z.object({
  resolution: z.string().min(1, "Resolution notes are required"),
  newStatus: z.enum(["PENDING", "PARTIAL", "PAID"], {
    errorMap: () => ({ message: "New status must be PENDING, PARTIAL, or PAID" }),
  }),
})

/**
 * POST /api/supplier-invoices/[id]/resolve
 * Resolve a disputed supplier invoice
 *
 * Business logic:
 * 1. Validate invoice exists and belongs to tenant
 * 2. Validate invoice is currently DISPUTED
 * 3. Update status to newStatus (PENDING, PARTIAL, or PAID)
 * 4. Append resolution notes to disputeReason (keep audit trail)
 * 5. Allow payments again
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

    // Only ADMIN can resolve disputes
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can resolve invoice disputes" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = resolveSchema.parse(body)

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

    // Validate invoice is disputed
    if (invoice.status !== "DISPUTED") {
      return NextResponse.json(
        { error: "Invoice is not currently disputed" },
        { status: 400 }
      )
    }

    // Validate newStatus is appropriate for current payment state
    if (data.newStatus === "PAID" && Number(invoice.balance) > 0) {
      return NextResponse.json(
        { error: "Cannot mark invoice as PAID while balance is pending" },
        { status: 400 }
      )
    }

    if (data.newStatus === "PARTIAL" && Number(invoice.paidAmount) === 0) {
      return NextResponse.json(
        { error: "Cannot mark invoice as PARTIAL without any payments" },
        { status: 400 }
      )
    }

    // Append resolution to dispute reason (keep audit trail)
    const resolutionNote = `\n\n--- RESOLVED ---\nResolution: ${data.resolution}\nResolved by: ${user.name || user.email}\nDate: ${new Date().toISOString()}`
    const updatedDisputeReason = (invoice.disputeReason || "") + resolutionNote

    // Update invoice to resolved status
    const updatedInvoice = await prisma.supplierInvoice.update({
      where: { id: params.id },
      data: {
        status: data.newStatus,
        disputeReason: updatedDisputeReason,
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
      message: `Invoice ${invoice.invoiceNumber} dispute resolved`,
    })
  } catch (error: any) {
    console.error("POST resolve error:", error)

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
