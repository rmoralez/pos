import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const purchaseOrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  productVariantId: z.string().optional(),
  quantityOrdered: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
  notes: z.string().optional(),
})

const purchaseOrderExtraItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  quantityReceived: z.coerce.number().int().min(0).default(0),
  unitCost: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
  notes: z.string().optional(),
  productId: z.string().optional(),
  productVariantId: z.string().optional(),
})

const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().optional(),
  locationId: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1).optional(),
  extraItems: z.array(purchaseOrderExtraItemSchema).optional(),
  notes: z.string().optional(),
  supplierInvoiceNumber: z.string().optional(),
  supplierRemitoNumber: z.string().optional(),
  supplierInvoiceDate: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED"]).optional(),
  scannedInvoicePath: z.string().optional(),
  remitoFilePath: z.string().optional(),
})

/**
 * GET /api/purchase-orders/[id]
 * Get a single purchase order with all items and details
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

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        PurchaseOrderItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                costPrice: true,
              },
            },
            ProductVariant: {
              select: {
                id: true,
                sku: true,
                barcode: true,
                variantValues: true,
                costPrice: true,
              },
            },
          },
        },
        PurchaseOrderExtraItem: true,
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
        Location: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        User_PurchaseOrder_createdByUserIdToUser: {
          select: {
            name: true,
            email: true,
          },
        },
        User_PurchaseOrder_approvedByUserIdToUser: {
          select: {
            name: true,
            email: true,
          },
        },
        User_PurchaseOrder_receivedByUserIdToUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(purchaseOrder)
  } catch (error) {
    console.error("GET purchase-order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/purchase-orders/[id]
 * Update a purchase order (only if status is DRAFT or PENDING)
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

    // Check if purchase order exists and belongs to tenant
    const existingPO = await prisma.purchaseOrder.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingPO) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      )
    }

    // Only DRAFT and PENDING purchase orders can be updated
    if (existingPO.status !== "DRAFT" && existingPO.status !== "PENDING") {
      return NextResponse.json(
        { error: `Purchase orders with status ${existingPO.status} cannot be updated` },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = updatePurchaseOrderSchema.parse(body)

    // Verify supplier if provided
    if (validatedData.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: validatedData.supplierId,
          tenantId: user.tenantId,
          isActive: true,
        },
      })

      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier not found" },
          { status: 404 }
        )
      }
    }

    // Verify location if provided
    if (validatedData.locationId) {
      const location = await prisma.location.findFirst({
        where: {
          id: validatedData.locationId,
          tenantId: user.tenantId,
        },
      })

      if (!location) {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        )
      }
    }

    // Update purchase order in a transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(existingPO.subtotal)
      let taxAmount = new Decimal(existingPO.taxAmount)
      let total = new Decimal(existingPO.total)

      // If items are being updated, recalculate totals
      if (validatedData.items) {
        subtotal = new Decimal(0)
        taxAmount = new Decimal(0)

        // Validate products and calculate item totals
        const itemsData = await Promise.all(
          validatedData.items.map(async (item) => {
            if (!item.productId && !item.productVariantId) {
              throw new Error("Each item must have either productId or productVariantId")
            }

            // Verify product/variant exists and belongs to tenant
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
            const itemSubtotal = item.unitCost * item.quantityOrdered
            const itemTaxAmount = (itemSubtotal * item.taxRate) / 100
            const itemTotal = itemSubtotal + itemTaxAmount

            subtotal = subtotal.plus(itemSubtotal)
            taxAmount = taxAmount.plus(itemTaxAmount)

            return {
              id: item.id || crypto.randomUUID(),
              productId: item.productId || null,
              productVariantId: item.productVariantId || null,
              quantityOrdered: item.quantityOrdered,
              quantityReceived: 0,
              unitCost: item.unitCost,
              subtotal: itemSubtotal,
              taxRate: item.taxRate,
              taxAmount: itemTaxAmount,
              total: itemTotal,
              notes: item.notes || null,
            }
          })
        )

        // Delete existing items
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: params.id },
        })

        // Create new items
        await tx.purchaseOrderItem.createMany({
          data: itemsData.map(item => ({
            ...item,
            purchaseOrderId: params.id,
            createdAt: new Date(),
          })),
        })
      }

      // Handle extra items if provided
      if (validatedData.extraItems !== undefined) {
        // Delete existing extra items
        await tx.purchaseOrderExtraItem.deleteMany({
          where: { purchaseOrderId: params.id },
        })

        if (validatedData.extraItems.length > 0) {
          const extraItemsData = validatedData.extraItems.map(item => {
            const itemTotal = item.unitCost * item.quantityReceived
            const itemTaxAmount = (itemTotal * item.taxRate) / 100
            const totalWithTax = itemTotal + itemTaxAmount

            subtotal = subtotal.plus(itemTotal)
            taxAmount = taxAmount.plus(itemTaxAmount)

            return {
              id: item.id || crypto.randomUUID(),
              description: item.description,
              quantityReceived: item.quantityReceived,
              unitCost: item.unitCost,
              taxRate: item.taxRate,
              total: totalWithTax,
              notes: item.notes || null,
              productId: item.productId || null,
              productVariantId: item.productVariantId || null,
              purchaseOrderId: params.id,
              createdAt: new Date(),
            }
          })

          await tx.purchaseOrderExtraItem.createMany({
            data: extraItemsData,
          })
        }
      }

      total = subtotal.plus(taxAmount)

      // Update purchase order
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: params.id },
        data: {
          ...(validatedData.supplierId && { supplierId: validatedData.supplierId }),
          ...(validatedData.locationId && { locationId: validatedData.locationId }),
          ...(validatedData.notes !== undefined && { notes: validatedData.notes || null }),
          ...(validatedData.supplierInvoiceNumber !== undefined && {
            supplierInvoiceNumber: validatedData.supplierInvoiceNumber || null,
          }),
          ...(validatedData.supplierRemitoNumber !== undefined && {
            supplierRemitoNumber: validatedData.supplierRemitoNumber || null,
          }),
          ...(validatedData.supplierInvoiceDate !== undefined && {
            supplierInvoiceDate: validatedData.supplierInvoiceDate
              ? new Date(validatedData.supplierInvoiceDate)
              : null,
          }),
          ...(validatedData.scannedInvoicePath !== undefined && {
            scannedInvoicePath: validatedData.scannedInvoicePath || null,
          }),
          ...(validatedData.remitoFilePath !== undefined && {
            remitoFilePath: validatedData.remitoFilePath || null,
          }),
          ...(validatedData.status && { status: validatedData.status }),
          subtotal,
          taxAmount,
          total,
          updatedAt: new Date(),
        },
        include: {
          PurchaseOrderItem: {
            include: {
              Product: true,
              ProductVariant: true,
            },
          },
          PurchaseOrderExtraItem: true,
          Supplier: true,
          Location: true,
        },
      })

      return updatedPO
    })

    return NextResponse.json(purchaseOrder)
  } catch (error: any) {
    console.error("PUT purchase-order error:", error)

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
 * DELETE /api/purchase-orders/[id]
 * Soft delete a purchase order (mark as CANCELLED)
 * Only DRAFT or PENDING purchase orders can be cancelled
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

    // Check if purchase order exists and belongs to tenant
    const existingPO = await prisma.purchaseOrder.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingPO) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      )
    }

    // Only DRAFT or PENDING purchase orders can be cancelled
    if (existingPO.status !== "DRAFT" && existingPO.status !== "PENDING") {
      return NextResponse.json(
        { error: `Purchase orders with status ${existingPO.status} cannot be cancelled` },
        { status: 400 }
      )
    }

    // Update status to CANCELLED
    await prisma.purchaseOrder.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE purchase-order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
