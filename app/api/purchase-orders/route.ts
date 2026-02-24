import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const purchaseOrderItemSchema = z.object({
  productId: z.string().optional(),
  productVariantId: z.string().optional(),
  quantityOrdered: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
  notes: z.string().optional(),
})

const purchaseOrderExtraItemSchema = z.object({
  description: z.string().min(1),
  quantityReceived: z.coerce.number().int().min(0).default(0),
  unitCost: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
  notes: z.string().optional(),
  productId: z.string().optional(),
  productVariantId: z.string().optional(),
})

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  locationId: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required"),
  extraItems: z.array(purchaseOrderExtraItemSchema).optional(),
  notes: z.string().optional(),
  supplierInvoiceNumber: z.string().optional(),
  supplierRemitoNumber: z.string().optional(),
  supplierInvoiceDate: z.string().optional(), // ISO date string
  status: z.enum(["DRAFT", "PENDING", "APPROVED"]).default("PENDING"),
})

/**
 * GET /api/purchase-orders
 * Get all purchase orders for the tenant with filtering and pagination
 * Query params: status, supplierId, search (purchaseNumber), startDate, endDate, limit
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
      where.purchaseNumber = {
        contains: search,
        mode: "insensitive",
      }
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate),
      }
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate),
      }
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
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
        Location: {
          select: {
            id: true,
            name: true,
          },
        },
        User_PurchaseOrder_createdByUserIdToUser: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            PurchaseOrderItem: true,
            PurchaseOrderExtraItem: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json({ purchaseOrders })
  } catch (error) {
    console.error("GET purchase-orders error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/purchase-orders
 * Create a new purchase order with items and extra items
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = purchaseOrderSchema.parse(body)

    // Verify supplier exists and belongs to tenant
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

    // Determine location - use provided, user's location, or find default
    let locationId = validatedData.locationId || user.locationId

    if (!locationId) {
      const defaultLocation = await prisma.location.findFirst({
        where: {
          tenantId: user.tenantId,
          isActive: true,
        },
      })

      if (!defaultLocation) {
        return NextResponse.json(
          { error: "No location found. Please create a location first." },
          { status: 400 }
        )
      }

      locationId = defaultLocation.id
    } else {
      // Verify location belongs to tenant
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
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

    // Create purchase order in a transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Generate purchase order number atomically
      const maxResult = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX(CAST(SPLIT_PART("purchaseNumber", '-', 2) AS INTEGER)) AS max_num
        FROM "PurchaseOrder"
        WHERE "tenantId" = ${user.tenantId}
          AND "purchaseNumber" LIKE 'PO-%'
      `
      const maxNum = maxResult[0]?.max_num ? parseInt(String(maxResult[0].max_num)) : 0
      const nextNumber = maxNum + 1
      const purchaseNumber = `PO-${nextNumber.toString().padStart(6, "0")}`

      // Calculate totals
      let subtotal = 0
      let taxAmount = 0

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

          subtotal += itemSubtotal
          taxAmount += itemTaxAmount

          return {
            id: crypto.randomUUID(),
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

      // Process extra items (shipping, taxes, etc.)
      const extraItemsData = validatedData.extraItems
        ? await Promise.all(
            validatedData.extraItems.map(async (item) => {
              const itemTotal = item.unitCost * item.quantityReceived
              const itemTaxAmount = (itemTotal * item.taxRate) / 100
              const totalWithTax = itemTotal + itemTaxAmount

              subtotal += itemTotal
              taxAmount += itemTaxAmount

              return {
                id: crypto.randomUUID(),
                description: item.description,
                quantityReceived: item.quantityReceived,
                unitCost: item.unitCost,
                taxRate: item.taxRate,
                total: totalWithTax,
                notes: item.notes || null,
                productId: item.productId || null,
                productVariantId: item.productVariantId || null,
              }
            })
          )
        : []

      const total = subtotal + taxAmount

      // Create purchase order
      const newPurchaseOrder = await tx.purchaseOrder.create({
        data: {
          id: crypto.randomUUID(),
          purchaseNumber,
          subtotal,
          taxAmount,
          total,
          status: validatedData.status,
          notes: validatedData.notes || null,
          supplierInvoiceNumber: validatedData.supplierInvoiceNumber || null,
          supplierRemitoNumber: validatedData.supplierRemitoNumber || null,
          supplierInvoiceDate: validatedData.supplierInvoiceDate
            ? new Date(validatedData.supplierInvoiceDate)
            : null,
          supplierId: validatedData.supplierId,
          locationId,
          tenantId: user.tenantId,
          createdByUserId: user.id,
          updatedAt: new Date(),
          PurchaseOrderItem: {
            create: itemsData,
          },
          ...(extraItemsData.length > 0 && {
            PurchaseOrderExtraItem: {
              create: extraItemsData,
            },
          }),
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

      return newPurchaseOrder
    })

    return NextResponse.json(purchaseOrder, { status: 201 })
  } catch (error: any) {
    console.error("POST purchase-order error:", error)

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
