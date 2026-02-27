"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, AlertTriangle, Package, Clock, DollarSign, FileText, ShoppingCart } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface DashboardData {
  comparisons: {
    today: { revenue: number; invoices: number; avgTicket: number; units: number }
    yesterday: { revenue: number; invoices: number; avgTicket: number; units: number }
    lastWeekSameDay: { revenue: number; invoices: number; avgTicket: number; units: number }
    vsYesterday: { revenue: number; invoices: number; avgTicket: number; units: number }
    vsLastWeek: { revenue: number; invoices: number; avgTicket: number; units: number }
  }
  monthContext: {
    thisMonth: { revenue: number; daysElapsed: number; totalDays: number }
    lastMonth: { revenueToSameDay: number; revenueTotal: number }
    projection: number
    fulfillmentPercent: number
    vsLastMonthToSameDay: number
  }
  alerts: {
    lowStock: Array<{ productId: string; name: string; sku: string; current: number; minimum: number }>
    staleProducts: Array<{ productId: string; name: string; sku: string; stock: number; daysWithoutSales: number }>
  }
  hourlyPerformance: Array<{ hour: number; hourLabel: string; invoices: number; revenue: number; avgTicket: number }>
  date: string
}

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/analytics/dashboard-diario")
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-6">Error cargando datos</div>

  const { comparisons, monthContext, alerts, hourlyPerformance } = data

  const renderTrend = (value: number) => {
    if (value === 0) return <span className="text-gray-500">—</span>
    const isPositive = value > 0
    return (
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-green-600" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-600" />
        )}
        <span className={isPositive ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
          {Math.abs(value).toFixed(1)}%
        </span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Diario</h1>
        <p className="text-muted-foreground">Indicadores clave del negocio</p>
      </div>

      {/* HOY VS AYER VS SEMANA PASADA */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(comparisons.today.revenue)}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs ayer</span>
              {renderTrend(comparisons.vsYesterday.revenue)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">vs semana</span>
              {renderTrend(comparisons.vsLastWeek.revenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comparisons.today.invoices}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs ayer</span>
              {renderTrend(comparisons.vsYesterday.invoices)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">vs semana</span>
              {renderTrend(comparisons.vsLastWeek.invoices)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(comparisons.today.avgTicket)}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs ayer</span>
              {renderTrend(comparisons.vsYesterday.avgTicket)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">vs semana</span>
              {renderTrend(comparisons.vsLastWeek.avgTicket)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comparisons.today.units}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs ayer</span>
              {renderTrend(comparisons.vsYesterday.units)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">vs semana</span>
              {renderTrend(comparisons.vsLastWeek.units)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTEXTO MENSUAL */}
      <Card>
        <CardHeader>
          <CardTitle>Contexto del Mes</CardTitle>
          <CardDescription>
            Día {monthContext.thisMonth.daysElapsed} de {monthContext.thisMonth.totalDays}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Revenue del Mes</div>
              <div className="text-2xl font-bold">{formatCurrency(monthContext.thisMonth.revenue)}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">vs mes anterior al mismo día</span>
                {renderTrend(monthContext.vsLastMonthToSameDay)}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Proyección Mensual</div>
              <div className="text-2xl font-bold">{formatCurrency(monthContext.projection)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Proyección lineal basada en {monthContext.thisMonth.daysElapsed} días
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">% Cumplimiento</div>
              <div className="text-2xl font-bold">{monthContext.fulfillmentPercent.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                vs mes anterior completo ({formatCurrency(monthContext.lastMonth.revenueTotal)})
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ALERTAS */}
      {(alerts.lowStock.length > 0 || alerts.staleProducts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Alertas Activas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts.lowStock.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Stock Bajo ({alerts.lowStock.length})
                </h3>
                <div className="space-y-1">
                  {alerts.lowStock.slice(0, 5).map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm p-2 bg-orange-50 rounded">
                      <span>{item.name} <span className="text-muted-foreground">({item.sku})</span></span>
                      <Badge variant="destructive">{item.current} / {item.minimum}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alerts.staleProducts.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Sin Movimiento 30+ Días ({alerts.staleProducts.length})
                </h3>
                <div className="space-y-1">
                  {alerts.staleProducts.slice(0, 5).map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm p-2 bg-yellow-50 rounded">
                      <span>{item.name} <span className="text-muted-foreground">({item.sku})</span></span>
                      <Badge variant="outline">Stock: {item.stock}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PERFORMANCE POR HORA */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas por Hora del Día</CardTitle>
          <CardDescription>Distribución horaria de ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyPerformance.filter(d => d.invoices > 0)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hourLabel" />
              <YAxis />
              <Tooltip
                formatter={(value: number | undefined, name: string) => {
                  if (value === undefined) return ["", name]
                  if (name === "revenue") return [formatCurrency(value), name]
                  if (name === "avgTicket") return [formatCurrency(value), name]
                  return [value, name]
                }}
                labelFormatter={(label) => `Hora: ${label}`}
              />
              <Bar dataKey="invoices" fill="#3b82f6" name="Facturas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
