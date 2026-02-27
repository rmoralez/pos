"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { AlertTriangle, Package, TrendingDown, Clock } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts"

interface CatalogoData {
  period: {
    days: number
    since: string
  }
  summary: {
    totalProducts: number
    totalRevenue: number
    avgRevenuePerProduct: number
  }
  pareto: {
    classification: {
      count: { A: number; B: number; C: number }
      revenue: { A: number; B: number; C: number }
      percentages: { A: number; B: number; C: number }
    }
    products: Array<{
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
      revenuePercentage: number
      cumulativePercentage: number
      classification: "A" | "B" | "C"
      rank: number
    }>
  }
  discontinue: {
    withSales: Array<{
      productId: string
      name: string
      sku: string
      revenue: number
      quantity: number
      stock: number
      daysSinceLastSale: number
      score: number
      recommendation: "DISCONTINUAR" | "REVISAR" | "OK"
      classification: "A" | "B" | "C"
    }>
    neverSold: Array<{
      productId: string
      name: string
      sku: string
      stock: number
      daysSinceLastSale: number
      recommendation: "DISCONTINUAR"
    }>
    total: number
  }
}

export default function CatalogoAnalysisPage() {
  const [data, setData] = useState<CatalogoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/analytics/catalogo?days=${days}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error("Error fetching catalog analysis:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Análisis de Catálogo</h1>
          <p className="text-muted-foreground">Pareto y productos a discontinuar</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="days">Últimos días</Label>
                <Input
                  id="days"
                  type="number"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 30)}
                  min={1}
                  max={365}
                />
              </div>
              <Button onClick={fetchReport}>
                <Package className="w-4 h-4 mr-2" />
                Generar Análisis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const classColors = {
    A: "#10b981",
    B: "#f59e0b",
    C: "#ef4444",
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Análisis de Catálogo</h1>
          <p className="text-muted-foreground">
            Últimos {data.period.days} días - Pareto y Discontinuación
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReport}>
            <Package className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* RESUMEN */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalProducts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              En los últimos {data.period.days} días
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Del período analizado
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.avgRevenuePerProduct)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Por producto
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CLASIFICACIÓN PARETO */}
      <Card>
        <CardHeader>
          <CardTitle>Clasificación ABC (Pareto)</CardTitle>
          <CardDescription>
            Distribución de productos según su contribución al revenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span className="font-medium">Clase A - Top 80%</span>
              </div>
              <div className="text-3xl font-bold">{data.pareto.classification.count.A}</div>
              <div className="text-sm text-muted-foreground">
                {data.pareto.classification.percentages.A.toFixed(1)}% del revenue
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(data.pareto.classification.revenue.A)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500" />
                <span className="font-medium">Clase B - 80-95%</span>
              </div>
              <div className="text-3xl font-bold">{data.pareto.classification.count.B}</div>
              <div className="text-sm text-muted-foreground">
                {data.pareto.classification.percentages.B.toFixed(1)}% del revenue
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(data.pareto.classification.revenue.B)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span className="font-medium">Clase C - Bottom 5%</span>
              </div>
              <div className="text-3xl font-bold">{data.pareto.classification.count.C}</div>
              <div className="text-sm text-muted-foreground">
                {data.pareto.classification.percentages.C.toFixed(1)}% del revenue
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(data.pareto.classification.revenue.C)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CURVA DE PARETO */}
      <Card>
        <CardHeader>
          <CardTitle>Curva de Pareto</CardTitle>
          <CardDescription>Acumulado de revenue por producto (top 50)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data.pareto.products.slice(0, 50)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="rank"
                label={{ value: "Ranking de Producto", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                label={{ value: "Revenue", angle: -90, position: "insideLeft" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                label={{ value: "% Acumulado", angle: 90, position: "insideRight" }}
              />
              <Tooltip
                formatter={(value: number | undefined, name: string) => {
                  if (value === undefined) return ["", name]
                  if (name === "Revenue") return [formatCurrency(value), name]
                  if (name === "Acumulado") return [`${value.toFixed(1)}%`, name]
                  return [value.toString(), name]
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePercentage"
                stroke="#ef4444"
                strokeWidth={2}
                name="Acumulado"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* TOP PRODUCTOS POR CLASE */}
      <div className="grid grid-cols-3 gap-4">
        {(["A", "B", "C"] as const).map((classification) => {
          const products = data.pareto.products
            .filter(p => p.classification === classification)
            .slice(0, 5)

          return (
            <Card key={classification}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: classColors[classification] }}
                  />
                  Top 5 Clase {classification}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {products.map((product) => (
                    <div key={product.productId} className="p-2 rounded hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium truncate">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(product.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{product.quantity} u.</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* PRODUCTOS A DISCONTINUAR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Productos a Discontinuar ({data.discontinue.total})
          </CardTitle>
          <CardDescription>
            Productos con más de 30 días sin ventas y stock disponible
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Productos con ventas pero sin movimiento reciente */}
          {data.discontinue.withSales.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Sin Movimiento Reciente ({data.discontinue.withSales.length})
              </h3>
              <div className="space-y-2">
                {data.discontinue.withSales.slice(0, 20).map((product) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between p-3 rounded border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{product.name}</span>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: classColors[product.classification],
                            color: classColors[product.classification],
                          }}
                        >
                          Clase {product.classification}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Stock</div>
                        <div className="text-sm font-medium">{product.stock} u.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Días sin venta</div>
                        <div className="text-sm font-medium">{product.daysSinceLastSale}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Revenue total</div>
                        <div className="text-sm font-medium">{formatCurrency(product.revenue)}</div>
                      </div>
                      <Badge
                        variant={
                          product.recommendation === "DISCONTINUAR"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {product.recommendation}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Productos que nunca se vendieron */}
          {data.discontinue.neverSold.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Sin Ventas en el Período ({data.discontinue.neverSold.length})
              </h3>
              <div className="space-y-2">
                {data.discontinue.neverSold.slice(0, 20).map((product) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between p-3 rounded border border-red-200 bg-red-50"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Stock</div>
                        <div className="text-sm font-medium">{product.stock} u.</div>
                      </div>
                      <Badge variant="destructive">{product.recommendation}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
