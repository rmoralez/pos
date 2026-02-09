import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  taxRate: z.number().min(0).max(100),
})

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "QR", "CHECK", "OTHER"]),
  customerId: z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")

    const sales = await prisma.sale.findMany({
      where: {
        tenantId: user.tenantId,
        ...(user.locationId && { locationId: user.locationId }),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        customer: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error("GET sales error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!user.locationId) {
      return NextResponse.json(
        { error: "User must be assigned to a location" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = saleSchema.parse(body)

    // Create sale with items and payments in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Generate sale number
      const lastSale = await tx.sale.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
      })
      const nextNumber = lastSale ? parseInt(lastSale.saleNumber.split("-")[1]) + 1 : 1
      const saleNumber = `SALE-${nextNumber.toString().padStart(6, "0")}`

      // Calculate totals
      let subtotal = 0
      let taxAmount = 0

      const itemsData = await Promise.all(
        validatedData.items.map(async (item) => {
          // Verify product exists and belongs to tenant
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

          // Check stock
          const stock = await tx.stock.findFirst({
            where: {
              productId: item.productId,
              locationId: user.locationId!,
            },
          })

          if (!stock || stock.quantity < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}`)
          }

          // Calculate item totals
          const itemSubtotal = item.unitPrice * item.quantity
          const itemTaxAmount = (itemSubtotal * item.taxRate) / 100
          const itemTotal = itemSubtotal + itemTaxAmount

          subtotal += itemSubtotal
          taxAmount += itemTaxAmount

          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: itemSubtotal,
            taxRate: item.taxRate,
            taxAmount: itemTaxAmount,
            total: itemTotal,
            discount: 0,
          }
        })
      )

      const total = subtotal + taxAmount

      // Create sale
      const newSale = await tx.sale.create({
        data: {
          saleNumber,
          subtotal,
          taxAmount,
          discountAmount: 0,
          total,
          status: "COMPLETED",
          tenantId: user.tenantId,
          locationId: user.locationId!,
          userId: user.id,
          customerId: validatedData.customerId || null,
          items: {
            create: itemsData,
          },
          payments: {
            create: {
              amount: total,
              method: validatedData.paymentMethod,
            },
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
      })

      // Update stock and create stock movements
      for (const item of validatedData.items) {
        // Update stock
        await tx.stock.update({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: user.locationId!,
            },
          },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        })

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            productId: item.productId,
            userId: user.id,
            saleId: newSale.id,
            reason: `Venta ${saleNumber}`,
          },
        })
      }

      return newSale
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error: any) {
    console.error("POST sale error:", error)

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
