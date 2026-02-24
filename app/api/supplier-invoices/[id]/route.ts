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

const updateSupplierInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).optional(),
  invoiceDate: z.string().optional(), // ISO date string
  dueDate: z.string().optional(), // ISO date string
  items: z.array(supplierInvoiceItemSchema).min(1).optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/supplier-invoices/[id]
 * Get a single supplier invoice with all details
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoice = await prisma.supplierInvoice.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        SupplierInvoiceItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
              },
            },
            ProductVariant: {
              select: {
                id: true,
                sku: true,
                barcode: true,
                variantValues: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        Supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cuit: true,
            address: true,
          },
        },
        SupplierAccount: {
          select: {
            id: true,
            balance: true,
            creditLimit: true,
          },
        },
        PurchaseOrder: {
          select: {
            id: true,
            purchaseNumber: true,
            status: true,
            createdAt: true,
          },
        },
        SupplierPaymentAllocation: {
          include: {
            SupplierPayment: {
              select: {
                id: true,
                paymentNumber: true,
                amount: true,
                paymentMethod: true,
                paymentDate: true,
                reference: true,
                User: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        User: {
          select: {
            name: true,
            email: true,
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

    // Calculate if overdue
    const isOverdue =
      invoice.dueDate &&
      invoice.dueDate < new Date() &&
      (invoice.status === "PENDING" || invoice.status === "PARTIAL")

    return NextResponse.json({ ...invoice, isOverdue })
  } catch (error) {
    console.error("GET supplier-invoice error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/supplier-invoices/[id]
 * Update a supplier invoice (only if PENDING and no payments)
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = updateSupplierInvoiceSchema.parse(body)

    // Get existing invoice
    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        SupplierInvoiceItem: true,
        SupplierPaymentAllocation: true,
        SupplierAccount: true,
      },
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Cannot update if status is not PENDING
    if (existingInvoice.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot update invoice that is not in PENDING status" },
        { status: 400 }
      )
    }

    // Cannot update if there are payments allocated
    if (existingInvoice.SupplierPaymentAllocation.length > 0) {
      return NextResponse.json(
        { error: "Cannot update invoice that has payments allocated" },
        { status: 400 }
      )
    }

    // Update invoice in a transaction
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      let newSubtotal = Number(existingInvoice.subtotal)
      let newTaxAmount = Number(existingInvoice.taxAmount)
      let newTotal = Number(existingInvoice.total)

      // If items are being updated, recalculate totals
      if (validatedData.items) {
        // Delete old items
        await tx.supplierInvoiceItem.deleteMany({
          where: { supplierInvoiceId: params.id },
        })

        // Calculate new totals
        newSubtotal = 0
        newTaxAmount = 0

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

            newSubtotal += itemSubtotal
            newTaxAmount += itemTaxAmount

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

        newTotal = newSubtotal + newTaxAmount

        // Create new items
        await tx.supplierInvoiceItem.createMany({
          data: itemsData.map((item) => ({
            ...item,
            supplierInvoiceId: params.id,
          })),
        })

        // Update supplier account balance
        if (existingInvoice.SupplierAccount) {
          const oldTotal = Number(existingInvoice.total)
          const difference = newTotal - oldTotal

          await tx.supplierAccount.update({
            where: { id: existingInvoice.SupplierAccount.id },
            data: {
              balance: Number(existingInvoice.SupplierAccount.balance) + difference,
              updatedAt: new Date(),
            },
          })
        }
      }

      // Update invoice
      const updated = await tx.supplierInvoice.update({
        where: { id: params.id },
        data: {
          ...(validatedData.invoiceNumber && { invoiceNumber: validatedData.invoiceNumber }),
          ...(validatedData.invoiceDate && { invoiceDate: new Date(validatedData.invoiceDate) }),
          ...(validatedData.dueDate !== undefined && {
            dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
          }),
          ...(validatedData.notes !== undefined && { notes: validatedData.notes || null }),
          ...(validatedData.items && {
            subtotal: newSubtotal,
            taxAmount: newTaxAmount,
            total: newTotal,
            balance: newTotal, // Reset balance since there are no payments
          }),
          updatedAt: new Date(),
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

      return updated
    })

    return NextResponse.json(updatedInvoice)
  } catch (error: any) {
    console.error("PUT supplier-invoice error:", error)

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

/**
 * DELETE /api/supplier-invoices/[id]
 * Void/delete a supplier invoice (only if PENDING and no payments)
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get existing invoice
    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        SupplierPaymentAllocation: true,
        SupplierAccount: true,
      },
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Cannot delete if there are payments allocated
    if (existingInvoice.SupplierPaymentAllocation.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete invoice that has payments allocated" },
        { status: 400 }
      )
    }

    // Delete invoice and reverse account entry in a transaction
    await prisma.$transaction(async (tx) => {
      // Reverse supplier account entry (reduce debt)
      if (existingInvoice.SupplierAccount) {
        await tx.supplierAccount.update({
          where: { id: existingInvoice.SupplierAccount.id },
          data: {
            balance: Number(existingInvoice.SupplierAccount.balance) - Number(existingInvoice.total),
            updatedAt: new Date(),
          },
        })
      }

      // Delete invoice items (cascade delete)
      await tx.supplierInvoiceItem.deleteMany({
        where: { supplierInvoiceId: params.id },
      })

      // Delete invoice
      await tx.supplierInvoice.delete({
        where: { id: params.id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE supplier-invoice error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
