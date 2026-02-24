import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if quote exists and belongs to tenant
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
      },
    })

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Only DRAFT, SENT, or APPROVED quotes can be converted
    if (quote.status === "CONVERTED" || quote.status === "REJECTED") {
      return NextResponse.json(
        { error: `Quote with status ${quote.status} cannot be converted` },
        { status: 400 }
      )
    }

    // Determine location - use user's location or find default
    let locationId = user.locationId

    if (!locationId) {
      const defaultLocation = await prisma.location.findFirst({
        where: {
          tenantId: user.tenantId,
        },
      })

      if (!defaultLocation) {
        return NextResponse.json(
          { error: "No location found. Please create a location first." },
          { status: 400 }
        )
      }

      locationId = defaultLocation.id
    }

    // Check if there's an open cash register
    let openCashRegister = await prisma.cashRegister.findFirst({
      where: {
        tenantId: user.tenantId,
        locationId,
        status: "OPEN",
      },
    })

    if (!openCashRegister) {
      openCashRegister = await prisma.cashRegister.findFirst({
        where: {
          tenantId: user.tenantId,
          status: "OPEN",
        },
      })

      if (openCashRegister) {
        locationId = openCashRegister.locationId
      }
    }

    if (!openCashRegister) {
      return NextResponse.json(
        { error: "No open cash register. Please open a cash register before converting quotes." },
        { status: 400 }
      )
    }

    // Convert quote to sale in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate sale number
      const maxResult = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX(CAST(SPLIT_PART("saleNumber", '-', 2) AS INTEGER)) AS max_num
        FROM "Sale"
        WHERE "tenantId" = ${user.tenantId}
          AND "saleNumber" LIKE 'SALE-%'
      `
      const maxNum = maxResult[0]?.max_num ? parseInt(String(maxResult[0].max_num)) : 0
      const nextNumber = maxNum + 1
      const saleNumber = `SALE-${nextNumber.toString().padStart(6, "0")}`

      // Check stock availability for all items
      for (const item of quote.items) {
        const stock = await tx.stock.findFirst({
          where: {
            productId: item.productId,
            locationId,
          },
        })

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${item.product?.name || 'Unknown'}. Available: ${stock?.quantity || 0}, Required: ${item.quantity}`
          )
        }
      }

      // Create sale from quote
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          total: quote.total,
          status: "COMPLETED",
          tenantId: user.tenantId,
          locationId,
          userId: user.id,
          customerId: quote.customerId,
          cashRegisterId: openCashRegister.id,
          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: item.product?.costPrice ?? null,
              subtotal: item.subtotal,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              total: item.total,
              discount: item.discount,
            })),
          },
          payments: {
            create: {
              amount: quote.total,
              method: "CASH", // Default payment method for converted quotes
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
      for (const item of quote.items) {
        if (!item.productId) continue; // Skip items without productId

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

        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            productId: item.productId,
            userId: user.id,
            saleId: sale.id,
            reason: `Venta ${saleNumber} (convertida de presupuesto ${quote.quoteNumber})`,
          },
        })
      }

      // Update quote status and link to sale
      await tx.quote.update({
        where: { id: params.id },
        data: {
          status: "CONVERTED",
          convertedToSaleId: sale.id,
        },
      })

      return sale
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error("Convert quote error:", error)

    return NextResponse.json(
      { error: (error as any).message || "Internal server error" },
      { status: 500 }
    )
  }
}
