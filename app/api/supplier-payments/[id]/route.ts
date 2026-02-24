import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/supplier-payments/[id]
 * Get a single supplier payment with all allocations and details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payment = await prisma.supplierPayment.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cuit: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        SupplierPaymentAllocation: {
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
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      )
    }

    // Calculate allocated and unallocated amounts
    const allocatedAmount = payment.SupplierPaymentAllocation.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0
    )

    const unallocatedAmount = Number(payment.amount) - allocatedAmount

    return NextResponse.json({
      ...payment,
      allocatedAmount,
      unallocatedAmount,
    })
  } catch (error) {
    console.error("GET supplier-payment/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/supplier-payments/[id]
 * Void a supplier payment
 * - Reverses all allocations
 * - Updates invoice statuses back
 * - Reverses supplier account entry
 * - Deletes payment record
 * All in a single transaction
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the payment with all allocations
    const payment = await prisma.supplierPayment.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        Supplier: {
          include: {
            SupplierAccount: true,
          },
        },
        SupplierPaymentAllocation: {
          include: {
            SupplierInvoice: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      )
    }

    // Check if payment can be voided (e.g., within same day or admin permission)
    // For now, we'll allow voiding any payment, but you can add restrictions here
    // const paymentDate = new Date(payment.paymentDate)
    // const now = new Date()
    // const isSameDay = paymentDate.toDateString() === now.toDateString()
    // if (!isSameDay && user.role !== 'ADMIN') {
    //   return NextResponse.json(
    //     { error: "Cannot void payment after the same day unless you are an admin" },
    //     { status: 403 }
    //   )
    // }

    // Void payment in a transaction
    await prisma.$transaction(async (tx) => {
      // Reverse all allocations
      for (const allocation of payment.SupplierPaymentAllocation) {
        const invoice = allocation.SupplierInvoice

        // Calculate new amounts
        const newPaidAmount = Number(invoice.paidAmount) - Number(allocation.amount)
        const newBalance = Number(invoice.total) - newPaidAmount

        // Determine new status
        let newStatus = invoice.status
        if (newBalance === Number(invoice.total)) {
          // Nothing paid
          newStatus = "PENDING"
        } else if (newBalance > 0 && newPaidAmount > 0) {
          // Partially paid
          newStatus = "PARTIAL"
        } else if (newBalance <= 0) {
          // Fully paid (shouldn't happen when voiding)
          newStatus = "PAID"
        }

        // Update invoice
        await tx.supplierInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            balance: newBalance,
            status: newStatus,
            paidDate: newStatus === "PAID" ? invoice.paidDate : null,
            updatedAt: new Date(),
          },
        })

        // Delete allocation record
        await tx.supplierPaymentAllocation.delete({
          where: { id: allocation.id },
        })
      }

      // Reverse supplier account entry (debit - increase debt again)
      if (payment.Supplier.SupplierAccount) {
        const currentBalance = Number(payment.Supplier.SupplierAccount.balance)
        const newBalance = currentBalance + Number(payment.amount)

        await tx.supplierAccount.update({
          where: { id: payment.Supplier.SupplierAccount.id },
          data: {
            balance: newBalance,
            updatedAt: new Date(),
          },
        })
      }

      // Delete payment record
      await tx.supplierPayment.delete({
        where: { id: payment.id },
      })
    })

    return NextResponse.json({ success: true, message: "Payment voided successfully" })
  } catch (error) {
    console.error("DELETE supplier-payment/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
