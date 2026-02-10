import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100),
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
    const cashRegisterId = searchParams.get("cashRegisterId")

    const sales = await prisma.sale.findMany({
      where: {
        tenantId: user.tenantId,
        ...(user.locationId && { locationId: user.locationId }),
        ...(cashRegisterId && { cashRegisterId }),
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

    return NextResponse.json({ sales })
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
    console.log("[SALES API] Starting POST request")
    const user = await getCurrentUser()
    console.log("[SALES API] User:", user?.id, user?.email, "tenantId:", user?.tenantId)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Determine location - use user's location or find default
    let locationId = user.locationId
    console.log("[SALES API] User locationId:", locationId)

    if (!locationId) {
      // Find default location for this tenant
      const defaultLocation = await prisma.location.findFirst({
        where: {
          tenantId: user.tenantId,
        },
      })
      console.log("[SALES API] Default location found:", defaultLocation?.id, defaultLocation?.name)

      if (!defaultLocation) {
        console.error("[SALES API] No location found for tenant:", user.tenantId)
        return NextResponse.json(
          { error: "No location found. Please create a location first." },
          { status: 400 }
        )
      }

      locationId = defaultLocation.id
    }
    console.log("[SALES API] Using locationId:", locationId)

    // Check if there's an open cash register - prefer location-specific, fall back to any
    console.log("[SALES API] Searching for cash register at location:", locationId)
    let openCashRegister = await prisma.cashRegister.findFirst({
      where: {
        tenantId: user.tenantId,
        locationId,
        status: "OPEN",
      },
    })
    console.log("[SALES API] Location-specific cash register:", openCashRegister?.id)

    // If no cash register for this location, find any open one for tenant
    if (!openCashRegister) {
      console.log("[SALES API] No location-specific register, searching tenant-wide")
      openCashRegister = await prisma.cashRegister.findFirst({
        where: {
          tenantId: user.tenantId,
          status: "OPEN",
        },
        include: {
          location: true,
        },
      })
      console.log("[SALES API] Tenant-wide cash register:", openCashRegister?.id, "at location:", openCashRegister?.locationId)

      // Use the cash register's location if found
      if (openCashRegister) {
        locationId = openCashRegister.locationId
        console.log("[SALES API] Updated locationId to cash register's location:", locationId)
      }
    }

    if (!openCashRegister) {
      console.error("[SALES API] No open cash register found")
      return NextResponse.json(
        { error: "No open cash register. Please open a cash register before making sales." },
        { status: 400 }
      )
    }

    const body = await req.json()
    console.log("[SALES API] Request body:", body)
    const validatedData = saleSchema.parse(body)
    console.log("[SALES API] Validated data:", validatedData)

    // Create sale with items and payments in a transaction
    console.log("[SALES API] Starting transaction")
    const sale = await prisma.$transaction(async (tx) => {
      console.log("[SALES API TX] Generating sale number")
      // Generate sale number
      const lastSale = await tx.sale.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
      })
      const nextNumber = lastSale ? parseInt(lastSale.saleNumber.split("-")[1]) + 1 : 1
      const saleNumber = `SALE-${nextNumber.toString().padStart(6, "0")}`
      console.log("[SALES API TX] Sale number:", saleNumber)

      // Calculate totals
      let subtotal = 0
      let taxAmount = 0

      console.log("[SALES API TX] Processing items:", validatedData.items.length)
      const itemsData = await Promise.all(
        validatedData.items.map(async (item, index) => {
          console.log(`[SALES API TX] Processing item ${index + 1}:`, item.productId)
          // Verify product exists and belongs to tenant
          const product = await tx.product.findFirst({
            where: {
              id: item.productId,
              tenantId: user.tenantId,
              isActive: true,
            },
          })
          console.log(`[SALES API TX] Product found:`, product?.name)

          if (!product) {
            throw new Error(`Product ${item.productId} not found`)
          }

          // Check stock
          console.log(`[SALES API TX] Checking stock at location:`, locationId)
          const stock = await tx.stock.findFirst({
            where: {
              productId: item.productId,
              locationId,
            },
          })
          console.log(`[SALES API TX] Stock found:`, stock?.quantity)

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
          locationId,
          userId: user.id,
          customerId: validatedData.customerId || null,
          cashRegisterId: openCashRegister.id,
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
              locationId,
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
    }, {
      maxWait: 30000, // 30 seconds max wait to acquire a connection
      timeout: 30000, // 30 seconds max transaction time
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
