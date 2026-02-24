import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

/**
 * Allocation schema - allocating payment amount to specific invoices
 */
const allocationSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
})

/**
 * Payment creation schema
 */
const paymentSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethod: z.enum([
    "CASH",
    "BANK_TRANSFER",
    "CHECK",
    "DEBIT_NOTE",
    "CREDIT_NOTE",
    "ACCOUNT_CREDIT",
  ]),
  paymentDate: z.string(), // ISO date string
  reference: z.string().optional(),
  bankAccount: z.string().optional(),
  checkNumber: z.string().optional(),
  checkDate: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(allocationSchema).optional(),
})

/**
 * GET /api/supplier-payments
 * List all supplier payments with filtering
 * Query params: supplierId, paymentMethod, startDate, endDate, search, limit
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get("supplierId")
    const paymentMethod = searchParams.get("paymentMethod")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: any = {
      tenantId: user.tenantId,
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    if (search) {
      where.OR = [
        {
          paymentNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          reference: {
            contains: search,
            mode: "insensitive",
          },
        },
      ]
    }

    if (startDate) {
      where.paymentDate = {
        ...where.paymentDate,
        gte: new Date(startDate),
      }
    }

    if (endDate) {
      where.paymentDate = {
        ...where.paymentDate,
        lte: new Date(endDate),
      }
    }

    const payments = await prisma.supplierPayment.findMany({
      where,
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
    })

    // Calculate allocated amount for each payment
    const paymentsWithAllocated = payments.map((payment) => {
      const allocatedAmount = payment.SupplierPaymentAllocation.reduce(
        (sum, allocation) => sum + Number(allocation.amount),
        0
      )

      return {
        ...payment,
        allocatedAmount,
        unallocatedAmount: Number(payment.amount) - allocatedAmount,
      }
    })

    return NextResponse.json(paymentsWithAllocated)
  } catch (error) {
    console.error("GET supplier-payments error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-payments
 * Create a new supplier payment with invoice allocations
 *
 * Business logic:
 * 1. Create payment record
 * 2. Create allocations to invoices
 * 3. Update invoice paidAmount and status
 * 4. Update supplier account balance (credit - reduce debt)
 * All in a single transaction
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = paymentSchema.parse(body)

    // Verify supplier exists and belongs to tenant
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: validatedData.supplierId,
        tenantId: user.tenantId,
        isActive: true,
      },
      include: {
        SupplierAccount: true,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or inactive" },
        { status: 404 }
      )
    }

    // Ensure supplier has an account
    let supplierAccountId = supplier.SupplierAccount?.id

    if (!supplierAccountId) {
      const newAccount = await prisma.supplierAccount.create({
        data: {
          id: crypto.randomUUID(),
          supplierId: supplier.id,
          tenantId: user.tenantId,
          balance: 0,
          updatedAt: new Date(),
        },
      })
      supplierAccountId = newAccount.id
    }

    // Validate allocations if provided
    if (validatedData.allocations && validatedData.allocations.length > 0) {
      const totalAllocated = validatedData.allocations.reduce(
        (sum, alloc) => sum + alloc.amount,
        0
      )

      if (totalAllocated > validatedData.amount) {
        return NextResponse.json(
          { error: "Total allocated amount exceeds payment amount" },
          { status: 400 }
        )
      }

      // Verify all invoices belong to this supplier and have sufficient balance
      for (const allocation of validatedData.allocations) {
        const invoice = await prisma.supplierInvoice.findFirst({
          where: {
            id: allocation.invoiceId,
            supplierId: validatedData.supplierId,
            tenantId: user.tenantId,
            status: {
              in: ["PENDING", "PARTIAL"],
            },
          },
        })

        if (!invoice) {
          return NextResponse.json(
            {
              error: `Invoice ${allocation.invoiceId} not found, does not belong to this supplier, or is not payable`,
            },
            { status: 400 }
          )
        }

        // Prevent payment to disputed invoices
        if (invoice.status === "DISPUTED") {
          return NextResponse.json(
            {
              error: `Cannot allocate payment to disputed invoice ${invoice.invoiceNumber}. Please resolve the dispute first.`,
            },
            { status: 400 }
          )
        }

        if (Number(invoice.balance) < allocation.amount) {
          return NextResponse.json(
            {
              error: `Allocation amount for invoice ${invoice.invoiceNumber} exceeds remaining balance`,
            },
            { status: 400 }
          )
        }
      }
    }

    // Create payment with allocations in a transaction
    const payment = await prisma.$transaction(async (tx) => {
      // Generate payment number
      const lastPayment = await tx.supplierPayment.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
      })

      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")

      let nextNumber = 1
      if (lastPayment?.paymentNumber) {
        const match = lastPayment.paymentNumber.match(/-(\d+)$/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }

      const paymentNumber = `SP-${year}${month}-${String(nextNumber).padStart(6, "0")}`

      // Create payment record
      const newPayment = await tx.supplierPayment.create({
        data: {
          id: crypto.randomUUID(),
          paymentNumber,
          amount: validatedData.amount,
          paymentMethod: validatedData.paymentMethod,
          paymentDate: new Date(validatedData.paymentDate),
          reference: validatedData.reference || null,
          bankAccount: validatedData.bankAccount || null,
          checkNumber: validatedData.checkNumber || null,
          checkDate: validatedData.checkDate ? new Date(validatedData.checkDate) : null,
          notes: validatedData.notes || null,
          supplierId: validatedData.supplierId,
          tenantId: user.tenantId,
          createdByUserId: user.id,
          updatedAt: new Date(),
        },
      })

      // Process allocations
      if (validatedData.allocations && validatedData.allocations.length > 0) {
        for (const allocation of validatedData.allocations) {
          // Create allocation record
          await tx.supplierPaymentAllocation.create({
            data: {
              id: crypto.randomUUID(),
              amount: allocation.amount,
              supplierPaymentId: newPayment.id,
              supplierInvoiceId: allocation.invoiceId,
            },
          })

          // Get current invoice
          const invoice = await tx.supplierInvoice.findUnique({
            where: { id: allocation.invoiceId },
          })

          if (!invoice) {
            throw new Error(`Invoice ${allocation.invoiceId} not found`)
          }

          const newPaidAmount = Number(invoice.paidAmount) + allocation.amount
          const newBalance = Number(invoice.total) - newPaidAmount

          // Determine new status
          let newStatus = invoice.status
          if (newBalance <= 0) {
            newStatus = "PAID"
          } else if (newPaidAmount > 0) {
            newStatus = "PARTIAL"
          }

          // Update invoice
          await tx.supplierInvoice.update({
            where: { id: allocation.invoiceId },
            data: {
              paidAmount: newPaidAmount,
              balance: newBalance,
              status: newStatus,
              paidDate: newBalance <= 0 ? new Date() : invoice.paidDate,
              updatedAt: new Date(),
            },
          })
        }
      }

      // Update supplier account balance (credit - reduce debt we owe them)
      const currentAccount = await tx.supplierAccount.findUnique({
        where: { id: supplierAccountId! },
      })

      if (!currentAccount) {
        throw new Error("Supplier account not found")
      }

      const newBalance = Number(currentAccount.balance) - validatedData.amount

      await tx.supplierAccount.update({
        where: { id: supplierAccountId! },
        data: {
          balance: newBalance,
          updatedAt: new Date(),
        },
      })

      return newPayment
    })

    // Fetch the complete payment with relations
    const completePayment = await prisma.supplierPayment.findUnique({
      where: { id: payment.id },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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
              },
            },
          },
        },
      },
    })

    return NextResponse.json(completePayment, { status: 201 })
  } catch (error: any) {
    console.error("POST supplier-payment error:", error)

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
