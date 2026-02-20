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

const updateQuoteSchema = z.object({
  items: z.array(quoteItemSchema).min(1),
  customerId: z.string().optional(),
  discountAmount: z.number().min(0).default(0), // Legacy support - fixed amount
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "SENT"]).optional(),
})

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quote = await prisma.quote.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error("GET quote error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if quote exists and belongs to tenant
    const existingQuote = await prisma.quote.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingQuote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Only DRAFT and SENT quotes can be updated
    if (existingQuote.status !== "DRAFT" && existingQuote.status !== "SENT") {
      return NextResponse.json(
        { error: "Only DRAFT or SENT quotes can be updated" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = updateQuoteSchema.parse(body)

    // Update quote with items in a transaction
    const quote = await prisma.$transaction(async (tx) => {
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

          // Calculate item totals
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

      // Delete existing items
      await tx.quoteItem.deleteMany({
        where: { quoteId: params.id },
      })

      // Update quote with new items
      const updatedQuote = await tx.quote.update({
        where: { id: params.id },
        data: {
          subtotal,
          taxAmount: adjustedTaxAmount,
          discountAmount: cartDiscountAmount,
          discountType: cartDiscountType,
          discountValue: cartDiscountValue,
          total,
          status: validatedData.status || existingQuote.status,
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

      return updatedQuote
    })

    return NextResponse.json(quote)
  } catch (error: any) {
    console.error("PUT quote error:", error)

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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if quote exists and belongs to tenant
    const existingQuote = await prisma.quote.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingQuote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Only DRAFT quotes can be deleted
    if (existingQuote.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT quotes can be deleted" },
        { status: 400 }
      )
    }

    // Delete quote (items will be deleted automatically due to cascade)
    await prisma.quote.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE quote error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
