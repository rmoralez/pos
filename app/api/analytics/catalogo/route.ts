import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { subDays } from "date-fns"

/**
 * GET /api/analytics/catalogo?days=30
 * Análisis de Catálogo con Pareto y Scoring de productos a discontinuar
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30")

    const tenantId = user.tenantId
    const since = subDays(new Date(), days)

    // ============ OBTENER VENTAS DEL PERÍODO ============
    const sales = await prisma.sale.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                costPrice: true,
                salePrice: true,
                stock: { select: { quantity: true } },
              },
            },
          },
        },
      },
    })

    // ============ CALCULAR REVENUE POR PRODUCTO ============
    const productRevenue: Record<string, {
      productId: string
      name: string
      sku: string
      revenue: number
      quantity: number
      costPrice: number
      salePrice: number
      stock: number
      margin: number
      lastSaleDate: Date | null
    }> = {}

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!item.product) return // Skip if product is null

        const productId = item.productId
        if (!productRevenue[productId]) {
          productRevenue[productId] = {
            productId,
            name: item.product.name,
            sku: item.product.sku,
            revenue: 0,
            quantity: 0,
            costPrice: Number(item.product.costPrice || 0),
            salePrice: Number(item.product.salePrice || 0),
            stock: item.product.stock[0]?.quantity || 0,
            margin: 0,
            lastSaleDate: null,
          }
        }
        productRevenue[productId].revenue += Number(item.subtotal)
        productRevenue[productId].quantity += Number(item.quantity)

        if (!productRevenue[productId].lastSaleDate || sale.createdAt > productRevenue[productId].lastSaleDate!) {
          productRevenue[productId].lastSaleDate = sale.createdAt
        }
      })
    })

    // Calcular margen
    Object.values(productRevenue).forEach(p => {
      if (p.salePrice > 0) {
        p.margin = ((p.salePrice - p.costPrice) / p.salePrice) * 100
      }
    })

    const products = Object.values(productRevenue)
    const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0)

    // ============ ANÁLISIS PARETO ============
    // Ordenar por revenue descendente
    const sortedByRevenue = [...products].sort((a, b) => b.revenue - a.revenue)

    let accumulated = 0
    const paretoData = sortedByRevenue.map((p, index) => {
      accumulated += p.revenue
      const cumulativePercentage = totalRevenue > 0 ? (accumulated / totalRevenue) * 100 : 0

      // Clasificación ABC
      let classification: "A" | "B" | "C"
      if (cumulativePercentage <= 80) {
        classification = "A"
      } else if (cumulativePercentage <= 95) {
        classification = "B"
      } else {
        classification = "C"
      }

      return {
        ...p,
        revenuePercentage: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
        cumulativePercentage,
        classification,
        rank: index + 1,
      }
    })

    // Contar productos por clasificación
    const classCount = {
      A: paretoData.filter(p => p.classification === "A").length,
      B: paretoData.filter(p => p.classification === "B").length,
      C: paretoData.filter(p => p.classification === "C").length,
    }

    const classRevenue = {
      A: paretoData.filter(p => p.classification === "A").reduce((sum, p) => sum + p.revenue, 0),
      B: paretoData.filter(p => p.classification === "B").reduce((sum, p) => sum + p.revenue, 0),
      C: paretoData.filter(p => p.classification === "C").reduce((sum, p) => sum + p.revenue, 0),
    }

    // ============ SCORING PARA DISCONTINUAR ============
    // Basado en días sin ventas
    const now = new Date()
    const productsToDiscontinue = paretoData
      .map(p => {
        const daysSinceLastSale = p.lastSaleDate
          ? Math.floor((now.getTime() - p.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
          : days + 1 // Si nunca se vendió en el período, más de X días

        // Score: días sin venta (mayor = peor)
        const score = daysSinceLastSale

        return {
          ...p,
          daysSinceLastSale,
          score,
          recommendation: daysSinceLastSale > 60 ? "DISCONTINUAR" : daysSinceLastSale > 30 ? "REVISAR" : "OK",
        }
      })
      .filter(p => p.stock > 0) // Solo productos con stock
      .filter(p => p.daysSinceLastSale > 30) // Más de 30 días sin venta
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)

    // ============ PRODUCTOS QUE NUNCA SE VENDIERON (en el período) ============
    const allProducts = await prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: { select: { quantity: true } },
      },
    })

    const soldProductIds = new Set(products.map(p => p.productId))
    const neverSold = allProducts
      .filter(p => !soldProductIds.has(p.id))
      .filter(p => p.stock[0]?.quantity > 0)
      .map(p => ({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock[0]?.quantity || 0,
        daysSinceLastSale: days + 1,
        recommendation: "DISCONTINUAR" as const,
      }))

    // ============ RESPUESTA ============
    return NextResponse.json({
      period: {
        days,
        since: since.toISOString(),
      },
      summary: {
        totalProducts: products.length,
        totalRevenue,
        avgRevenuePerProduct: products.length > 0 ? totalRevenue / products.length : 0,
      },
      pareto: {
        classification: {
          count: classCount,
          revenue: classRevenue,
          percentages: {
            A: totalRevenue > 0 ? (classRevenue.A / totalRevenue) * 100 : 0,
            B: totalRevenue > 0 ? (classRevenue.B / totalRevenue) * 100 : 0,
            C: totalRevenue > 0 ? (classRevenue.C / totalRevenue) * 100 : 0,
          },
        },
        products: paretoData.slice(0, 100), // Top 100 para no saturar
      },
      discontinue: {
        withSales: productsToDiscontinue,
        neverSold,
        total: productsToDiscontinue.length + neverSold.length,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in catalogo analysis:", error)
    return NextResponse.json(
      { error: "Failed to generate catalog analysis" },
      { status: 500 }
    )
  }
}
