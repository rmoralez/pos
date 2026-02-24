import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const receivedItemSchema = z.object({
  itemId: z.string(),
  quantityReceived: z.coerce.number().int().min(0),
  updateCostPrice: z.boolean().default(false),
  newCostPrice: z.coerce.number().positive().optional(),
})

const receiveSchema = z.object({
  receivedItems: z.array(receivedItemSchema).min(1, "At least one item must be received"),
  notes: z.string().optional(),
  receivingNotes: z.string().optional(),
})

/**
 * POST /api/purchase-orders/[id]/receive
 * Receive items from a purchase order (full or partial)
 * - Updates stock levels for received items
 * - Creates stock movements
 * - Updates PO status (PENDING -> APPROVED -> RECEIVED or APPROVED based on completion)
 * - Optionally updates product cost prices
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = receiveSchema.parse(body)

    // Check if purchase order exists and belongs to tenant
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        PurchaseOrderItem: {
          include: {
            Product: true,
            ProductVariant: true,
          },
        },
        Location: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      )
    }

    // Only PENDING or APPROVED purchase orders can receive items
    if (purchaseOrder.status !== "PENDING" && purchaseOrder.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Purchase orders with status ${purchaseOrder.status} cannot receive items` },
        { status: 400 }
      )
    }

    // Process receiving in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let allItemsFullyReceived = true

      // Process each received item
      for (const receivedItem of validatedData.receivedItems) {
        const poItem = purchaseOrder.PurchaseOrderItem.find(
          item => item.id === receivedItem.itemId
        )

        if (!poItem) {
          throw new Error(`Purchase order item ${receivedItem.itemId} not found`)
        }

        // Validate received quantity doesn't exceed ordered quantity
        const newTotalReceived = poItem.quantityReceived + receivedItem.quantityReceived
        if (newTotalReceived > poItem.quantityOrdered) {
          const productName = poItem.Product?.name || poItem.ProductVariant?.sku || "Unknown"
          throw new Error(
            `Cannot receive ${receivedItem.quantityReceived} units of ${productName}. ` +
            `Ordered: ${poItem.quantityOrdered}, Already received: ${poItem.quantityReceived}, ` +
            `Max remaining: ${poItem.quantityOrdered - poItem.quantityReceived}`
          )
        }

        // Skip if no quantity is being received
        if (receivedItem.quantityReceived === 0) {
          // Check if this item is not fully received
          if (newTotalReceived < poItem.quantityOrdered) {
            allItemsFullyReceived = false
          }
          continue
        }

        // Update purchase order item received quantity
        await tx.purchaseOrderItem.update({
          where: { id: receivedItem.itemId },
          data: {
            quantityReceived: newTotalReceived,
            receivingNotes: validatedData.receivingNotes || null,
          },
        })

        // Determine which product/variant we're working with
        const productId = poItem.productId
        const productVariantId = poItem.productVariantId

        if (!productId && !productVariantId) {
          throw new Error(`Item ${receivedItem.itemId} has no product or variant`)
        }

        // Update or create stock record
        if (productId) {
          // Regular product stock
          const existingStock = await tx.stock.findUnique({
            where: {
              productId_locationId: {
                productId,
                locationId: purchaseOrder.locationId,
              },
            },
          })

          if (existingStock) {
            await tx.stock.update({
              where: {
                productId_locationId: {
                  productId,
                  locationId: purchaseOrder.locationId,
                },
              },
              data: {
                quantity: {
                  increment: receivedItem.quantityReceived,
                },
              },
            })
          } else {
            await tx.stock.create({
              data: {
                id: crypto.randomUUID(),
                productId,
                locationId: purchaseOrder.locationId,
                quantity: receivedItem.quantityReceived,
                updatedAt: new Date(),
              },
            })
          }

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              id: crypto.randomUUID(),
              type: "PURCHASE",
              quantity: receivedItem.quantityReceived,
              productId,
              userId: user.id,
              reason: `Recepción OC ${purchaseOrder.purchaseNumber}${validatedData.receivingNotes ? ` - ${validatedData.receivingNotes}` : ""}`,
              createdAt: new Date(),
            },
          })

          // Update product cost price if requested
          if (receivedItem.updateCostPrice && receivedItem.newCostPrice) {
            const product = await tx.product.findUnique({
              where: { id: productId },
              select: { costPrice: true },
            })

            if (product) {
              await tx.product.update({
                where: { id: productId },
                data: { costPrice: new Decimal(receivedItem.newCostPrice) },
              })

              // Create price history record
              await tx.productPriceHistory.create({
                data: {
                  id: crypto.randomUUID(),
                  productId,
                  oldCostPrice: product.costPrice,
                  newCostPrice: new Decimal(receivedItem.newCostPrice),
                  changeReason: `Recepción OC ${purchaseOrder.purchaseNumber}`,
                  changedByUserId: user.id,
                  tenantId: user.tenantId,
                  createdAt: new Date(),
                },
              })
            }
          }
        } else if (productVariantId) {
          // Product variant stock
          const existingStock = await tx.stock.findUnique({
            where: {
              productVariantId_locationId: {
                productVariantId,
                locationId: purchaseOrder.locationId,
              },
            },
          })

          if (existingStock) {
            await tx.stock.update({
              where: {
                productVariantId_locationId: {
                  productVariantId,
                  locationId: purchaseOrder.locationId,
                },
              },
              data: {
                quantity: {
                  increment: receivedItem.quantityReceived,
                },
              },
            })
          } else {
            await tx.stock.create({
              data: {
                id: crypto.randomUUID(),
                productVariantId,
                locationId: purchaseOrder.locationId,
                quantity: receivedItem.quantityReceived,
                updatedAt: new Date(),
              },
            })
          }

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              id: crypto.randomUUID(),
              type: "PURCHASE",
              quantity: receivedItem.quantityReceived,
              productVariantId,
              userId: user.id,
              reason: `Recepción OC ${purchaseOrder.purchaseNumber}${validatedData.receivingNotes ? ` - ${validatedData.receivingNotes}` : ""}`,
              createdAt: new Date(),
            },
          })

          // Update variant cost price if requested
          if (receivedItem.updateCostPrice && receivedItem.newCostPrice) {
            const variant = await tx.productVariant.findUnique({
              where: { id: productVariantId },
              select: { costPrice: true },
            })

            if (variant) {
              await tx.productVariant.update({
                where: { id: productVariantId },
                data: {
                  costPrice: new Decimal(receivedItem.newCostPrice),
                  updatedAt: new Date(),
                },
              })

              // Create price history record
              await tx.productPriceHistory.create({
                data: {
                  id: crypto.randomUUID(),
                  productVariantId,
                  oldCostPrice: variant.costPrice,
                  newCostPrice: new Decimal(receivedItem.newCostPrice),
                  changeReason: `Recepción OC ${purchaseOrder.purchaseNumber}`,
                  changedByUserId: user.id,
                  tenantId: user.tenantId,
                  createdAt: new Date(),
                },
              })
            }
          }
        }

        // Check if this item is fully received
        if (newTotalReceived < poItem.quantityOrdered) {
          allItemsFullyReceived = false
        }
      }

      // Check if there are other items not in the received list
      for (const poItem of purchaseOrder.PurchaseOrderItem) {
        const wasReceived = validatedData.receivedItems.some(
          item => item.itemId === poItem.id
        )
        if (!wasReceived && poItem.quantityReceived < poItem.quantityOrdered) {
          allItemsFullyReceived = false
        }
      }

      // Determine new status based on receiving progress
      let newStatus = purchaseOrder.status
      let receivedByUserId = purchaseOrder.receivedByUserId
      let receivedAt = purchaseOrder.receivedAt

      if (allItemsFullyReceived) {
        newStatus = "RECEIVED"
        receivedByUserId = user.id
        receivedAt = new Date()
      } else if (purchaseOrder.status === "PENDING") {
        // First partial receive moves from PENDING to APPROVED
        newStatus = "APPROVED"
      }

      // Update purchase order
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          ...(validatedData.notes && { notes: validatedData.notes }),
          receivedByUserId,
          receivedAt,
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

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("POST receive purchase-order error:", error)

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
