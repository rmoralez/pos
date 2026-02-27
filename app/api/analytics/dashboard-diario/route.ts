import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays, format } from "date-fns"

/**
 * GET /api/analytics/dashboard-diario
 * Dashboard Diario - Primera pantalla al abrir el sistema
 *
 * Muestra:
 * - Hoy vs ayer vs mismo día semana pasada
 * - Hoy acumulado en contexto
 * - Alertas activas
 * - Indicadores de velocidad
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = user.tenantId
    const now = new Date()

    // ============ PERÍODOS DE TIEMPO ============
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)

    const yesterdayStart = startOfDay(subDays(now, 1))
    const yesterdayEnd = endOfDay(subDays(now, 1))

    const lastWeekSameDayStart = startOfDay(subDays(now, 7))
    const lastWeekSameDayEnd = endOfDay(subDays(now, 7))

    const thisMonthStart = startOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    // Días transcurridos del mes actual hasta hoy
    const daysElapsedThisMonth = differenceInDays(now, thisMonthStart) + 1
    const totalDaysThisMonth = differenceInDays(endOfMonth(now), thisMonthStart) + 1

    // ============ HOY VS AYER VS SEMANA PASADA ============
    const [todaySales, yesterdaySales, lastWeekSameDaySales] = await Promise.all([
      // Hoy
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { total: true },
        _count: true,
      }),
      // Ayer
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
        _sum: { total: true },
        _count: true,
      }),
      // Mismo día semana pasada
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: lastWeekSameDayStart, lte: lastWeekSameDayEnd },
        },
        _sum: { total: true },
        _count: true,
      }),
    ])

    // Get units from SaleItems
    const [todayItems, yesterdayItems, lastWeekItems] = await Promise.all([
      prisma.saleItem.aggregate({
        where: {
          sale: {
            tenantId,
            status: "COMPLETED",
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        },
        _sum: { quantity: true },
      }),
      prisma.saleItem.aggregate({
        where: {
          sale: {
            tenantId,
            status: "COMPLETED",
            createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
          },
        },
        _sum: { quantity: true },
      }),
      prisma.saleItem.aggregate({
        where: {
          sale: {
            tenantId,
            status: "COMPLETED",
            createdAt: { gte: lastWeekSameDayStart, lte: lastWeekSameDayEnd },
          },
        },
        _sum: { quantity: true },
      }),
    ])

    const todayRevenue = Number(todaySales._sum?.total || 0)
    const todayInvoices = todaySales._count
    const todayUnits = Number(todayItems._sum?.quantity || 0)
    const todayAvgTicket = todayInvoices > 0 ? todayRevenue / todayInvoices : 0

    const yesterdayRevenue = Number(yesterdaySales._sum?.total || 0)
    const yesterdayInvoices = yesterdaySales._count
    const yesterdayUnits = Number(yesterdayItems._sum?.quantity || 0)
    const yesterdayAvgTicket = yesterdayInvoices > 0 ? yesterdayRevenue / yesterdayInvoices : 0

    const lastWeekRevenue = Number(lastWeekSameDaySales._sum?.total || 0)
    const lastWeekInvoices = lastWeekSameDaySales._count
    const lastWeekUnits = Number(lastWeekItems._sum?.quantity || 0)
    const lastWeekAvgTicket = lastWeekInvoices > 0 ? lastWeekRevenue / lastWeekInvoices : 0

    // ============ HOY ACUMULADO EN CONTEXTO ============
    const [thisMonthToDate, lastMonthToSameDay, lastMonthTotal] = await Promise.all([
      // Este mes hasta hoy
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: thisMonthStart, lte: todayEnd },
        },
        _sum: { total: true },
      }),
      // Mes anterior hasta el mismo día
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: {
            gte: lastMonthStart,
            lte: new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), daysElapsedThisMonth, 23, 59, 59),
          },
        },
        _sum: { total: true },
      }),
      // Mes anterior completo
      prisma.sale.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { total: true },
      }),
    ])

    const thisMonthRevenue = Number(thisMonthToDate._sum.total || 0)
    const lastMonthToSameDayRevenue = Number(lastMonthToSameDay._sum.total || 0)
    const lastMonthTotalRevenue = Number(lastMonthTotal._sum.total || 0)

    // Proyección lineal del mes
    const monthProjection = daysElapsedThisMonth > 0
      ? (thisMonthRevenue / daysElapsedThisMonth) * totalDaysThisMonth
      : 0

    // % cumplimiento vs mes anterior completo
    const fulfillmentVsLastMonth = lastMonthTotalRevenue > 0
      ? (thisMonthRevenue / lastMonthTotalRevenue) * 100
      : 0

    // ============ ALERTAS ACTIVAS ============

    // 1. Productos con stock bajo (< 10 unidades)
    const lowStockProducts = await prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
        stock: {
          some: {
            quantity: { lt: 10 },
          },
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: {
          select: {
            quantity: true,
          },
        },
      },
      take: 10,
    })

    // 2. Productos sin movimiento en 30 días con stock > 0
    const thirtyDaysAgo = subDays(now, 30)
    const productsWithStock = await prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
        stock: {
          some: {
            quantity: { gt: 0 },
          },
        },
      },
      select: { id: true },
    })

    const productIds = productsWithStock.map(p => p.id).filter((id): id is string => id !== null)

    const recentSoldProducts = await prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo },
        },
        productId: { in: productIds },
      },
      select: { productId: true },
      distinct: ['productId'],
    })

    const recentSoldIds = new Set(recentSoldProducts.map(s => s.productId).filter((id): id is string => id !== null))
    const staleProductIds = productIds.filter(id => !recentSoldIds.has(id))

    const staleProducts = await prisma.product.findMany({
      where: {
        id: { in: staleProductIds.slice(0, 10) },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: { select: { quantity: true } },
      },
    })

    // 3. Diferencias de caja pendientes (simplified - would need actual implementation)
    const cashRegisterIssues: Array<any> = [] // TODO: implement cash register discrepancies

    // ============ INDICADORES DE VELOCIDAD ============

    // Facturas por hora del día
    const todaySalesDetailed = await prisma.sale.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: {
        createdAt: true,
        total: true,
      },
    })

    // Agrupar por hora
    const salesByHour: Record<number, { count: number; revenue: number }> = {}
    for (let i = 0; i < 24; i++) {
      salesByHour[i] = { count: 0, revenue: 0 }
    }

    todaySalesDetailed.forEach(sale => {
      const hour = sale.createdAt.getHours()
      salesByHour[hour].count++
      salesByHour[hour].revenue += Number(sale.total)
    })

    const hourlyData = Object.entries(salesByHour).map(([hour, data]) => ({
      hour: parseInt(hour),
      hourLabel: `${hour.padStart(2, '0')}:00`,
      invoices: data.count,
      revenue: data.revenue,
      avgTicket: data.count > 0 ? data.revenue / data.count : 0,
    }))

    // ============ RESPUESTA ============
    return NextResponse.json({
      // Comparativas
      comparisons: {
        today: {
          revenue: todayRevenue,
          invoices: todayInvoices,
          avgTicket: todayAvgTicket,
          units: todayUnits,
        },
        yesterday: {
          revenue: yesterdayRevenue,
          invoices: yesterdayInvoices,
          avgTicket: yesterdayAvgTicket,
          units: yesterdayUnits,
        },
        lastWeekSameDay: {
          revenue: lastWeekRevenue,
          invoices: lastWeekInvoices,
          avgTicket: lastWeekAvgTicket,
          units: lastWeekUnits,
        },
        vsYesterday: {
          revenue: yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0,
          invoices: yesterdayInvoices > 0 ? ((todayInvoices - yesterdayInvoices) / yesterdayInvoices) * 100 : 0,
          avgTicket: yesterdayAvgTicket > 0 ? ((todayAvgTicket - yesterdayAvgTicket) / yesterdayAvgTicket) * 100 : 0,
          units: yesterdayUnits > 0 ? ((todayUnits - yesterdayUnits) / yesterdayUnits) * 100 : 0,
        },
        vsLastWeek: {
          revenue: lastWeekRevenue > 0 ? ((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0,
          invoices: lastWeekInvoices > 0 ? ((todayInvoices - lastWeekInvoices) / lastWeekInvoices) * 100 : 0,
          avgTicket: lastWeekAvgTicket > 0 ? ((todayAvgTicket - lastWeekAvgTicket) / lastWeekAvgTicket) * 100 : 0,
          units: lastWeekUnits > 0 ? ((todayUnits - lastWeekUnits) / lastWeekUnits) * 100 : 0,
        },
      },

      // Contexto mensual
      monthContext: {
        thisMonth: {
          revenue: thisMonthRevenue,
          daysElapsed: daysElapsedThisMonth,
          totalDays: totalDaysThisMonth,
        },
        lastMonth: {
          revenueToSameDay: lastMonthToSameDayRevenue,
          revenueTotal: lastMonthTotalRevenue,
        },
        projection: monthProjection,
        fulfillmentPercent: fulfillmentVsLastMonth,
        vsLastMonthToSameDay: lastMonthToSameDayRevenue > 0
          ? ((thisMonthRevenue - lastMonthToSameDayRevenue) / lastMonthToSameDayRevenue) * 100
          : 0,
      },

      // Alertas
      alerts: {
        lowStock: lowStockProducts.map(p => ({
          productId: p.id,
          name: p.name,
          sku: p.sku || "",
          current: p.stock[0]?.quantity || 0,
          minimum: 10, // Fixed threshold for now
        })),
        staleProducts: staleProducts.map(p => ({
          productId: p.id,
          name: p.name,
          sku: p.sku || "",
          stock: p.stock[0]?.quantity || 0,
          daysWithoutSales: 30,
        })),
        cashRegisterIssues,
      },

      // Velocidad
      hourlyPerformance: hourlyData,

      // Metadata
      generatedAt: now.toISOString(),
      date: format(now, 'yyyy-MM-dd'),
    })
  } catch (error) {
    console.error("Error in dashboard-diario:", error)
    return NextResponse.json(
      { error: "Failed to generate daily dashboard" },
      { status: 500 }
    )
  }
}
