import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const supplierInvoiceItemSchema = z.object({
  productId: z.string().optional(),
  productVariantId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
})

const supplierInvoiceSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string(), // ISO date string
  dueDate: z.string().optional(), // ISO date string
  purchaseOrderId: z.string().optional(),
  items: z.array(supplierInvoiceItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  scannedInvoicePath: z.string().optional(),
})

/**
 * GET /api/supplier-invoices
 * Get all supplier invoices for the tenant with filtering
 * Query params: status, supplierId, search (invoiceNumber), startDate, endDate, limit
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const supplierId = searchParams.get("supplierId")
    const search = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: any = {
      tenantId: user.tenantId,
    }

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    if (search) {
      where.invoiceNumber = {
        contains: search,
        mode: "insensitive",
      }
    }

    if (startDate) {
      where.invoiceDate = {
        ...where.invoiceDate,
        gte: new Date(startDate),
      }
    }

    if (endDate) {
      where.invoiceDate = {
        ...where.invoiceDate,
        lte: new Date(endDate),
      }
    }

    const invoices = await prisma.supplierInvoice.findMany({
      where,
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
        PurchaseOrder: {
          select: {
            id: true,
            purchaseNumber: true,
          },
        },
        User: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            SupplierInvoiceItem: true,
            SupplierPaymentAllocation: true,
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
      take: limit,
    })

    // Calculate summary statistics
    const summary = {
      totalPayable: 0,
      overdueAmount: 0,
      paidThisMonth: 0,
    }

    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    invoices.forEach((invoice) => {
      // Total payable (unpaid + partial)
      if (invoice.status === "PENDING" || invoice.status === "PARTIAL") {
        summary.totalPayable += Number(invoice.balance)
      }

      // Overdue amount
      if (
        invoice.dueDate &&
        invoice.dueDate < now &&
        (invoice.status === "PENDING" || invoice.status === "PARTIAL")
      ) {
        summary.overdueAmount += Number(invoice.balance)
      }

      // Paid this month
      if (
        invoice.paidDate &&
        invoice.paidDate >= firstDayOfMonth &&
        invoice.status === "PAID"
      ) {
        summary.paidThisMonth += Number(invoice.total)
      }
    })

    return NextResponse.json({ invoices, summary })
  } catch (error) {
    console.error("GET supplier-invoices error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-invoices
 * Create a new supplier invoice
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = supplierInvoiceSchema.parse(body)

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
        { error: "Supplier not found" },
        { status: 404 }
      )
    }

    // Verify purchase order if provided
    if (validatedData.purchaseOrderId) {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: validatedData.purchaseOrderId,
          tenantId: user.tenantId,
          supplierId: validatedData.supplierId,
        },
      })

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: "Purchase order not found or does not belong to this supplier" },
          { status: 404 }
        )
      }
    }

    // Create invoice in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Calculate totals
      let subtotal = 0
      let taxAmount = 0

      // Validate items and calculate totals
      const itemsData = await Promise.all(
        validatedData.items.map(async (item) => {
          // Verify product/variant if provided
          if (item.productId) {
            const product = await tx.product.findFirst({
              where: {
                id: item.productId,
                tenantId: user.tenantId,
                isActive: true,
              },
            })

            if (!product) {
              throw new Error(`Product ${item.productId} not found`)
            }
          } else if (item.productVariantId) {
            const variant = await tx.productVariant.findFirst({
              where: {
                id: item.productVariantId,
                tenantId: user.tenantId,
                isActive: true,
              },
            })

            if (!variant) {
              throw new Error(`Product variant ${item.productVariantId} not found`)
            }
          }

          // Calculate item totals
          const itemSubtotal = item.unitCost * item.quantity
          const itemTaxAmount = (itemSubtotal * item.taxRate) / 100
          const itemTotal = itemSubtotal + itemTaxAmount

          subtotal += itemSubtotal
          taxAmount += itemTaxAmount

          return {
            id: crypto.randomUUID(),
            productId: item.productId || null,
            productVariantId: item.productVariantId || null,
            description: item.description,
            quantity: item.quantity,
            unitCost: item.unitCost,
            subtotal: itemSubtotal,
            taxRate: item.taxRate,
            taxAmount: itemTaxAmount,
            total: itemTotal,
          }
        })
      )

      const total = subtotal + taxAmount
      const balance = total // Initially, balance equals total

      // Ensure supplier account exists
      let supplierAccountId = supplier.SupplierAccount?.id

      if (!supplierAccountId) {
        const newAccount = await tx.supplierAccount.create({
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

      // Get current supplier account balance
      const currentAccount = await tx.supplierAccount.findUnique({
        where: { id: supplierAccountId },
      })

      if (!currentAccount) {
        throw new Error("Supplier account not found")
      }

      const balanceBefore = Number(currentAccount.balance)
      const balanceAfter = balanceBefore + total

      // Update supplier account balance (increase debt - we owe them)
      await tx.supplierAccount.update({
        where: { id: supplierAccountId },
        data: {
          balance: balanceAfter,
          updatedAt: new Date(),
        },
      })

      // Create invoice
      const newInvoice = await tx.supplierInvoice.create({
        data: {
          id: crypto.randomUUID(),
          invoiceNumber: validatedData.invoiceNumber,
          subtotal,
          taxAmount,
          total,
          paidAmount: 0,
          balance,
          invoiceDate: new Date(validatedData.invoiceDate),
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
          status: "PENDING",
          notes: validatedData.notes || null,
          scannedInvoicePath: validatedData.scannedInvoicePath || null,
          supplierId: validatedData.supplierId,
          supplierAccountId: supplierAccountId,
          purchaseOrderId: validatedData.purchaseOrderId || null,
          tenantId: user.tenantId,
          createdByUserId: user.id,
          updatedAt: new Date(),
          SupplierInvoiceItem: {
            create: itemsData,
          },
        },
        include: {
          SupplierInvoiceItem: {
            include: {
              Product: true,
              ProductVariant: true,
            },
          },
          Supplier: true,
          PurchaseOrder: true,
          User: true,
        },
      })

      return newInvoice
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    console.error("POST supplier-invoice error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: (error as any).message || "Internal server error" },
      { status: 500 }
    )
  }
}
