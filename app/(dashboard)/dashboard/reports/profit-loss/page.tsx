"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseCategory {
  categoryId: string | null
  categoryName: string
  amount: number
  sources: string[]
}

interface ProfitLossData {
  period: { from: string; to: string }
  revenue: {
    gross: number
    byPaymentMethod: Record<string, number>
  }
  cogs: number
  grossProfit: number
  grossMargin: number
  expenses: {
    total: number
    byCategory: ExpenseCategory[]
  }
  netProfit: number
  netMargin: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  QR: "QR",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cuenta Corriente",
  CHECK: "Cheque",
  OTHER: "Otro",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultFrom(): string {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  return firstDay.toISOString().slice(0, 10)
}

function getDefaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type DateShortcut = {
  label: string
  from: () => string
  to: () => string
}

const DATE_SHORTCUTS: DateShortcut[] = [
  {
    label: "Hoy",
    from: () => toISO(new Date()),
    to: () => toISO(new Date()),
  },
  {
    label: "Ayer",
    from: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return toISO(d)
    },
    to: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return toISO(d)
    },
  },
  {
    label: "Este mes",
    from: () => {
      const now = new Date()
      return toISO(new Date(now.getFullYear(), now.getMonth(), 1))
    },
    to: () => toISO(new Date()),
  },
  {
    label: "Mes pasado",
    from: () => {
      const now = new Date()
      return toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    },
    to: () => {
      const now = new Date()
      return toISO(new Date(now.getFullYear(), now.getMonth(), 0))
    },
  },
  {
    label: "Últimos 3 meses",
    from: () => {
      const now = new Date()
      return toISO(new Date(now.getFullYear(), now.getMonth() - 3, 1))
    },
    to: () => toISO(new Date()),
  },
  {
    label: "Este año",
    from: () => toISO(new Date(new Date().getFullYear(), 0, 1)),
    to: () => toISO(new Date()),
  },
  {
    label: "Año pasado",
    from: () => toISO(new Date(new Date().getFullYear() - 1, 0, 1)),
    to: () => toISO(new Date(new Date().getFullYear() - 1, 11, 31)),
  },
]

function paymentMethodLabel(key: string): string {
  return PAYMENT_METHOD_LABELS[key] ?? key
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfitLossPage() {
  const [from, setFrom] = useState<string>(getDefaultFrom)
  const [to, setTo] = useState<string>(getDefaultTo)
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = async (overrideFrom?: string, overrideTo?: string) => {
    const f = overrideFrom ?? from
    const t = overrideTo ?? to
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/profit-loss?from=${f}&to=${t}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Error ${res.status}`)
      }
      const json: ProfitLossData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al obtener el reporte")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const applyShortcut = (shortcut: DateShortcut) => {
    const f = shortcut.from()
    const t = shortcut.to()
    setFrom(f)
    setTo(t)
    fetchReport(f, t)
  }

  // Fetch on mount with the default date range
  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const revenueByMethod = data
    ? Object.entries(data.revenue.byPaymentMethod).filter(([, v]) => v > 0)
    : []

  const expensesByCategory = data
    ? [...data.expenses.byCategory].sort((a, b) => b.amount - a.amount)
    : []

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function KpiCard({
    title,
    value,
    subtitle,
    accent,
  }: {
    title: string
    value: number
    subtitle?: string
    accent?: "blue" | "neutral" | "sign"
  }) {
    const isNegative = value < 0
    let valueClass = "text-2xl font-bold"
    if (accent === "blue") valueClass += " text-blue-600"
    else if (accent === "sign")
      valueClass += isNegative ? " text-red-600" : " text-green-600"

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={valueClass}>{formatCurrency(value)}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resultado / P&amp;L</h1>
          <p className="text-muted-foreground">
            Estado de resultados para el período seleccionado
          </p>
        </div>

        {/* Date shortcuts + range + action */}
        <div className="flex flex-col gap-2 items-start sm:items-end">
          {/* Shortcut buttons */}
          <div className="flex flex-wrap gap-1">
            {DATE_SHORTCUTS.map((shortcut) => {
              const isActive = from === shortcut.from() && to === shortcut.to()
              return (
                <button
                  key={shortcut.label}
                  onClick={() => applyShortcut(shortcut)}
                  disabled={loading}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  {shortcut.label}
                </button>
              )
            })}
          </div>
          {/* Manual date inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="pl-from">
              Desde
            </label>
            <input
              id="pl-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <label className="text-sm font-medium text-muted-foreground" htmlFor="pl-to">
              Hasta
            </label>
            <input
              id="pl-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <Button onClick={() => fetchReport()} disabled={loading}>
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-muted-foreground">Cargando...</p>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-red-600 font-medium">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && data === null && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Seleccione un período y haga clic en Consultar.
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Ingresos Brutos"
              value={data.revenue.gross}
              accent="blue"
            />
            <KpiCard
              title="COGS (Costo de Mercadería)"
              value={data.cogs}
              accent="neutral"
            />
            <KpiCard
              title="Ganancia Bruta"
              value={data.grossProfit}
              subtitle={`Margen: ${data.grossMargin.toFixed(1)}%`}
              accent="sign"
            />
            <KpiCard
              title="Resultado Neto"
              value={data.netProfit}
              subtitle={`Margen: ${data.netMargin.toFixed(1)}%`}
              accent="sign"
            />
          </div>

          {/* Revenue breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por Medio de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByMethod.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin ingresos registrados en el período.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2 font-medium">
                          Medio de Pago
                        </th>
                        <th className="text-right px-4 py-2 font-medium">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByMethod.map(([method, amount]) => (
                        <tr key={method} className="border-b last:border-0">
                          <td className="px-4 py-2">
                            {paymentMethodLabel(method)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/50">
                        <td className="px-4 py-2 font-semibold">Total</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-600">
                          {formatCurrency(data.revenue.gross)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Gastos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin gastos registrados en el período.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2 font-medium">
                          Categoría
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Fuentes
                        </th>
                        <th className="text-right px-4 py-2 font-medium">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesByCategory.map((cat) => (
                        <tr
                          key={cat.categoryId ?? cat.categoryName}
                          className="border-b last:border-0"
                        >
                          <td className="px-4 py-2 font-medium">
                            {cat.categoryName}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {cat.sources.map((source) => (
                                <Badge
                                  key={source}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {source}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatCurrency(cat.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/50">
                        <td className="px-4 py-2 font-semibold" colSpan={2}>
                          Total Gastos
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-red-600">
                          {formatCurrency(data.expenses.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
