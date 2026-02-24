import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"
import { calculateDiscountAmount, type DiscountType } from "@/lib/pricing"

const PaymentMethodEnum = z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "QR", "CHECK", "ACCOUNT", "OTHER"])

const saleItemSchema = z.object({
  productId: z.string(),
  productVariantId: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).max(100),
  discount: z.coerce.number().min(0).max(100).default(0), // Legacy support - percentage discount
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
})

const paymentEntrySchema = z.object({
  method: PaymentMethodEnum,
  amount: z.number().positive(),
  cardLastFour: z.string().optional(),
  transferReference: z.string().optional(),
})

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  // Accept either an array of payments (new) or a single paymentMethod (legacy)
  payments: z.array(paymentEntrySchema).min(1).optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  customerId: z.string().optional(),
  discountAmount: z.number().min(0).default(0), // Legacy support - fixed amount
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
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
    const search = searchParams.get("search")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const paymentMethod = searchParams.get("paymentMethod")
    const status = searchParams.get("status")

    // Build where clause with filters
    const whereClause: any = {
      tenantId: user.tenantId,
      ...(user.locationId && { locationId: user.locationId }),
      ...(cashRegisterId && { cashRegisterId }),
    }

    // Filter by sale number (search)
    if (search) {
      whereClause.saleNumber = {
        contains: search,
        mode: "insensitive",
      }
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      whereClause.createdAt = {}
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        // Add 1 day and use lt to include the entire dateTo day
        const dateToEnd = new Date(dateTo)
        dateToEnd.setDate(dateToEnd.getDate() + 1)
        whereClause.createdAt.lt = dateToEnd
      }
    }

    // Filter by status
    if (status) {
      whereClause.status = status
    }

    // Filter by payment method (requires join)
    if (paymentMethod) {
      whereClause.payments = {
        some: {
          method: paymentMethod,
        },
      }
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
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

    // Normalise the payments array — if legacy paymentMethod sent, wrap it
    // We need the total to build the legacy wrapper, so we compute it after items validation
    // For now just stash whichever format arrived; we resolve after total is known (inside tx).
    const rawPayments = validatedData.payments ?? null
    const legacyMethod = validatedData.paymentMethod ?? null

    if (!rawPayments && !legacyMethod) {
      return NextResponse.json(
        { error: "Se requiere al menos un método de pago" },
        { status: 400 }
      )
    }

    // Validate ACCOUNT payment requirements before entering transaction
    const accountPayments = rawPayments
      ? rawPayments.filter(p => p.method === "ACCOUNT")
      : legacyMethod === "ACCOUNT" ? [{ method: "ACCOUNT" as const, amount: 0 }] : []

    if (accountPayments.length > 0) {
      if (!validatedData.customerId) {
        return NextResponse.json(
          { error: "Se requiere seleccionar un cliente para pagar con cuenta corriente" },
          { status: 400 }
        )
      }

      // Verify customer belongs to tenant
      const customer = await prisma.customer.findFirst({
        where: { id: validatedData.customerId, tenantId: user.tenantId },
      })
      if (!customer) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
      }
    }

    // Create sale with items and payments in a transaction
    console.log("[SALES API] Starting transaction")
    const sale = await prisma.$transaction(async (tx) => {
      console.log("[SALES API TX] Generating sale number")
      // Generate sale number atomically by querying MAX inside the transaction
      const maxResult = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX(CAST(SPLIT_PART("saleNumber", '-', 2) AS INTEGER)) AS max_num
        FROM "Sale"
        WHERE "tenantId" = ${user.tenantId}
          AND "saleNumber" LIKE 'SALE-%'
      `
      const maxNum = maxResult[0]?.max_num ? parseInt(String(maxResult[0].max_num)) : 0
      const nextNumber = maxNum + 1
      const saleNumber = `SALE-${nextNumber.toString().padStart(6, "0")}`
      console.log("[SALES API TX] Sale number:", saleNumber)

      // Calculate totals
      let subtotal = 0
      let taxAmount = 0

      console.log("[SALES API TX] Processing items:", validatedData.items.length)
      const itemsData = await Promise.all(
        validatedData.items.map(async (item, index) => {
          console.log(`[SALES API TX] Processing item ${index + 1}:`, item.productId, item.productVariantId)

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

          // If selling a variant, verify it exists and get its cost price
          let variant = null
          let costPriceToUse = product.costPrice
          if (item.productVariantId) {
            variant = await tx.productVariant.findFirst({
              where: {
                id: item.productVariantId,
                productId: item.productId,
                tenantId: user.tenantId,
                isActive: true,
              },
            })

            if (!variant) {
              throw new Error(`Product variant ${item.productVariantId} not found`)
            }

            costPriceToUse = variant.costPrice
          }

          // Check stock (either for variant or product)
          console.log(`[SALES API TX] Checking stock at location:`, locationId)
          const stock = await tx.stock.findFirst({
            where: item.productVariantId
              ? {
                  productVariantId: item.productVariantId,
                  locationId,
                }
              : {
                  productId: item.productId,
                  locationId,
                },
          })
          console.log(`[SALES API TX] Stock found:`, stock?.quantity)

          if (!stock || stock.quantity < item.quantity) {
            const itemName = variant ? `${product.name} (${JSON.parse(variant.variantValues)})` : product.name
            throw new Error(`Insufficient stock for ${itemName}`)
          }

          // Calculate item totals applying item-level discount.
          // In Argentina, salePrice is tax-INCLUSIVE (precio con IVA incluido).
          // The taxRate is stored for accounting breakdown only — it must NOT be
          // added on top of the price.  We extract the implicit tax portion:
          //   taxAmount = total * taxRate / (100 + taxRate)
          //   subtotal  = total - taxAmount  (net/neto)

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
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: costPriceToUse ?? null,
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

      // Apply cart-level discount.
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

      // grossTotal is the amount the customer actually pays (tax-inclusive, after discounts)
      const grossTotal = (subtotal + taxAmount) - cartDiscountAmount
      // Re-derive the net subtotal after discount, scaling proportionally by gross
      const grossBeforeDiscount = subtotal + taxAmount
      const discountRatio = grossBeforeDiscount > 0 ? grossTotal / grossBeforeDiscount : 1
      const adjustedTaxAmount = taxAmount * discountRatio
      const total = grossTotal

      // Resolve payments array (legacy compat: single paymentMethod wraps into full amount)
      const resolvedPayments = rawPayments ?? [{ method: legacyMethod!, amount: total }]

      // Validate that payments sum equals the sale total (within $0.01 rounding tolerance)
      const paymentsSum = resolvedPayments.reduce((s, p) => s + p.amount, 0)
      if (Math.abs(paymentsSum - total) > 0.01) {
        throw new Error(
          `PAYMENTS_MISMATCH:La suma de pagos ($${paymentsSum.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`
        )
      }

      // Create sale
      const newSale = await tx.sale.create({
        data: {
          saleNumber,
          subtotal,
          taxAmount: adjustedTaxAmount,
          discountAmount: cartDiscountAmount,
          discountType: cartDiscountType,
          discountValue: cartDiscountValue,
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
            create: resolvedPayments.map(p => ({
              amount: p.amount,
              method: p.method,
              reference: p.cardLastFour
                ? `card:${p.cardLastFour}`
                : p.transferReference
                  ? `ref:${p.transferReference}`
                  : undefined,
            })),
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
        // Update stock (either for variant or product)
        if (item.productVariantId) {
          await tx.stock.update({
            where: {
              productVariantId_locationId: {
                productVariantId: item.productVariantId,
                locationId,
              },
            },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          })
        } else {
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
        }

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            productId: item.productVariantId ? null : item.productId,
            productVariantId: item.productVariantId || null,
            userId: user.id,
            saleId: newSale.id,
            reason: `Venta ${saleNumber}`,
          },
        })
      }

      // Handle ACCOUNT payment(s): charge to customer's current account
      const accountEntries = resolvedPayments.filter(p => p.method === "ACCOUNT")
      if (accountEntries.length > 0 && validatedData.customerId) {
        // Get or create account
        let account = await tx.customerAccount.findUnique({
          where: { customerId: validatedData.customerId },
        })

        if (!account) {
          account = await tx.customerAccount.create({
            data: {
              customerId: validatedData.customerId,
              tenantId: user.tenantId,
            },
          })
        }

        if (!account.isActive) {
          throw new Error("ACCOUNT_INACTIVE")
        }

        // Sum all ACCOUNT entries
        const accountTotal = accountEntries.reduce((s, p) => s + p.amount, 0)
        const creditLimit = new Decimal(account.creditLimit)
        const currentBalance = new Decimal(account.balance)
        const accountTotalDec = new Decimal(accountTotal)

        // Credit limit enforcement
        // Balance is positive when customer has credit, negative when they owe
        // Credit limit is the maximum negative balance allowed
        if (creditLimit.greaterThan(0)) {
          const newBalanceAfterCharge = currentBalance.minus(accountTotalDec)
          // Check if new balance would exceed credit limit
          // newBalance < -creditLimit means they're over the limit
          if (newBalanceAfterCharge.lessThan(creditLimit.negated())) {
            const available = creditLimit.plus(currentBalance)
            throw new Error(`CREDIT_LIMIT_EXCEEDED:Límite de crédito excedido. Disponible: $${available.toFixed(2)}`)
          }
        }

        const balanceBefore = account.balance
        const newBalance = new Decimal(balanceBefore).minus(accountTotalDec)

        // Update account balance
        await tx.customerAccount.update({
          where: { id: account.id },
          data: { balance: newBalance },
        })

        // Create movement record
        await tx.customerAccountMovement.create({
          data: {
            type: "CHARGE",
            amount: accountTotalDec,
            concept: `Venta ${saleNumber}`,
            balanceBefore,
            balanceAfter: newBalance,
            customerAccountId: account.id,
            saleId: newSale.id,
            tenantId: user.tenantId,
            userId: user.id,
          },
        })
      }

      // Register non-cash payments to their respective treasury accounts
      const nonCashMethods = ["DEBIT_CARD", "CREDIT_CARD", "QR", "TRANSFER", "CHECK"]
      const nonCashEntries = resolvedPayments.filter(p => nonCashMethods.includes(p.method))

      for (const payment of nonCashEntries) {
        // Find the payment method account mapping
        const paymentMethodAccount = await tx.paymentMethodAccount.findFirst({
          where: {
            tenantId: user.tenantId,
            paymentMethod: payment.method,
          },
          include: {
            CashAccount: true,
          },
        })

        if (paymentMethodAccount && paymentMethodAccount.CashAccount) {
          const account = paymentMethodAccount.CashAccount
          const balanceBefore = account.currentBalance
          const balanceAfter = Number(balanceBefore) + payment.amount

          // Create movement to register income
          await tx.cashAccountMovement.create({
            data: {
              type: "SALE_INCOME",
              amount: payment.amount,
              concept: `Venta ${saleNumber} - ${payment.method}`,
              balanceBefore,
              balanceAfter,
              reference: newSale.id,
              cashAccountId: account.id,
              tenantId: user.tenantId,
              userId: user.id,
            },
          })

          // Update cash account balance
          await tx.cashAccount.update({
            where: { id: account.id },
            data: { currentBalance: balanceAfter },
          })
        }
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

    if (error instanceof Error) {
      if (error.message === "ACCOUNT_INACTIVE") {
        return NextResponse.json(
          { error: "La cuenta corriente del cliente está inactiva" },
          { status: 400 }
        )
      }
      if (error.message === "CREDIT_LIMIT_EXCEEDED" || error.message.startsWith("CREDIT_LIMIT_EXCEEDED:")) {
        const message = error.message.startsWith("CREDIT_LIMIT_EXCEEDED:")
          ? error.message.slice("CREDIT_LIMIT_EXCEEDED:".length)
          : "La venta supera el límite de crédito del cliente"
        return NextResponse.json(
          { error: message },
          { status: 400 }
        )
      }
      if (error.message.startsWith("PAYMENTS_MISMATCH:")) {
        return NextResponse.json(
          { error: error.message.slice("PAYMENTS_MISMATCH:".length) },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: (error as any).message || "Internal server error" },
      { status: 500 }
    )
  }
}
