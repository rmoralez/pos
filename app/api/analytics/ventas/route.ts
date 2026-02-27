import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { startOfDay, endOfDay, eachDayOfInterval, format, differenceInDays, subDays } from "date-fns"

/**
 * GET /api/analytics/ventas?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Reporte de Ventas por Período
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "Missing from/to parameters" }, { status: 400 })
    }

    const fromDate = startOfDay(new Date(fromStr))
    const toDate = endOfDay(new Date(toStr))
    const tenantId = user.tenantId

    const rangeInDays = differenceInDays(toDate, fromDate) + 1

    // Período anterior de igual duración para comparación
    const prevFromDate = startOfDay(subDays(fromDate, rangeInDays))
    const prevToDate = endOfDay(subDays(fromDate, 1))

    // ============ MÉTRICAS PRINCIPALES ============
    const [currentPeriod, previousPeriod] = await Promise.all([
      prisma.sale.findMany({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: fromDate, lte: toDate },
        },
        include: {
          payments: true,
          items: true,
          invoice: {
            select: {
              type: true,
            },
          },
        },
      }),
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: prevFromDate, lte: prevToDate },
        },
        _sum: { total: true },
        _count: true,
      }),
    ])

    const totalRevenue = currentPeriod.reduce((sum, s) => sum + Number(s.total), 0)
    const totalInvoices = currentPeriod.length
    const totalUnits = currentPeriod.reduce((sum, s) => {
      const saleUnits = s.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0)
      return sum + saleUnits
    }, 0)
    const avgTicket = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

    // Get previous period units
    const prevPeriodItems = await prisma.saleItem.aggregate({
      where: {
        sale: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: prevFromDate, lte: prevToDate },
        },
      },
      _sum: { quantity: true },
    })

    const prevRevenue = Number(previousPeriod._sum?.total || 0)
    const prevInvoices = previousPeriod._count
    const prevUnits = Number(prevPeriodItems._sum?.quantity || 0)

    // ============ REVENUE POR MEDIO DE PAGO ============
    const paymentMethodBreakdown: Record<string, number> = {
      CASH: 0,
      DEBIT_CARD: 0,
      CREDIT_CARD: 0,
      TRANSFER: 0,
      QR: 0,
      CHECK: 0,
      ACCOUNT: 0,
      OTHER: 0,
    }

    currentPeriod.forEach(sale => {
      sale.payments.forEach(payment => {
        const method = payment.method as string
        if (method in paymentMethodBreakdown) {
          paymentMethodBreakdown[method] += Number(payment.amount)
        } else {
          paymentMethodBreakdown.OTHER += Number(payment.amount)
        }
      })
    })

    const paymentMethodData = Object.entries(paymentMethodBreakdown)
      .map(([method, amount]) => ({
        method,
        amount,
        percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
      }))
      .filter(p => p.amount > 0)

    // ============ REVENUE POR TIPO DE COMPROBANTE ============
    const invoiceTypeBreakdown: Record<string, { count: number; revenue: number }> = {}

    currentPeriod.forEach(sale => {
      const type = sale.invoice?.type || "SIN_FACTURA"
      if (!invoiceTypeBreakdown[type]) {
        invoiceTypeBreakdown[type] = { count: 0, revenue: 0 }
      }
      invoiceTypeBreakdown[type].count++
      invoiceTypeBreakdown[type].revenue += Number(sale.total)
    })

    const invoiceTypeData = Object.entries(invoiceTypeBreakdown).map(([type, data]) => ({
      type,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))

    // ============ DESGLOSE TEMPORAL ============
    let temporalData: Array<{ date: string; revenue: number; invoices: number; units: number }> = []

    if (rangeInDays <= 31) {
      // Diario
      const days = eachDayOfInterval({ start: fromDate, end: toDate })
      temporalData = days.map(day => {
        const dayStart = startOfDay(day)
        const dayEnd = endOfDay(day)
        const daySales = currentPeriod.filter(
          s => s.createdAt >= dayStart && s.createdAt <= dayEnd
        )
        const dayUnits = daySales.reduce((sum, s) => {
          const saleUnits = s.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0)
          return sum + saleUnits
        }, 0)
        return {
          date: format(day, "yyyy-MM-dd"),
          revenue: daySales.reduce((sum, s) => sum + Number(s.total), 0),
          invoices: daySales.length,
          units: dayUnits,
        }
      })
    }

    // ============ TOP/BOTTOM PRODUCTOS ============
    const productStats: Record<string, { revenue: number; quantity: number; name: string; sku: string }> = {}

    for (const sale of currentPeriod) {
      for (const item of sale.items) {
        if (!item.productId) continue // Skip if no product ID

        const key = item.productId
        if (!productStats[key]) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true, sku: true },
          })
          productStats[key] = {
            revenue: 0,
            quantity: 0,
            name: product?.name || "Unknown",
            sku: product?.sku || "",
          }
        }
        productStats[key].revenue += Number(item.subtotal)
        productStats[key].quantity += Number(item.quantity)
      }
    }

    const productArray = Object.entries(productStats).map(([id, data]) => ({
      productId: id,
      ...data,
    }))

    const topByRevenue = productArray.sort((a, b) => b.revenue - a.revenue).slice(0, 20)
    const topByQuantity = productArray.sort((a, b) => b.quantity - a.quantity).slice(0, 20)
    const bottomSold = productArray.sort((a, b) => a.revenue - b.revenue).slice(0, 20)

    // ============ TOP FACTURAS ============
    const topInvoices = currentPeriod
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, 10)
      .map(s => ({
        saleNumber: s.saleNumber,
        total: Number(s.total),
        date: s.createdAt.toISOString(),
        invoiceType: s.invoice?.type || null,
      }))

    // ============ RESPUESTA ============
    return NextResponse.json({
      period: {
        from: format(fromDate, "yyyy-MM-dd"),
        to: format(toDate, "yyyy-MM-dd"),
        days: rangeInDays,
      },
      metrics: {
        revenue: totalRevenue,
        invoices: totalInvoices,
        avgTicket,
        units: totalUnits,
      },
      comparison: {
        previousPeriod: {
          revenue: prevRevenue,
          invoices: prevInvoices,
          units: prevUnits,
        },
        vsRevenue: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0,
        vsInvoices: prevInvoices > 0 ? ((totalInvoices - prevInvoices) / prevInvoices) * 100 : 0,
        vsUnits: prevUnits > 0 ? ((totalUnits - prevUnits) / prevUnits) * 100 : 0,
      },
      breakdown: {
        byPaymentMethod: paymentMethodData,
        byInvoiceType: invoiceTypeData,
      },
      temporal: temporalData,
      topProducts: {
        byRevenue: topByRevenue,
        byQuantity: topByQuantity,
        bottomSold,
      },
      topInvoices,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in ventas report:", error)
    return NextResponse.json(
      { error: "Failed to generate sales report" },
      { status: 500 }
    )
  }
}
