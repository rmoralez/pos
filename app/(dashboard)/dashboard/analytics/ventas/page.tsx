"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, Download, Calendar } from "lucide-react"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"
import { format, subDays } from "date-fns"

interface SalesReportData {
  period: {
    from: string
    to: string
    days: number
  }
  metrics: {
    revenue: number
    invoices: number
    avgTicket: number
    units: number
  }
  comparison: {
    previousPeriod: {
      revenue: number
      invoices: number
      units: number
    }
    vsRevenue: number
    vsInvoices: number
    vsUnits: number
  }
  breakdown: {
    byPaymentMethod: Array<{
      method: string
      amount: number
      percentage: number
    }>
    byInvoiceType: Array<{
      type: string
      count: number
      revenue: number
      percentage: number
    }>
  }
  temporal: Array<{
    date: string
    revenue: number
    invoices: number
    units: number
  }>
  topProducts: {
    byRevenue: Array<{
      productId: string
      name: string
      sku: string
      revenue: number
      quantity: number
    }>
    byQuantity: Array<{
      productId: string
      name: string
      sku: string
      revenue: number
      quantity: number
    }>
    bottomSold: Array<{
      productId: string
      name: string
      sku: string
      revenue: number
      quantity: number
    }>
  }
  topInvoices: Array<{
    saleNumber: string
    total: number
    date: string
    invoiceType: string | null
  }>
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  TRANSFER: "Transferencia",
  QR: "QR",
  CHECK: "Cheque",
  ACCOUNT: "Cuenta Corriente",
  OTHER: "Otro",
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"]

export default function SalesReportPage() {
  const [data, setData] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(false)

  // Default to last 30 days
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"))
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"))

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/analytics/ventas?from=${fromDate}&to=${toDate}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error("Error fetching sales report:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

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
          {isPositive ? "+" : ""}{value.toFixed(1)}%
        </span>
      </div>
    )
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

  if (!data) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reporte de Ventas</h1>
          <p className="text-muted-foreground">Análisis detallado por período</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="from">Desde</Label>
                <Input
                  id="from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="to">Hasta</Label>
                <Input
                  id="to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <Button onClick={fetchReport}>
                <Calendar className="w-4 h-4 mr-2" />
                Generar Reporte
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reporte de Ventas</h1>
          <p className="text-muted-foreground">
            Del {format(new Date(data.period.from), "dd/MM/yyyy")} al {format(new Date(data.period.to), "dd/MM/yyyy")} ({data.period.days} días)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReport}>
            <Calendar className="w-4 h-4 mr-2" />
            Cambiar Período
          </Button>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.revenue)}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs período anterior</span>
              {renderTrend(data.comparison.vsRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.invoices}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs período anterior</span>
              {renderTrend(data.comparison.vsInvoices)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.avgTicket)}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Por factura
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unidades Vendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.units}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">vs período anterior</span>
              {renderTrend(data.comparison.vsUnits)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EVOLUCIÓN TEMPORAL */}
      {data.temporal.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolución Temporal</CardTitle>
            <CardDescription>Revenue diario del período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.temporal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), "dd/MM")}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number | undefined, name: string) => {
                    if (value === undefined) return ["", name]
                    if (name === "revenue") return [formatCurrency(value), "Revenue"]
                    if (name === "invoices") return [value.toString(), "Facturas"]
                    if (name === "units") return [value.toString(), "Unidades"]
                    return [value.toString(), name]
                  }}
                  labelFormatter={(date) => format(new Date(date), "dd/MM/yyyy")}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="invoices" stroke="#10b981" strokeWidth={2} name="Facturas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* DESGLOSES */}
      <div className="grid grid-cols-2 gap-4">
        {/* Por Medio de Pago */}
        <Card>
          <CardHeader>
            <CardTitle>Por Medio de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.breakdown.byPaymentMethod.map((item, index) => (
                <div key={item.method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{PAYMENT_METHOD_LABELS[item.method] || item.method}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
                    <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Por Tipo de Comprobante */}
        <Card>
          <CardHeader>
            <CardTitle>Por Tipo de Comprobante</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.breakdown.byInvoiceType.map((item, index) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">({item.count})</span>
                    <span className="text-sm font-medium">{formatCurrency(item.revenue)}</span>
                    <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TOP PRODUCTOS */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top por Revenue */}
        <Card>
          <CardHeader>
            <CardTitle>Top Productos por Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topProducts.byRevenue.slice(0, 10).map((product, index) => (
                <div key={product.productId} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatCurrency(product.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{product.quantity} unidades</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top por Cantidad */}
        <Card>
          <CardHeader>
            <CardTitle>Top Productos por Cantidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topProducts.byQuantity.slice(0, 10).map((product, index) => (
                <div key={product.productId} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{product.quantity} unidades</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(product.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TOP FACTURAS */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Facturas</CardTitle>
          <CardDescription>Las ventas más grandes del período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topInvoices.map((invoice, index) => (
              <div key={invoice.saleNumber} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <div>
                    <div className="text-sm font-medium">Factura {invoice.saleNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(invoice.date), "dd/MM/yyyy HH:mm")} - {invoice.invoiceType || "SIN_FACTURA"}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-bold">{formatCurrency(invoice.total)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
