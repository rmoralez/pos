import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import { calculateDiscountAmount, type DiscountType } from "@/lib/pricing"

const quoteItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100),
  discount: z.coerce.number().min(0).max(100).default(0), // Legacy support - percentage discount
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
})

const quoteSchema = z.object({
  items: z.array(quoteItemSchema).min(1),
  customerId: z.string().optional(),
  discountAmount: z.number().min(0).default(0), // Legacy support - fixed amount
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  validUntil: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "SENT"]).default("DRAFT"),
})

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: any = {
      tenantId: user.tenantId,
    }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = customerId
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

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
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

    return NextResponse.json({ quotes })
  } catch (error) {
    console.error("GET quotes error:", error)
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

    const body = await req.json()
    const validatedData = quoteSchema.parse(body)

    // Create quote with items in a transaction
    const quote = await prisma.$transaction(async (tx) => {
      // Generate quote number atomically
      const maxResult = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX(CAST(SPLIT_PART("quoteNumber", '-', 2) AS INTEGER)) AS max_num
        FROM "Quote"
        WHERE "tenantId" = ${user.tenantId}
          AND "quoteNumber" LIKE 'QUOTE-%'
      `
      const maxNum = maxResult[0]?.max_num ? parseInt(String(maxResult[0].max_num)) : 0
      const nextNumber = maxNum + 1
      const quoteNumber = `QUOTE-${nextNumber.toString().padStart(6, "0")}`

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

          // Calculate item totals (same logic as sales)
          // Support both legacy (discount percentage) and new (discountType + discountValue)
          let itemDiscountAmount = 0
          let itemDiscountType: DiscountType = "FIXED"
          let itemDiscountValue = 0

          if (item.discountType && item.discountValue !== undefined) {
            // New flexible discount system
            itemDiscountType = item.discountType as DiscountType
            itemDiscountValue = item.discountValue
            const basePrice = item.unitPrice * item.quantity
            itemDiscountAmount = calculateDiscountAmount(basePrice, itemDiscountType, itemDiscountValue)
          } else if (item.discount && item.discount > 0) {
            // Legacy percentage discount
            itemDiscountType = "PERCENTAGE"
            itemDiscountValue = item.discount
            const basePrice = item.unitPrice * item.quantity
            itemDiscountAmount = calculateDiscountAmount(basePrice, "PERCENTAGE", item.discount)
          }

          const baseItemTotal = item.unitPrice * item.quantity
          const itemTotal = baseItemTotal - itemDiscountAmount
          const itemTaxAmount = (itemTotal * item.taxRate) / (100 + item.taxRate)
          const itemSubtotal = itemTotal - itemTaxAmount

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
            discount: item.discount ?? 0, // Keep for legacy compatibility
            discountType: itemDiscountType,
            discountValue: itemDiscountValue,
          }
        })
      )

      // Apply cart-level discount
      // Support both legacy (discountAmount) and new (discountType + discountValue)
      let cartDiscountAmount = 0
      let cartDiscountType: DiscountType = "FIXED"
      let cartDiscountValue = 0

      if (validatedData.discountType && validatedData.discountValue !== undefined) {
        // New flexible discount system
        cartDiscountType = validatedData.discountType as DiscountType
        cartDiscountValue = validatedData.discountValue
        const baseTotal = subtotal + taxAmount
        cartDiscountAmount = calculateDiscountAmount(baseTotal, cartDiscountType, cartDiscountValue)
      } else if (validatedData.discountAmount && validatedData.discountAmount > 0) {
        // Legacy fixed amount discount
        cartDiscountType = "FIXED"
        cartDiscountValue = validatedData.discountAmount
        cartDiscountAmount = validatedData.discountAmount
      }

      const grossTotal = (subtotal + taxAmount) - cartDiscountAmount
      const grossBeforeDiscount = subtotal + taxAmount
      const discountRatio = grossBeforeDiscount > 0 ? grossTotal / grossBeforeDiscount : 1
      const adjustedTaxAmount = taxAmount * discountRatio
      const total = grossTotal

      // Create quote
      const newQuote = await tx.quote.create({
        data: {
          quoteNumber,
          subtotal,
          taxAmount: adjustedTaxAmount,
          discountAmount: cartDiscountAmount,
          discountType: cartDiscountType,
          discountValue: cartDiscountValue,
          total,
          status: validatedData.status,
          tenantId: user.tenantId,
          userId: user.id,
          customerId: validatedData.customerId || null,
          validUntil: validatedData.validUntil ? new Date(validatedData.validUntil) : null,
          notes: validatedData.notes || null,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
        },
      })

      return newQuote
    })

    return NextResponse.json(quote, { status: 201 })
  } catch (error: any) {
    console.error("POST quote error:", error)

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
