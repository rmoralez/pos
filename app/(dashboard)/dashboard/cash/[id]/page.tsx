"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  CreditCard,
} from "lucide-react"

interface PaymentBreakdown {
  CASH: number
  DEBIT_CARD: number
  CREDIT_CARD: number
  QR: number
  TRANSFER: number
  ACCOUNT: number
  CHECK: number
  OTHER: number
}

interface CashRegister {
  id: string
  openedAt: string
  closedAt: string | null
  status: string
  openingBalance: number
  closingBalance: number | null
  expectedBalance: number | null
  difference: number | null
  notes: string | null
  user: {
    name: string
    email: string
  }
  location: {
    name: string
  }
  _count: {
    sales: number
    transactions: number
  }
  salesTotal?: number          // CASH only
  salesFiscalTotal?: number    // All methods
  paymentBreakdown?: PaymentBreakdown
  incomes?: number
  expenses?: number
  calculatedBalance?: number
}

interface Transaction {
  id: string
  type: string
  amount: number
  reason: string
  reference: string | null
  createdAt: string
  user: {
    name: string
  }
}

interface Sale {
  id: string
  total: number
  paymentMethod: string
  status: string
  createdAt: string
  customer: {
    name: string
  } | null
  payments?: { method: string; amount: number }[]
}

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

export default function CashRegisterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch cash register details
        const registerResponse = await fetch(`/api/cash-registers/${params.id}`)
        if (registerResponse.ok) {
          const registerData = await registerResponse.json()
          setCashRegister(registerData)
        }

        // Fetch transactions
        const transactionsResponse = await fetch(`/api/cash-registers/${params.id}/transactions`)
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json()
          setTransactions(transactionsData.transactions)
        }

        // Fetch sales (using the sales API filtered by cash register)
        const salesResponse = await fetch(`/api/sales?cashRegisterId=${params.id}`)
        if (salesResponse.ok) {
          const salesData = await salesResponse.json()
          setSales(salesData.sales || [])
        }
      } catch (error) {
        console.error("Error fetching cash register details:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando detalles...</p>
        </div>
      </div>
    )
  }

  if (!cashRegister) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-muted-foreground">Caja no encontrada</p>
          <Button onClick={() => router.push("/dashboard/cash/history")} className="mt-4">
            Volver al Historial
          </Button>
        </div>
      </div>
    )
  }

  const openedAt = new Date(cashRegister.openedAt)
  const closedAt = cashRegister.closedAt ? new Date(cashRegister.closedAt) : null
  const duration = closedAt
    ? Math.floor((closedAt.getTime() - openedAt.getTime()) / (1000 * 60))
    : Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60))
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60

  const breakdown = cashRegister.paymentBreakdown

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Detalles de Caja de Ventas</h1>
          <p className="text-muted-foreground">
            {cashRegister.user.name} - {cashRegister.location.name}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/cash/history")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Historial
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Inicial</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(cashRegister.openingBalance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Efectivo</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(cashRegister.salesTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {cashRegister._count?.sales ?? 0} ventas totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(cashRegister.incomes || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(cashRegister.expenses || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Breakdown */}
      {breakdown && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Desglose por Medio de Pago</CardTitle>
            </div>
            <CardDescription>
              Solo Efectivo se incluye en el saldo físico de caja.
              Los demás medios de pago se concilian externamente (posnet, banco, app).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* CASH */}
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-green-700">Efectivo</p>
                  <p className="text-sm font-bold text-green-800">
                    {formatCurrency(breakdown.CASH)}
                  </p>
                  <p className="text-xs text-green-600">Afecta saldo caja</p>
                </div>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>

              {/* Non-cash methods */}
              {([
                ["DEBIT_CARD", "Débito"],
                ["CREDIT_CARD", "Crédito"],
                ["QR", "QR"],
                ["TRANSFER", "Transferencia"],
                ["ACCOUNT", "Cta. Corriente"],
                ["CHECK", "Cheque"],
                ["OTHER", "Otro"],
              ] as [keyof PaymentBreakdown, string][]).map(([key, label]) =>
                breakdown[key] > 0 ? (
                  <div key={key} className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="text-sm font-bold">{formatCurrency(breakdown[key])}</p>
                      <p className="text-xs text-muted-foreground">Conciliar externamente</p>
                    </div>
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : null
              )}
            </div>

            {cashRegister.salesFiscalTotal !== undefined && (
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Fiscal (todos los medios de pago)
                </span>
                <span className="text-sm font-bold">
                  {formatCurrency(cashRegister.salesFiscalTotal)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estado</span>
              {cashRegister.status === "OPEN" ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Abierta
                </Badge>
              ) : (
                <Badge variant="secondary">Cerrada</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Apertura</span>
              <span className="text-sm text-muted-foreground">
                {openedAt.toLocaleString("es-AR")}
              </span>
            </div>
            {closedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cierre</span>
                <span className="text-sm text-muted-foreground">
                  {closedAt.toLocaleString("es-AR")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Duración</span>
              <span className="text-sm text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                {hours}h {minutes}m
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cajero</span>
              <span className="text-sm text-muted-foreground">
                {cashRegister.user.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Sucursal</span>
              <span className="text-sm text-muted-foreground">
                {cashRegister.location.name}
              </span>
            </div>
          </CardContent>
        </Card>

        {cashRegister.status === "CLOSED" && (
          <Card>
            <CardHeader>
              <CardTitle>Cierre de Caja</CardTitle>
              <CardDescription>
                Saldo esperado y diferencia son solo para Efectivo físico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Efectivo Esperado</span>
                <span className="text-sm font-medium">
                  {formatCurrency(cashRegister.expectedBalance || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Efectivo Contado</span>
                <span className="text-sm font-medium">
                  {formatCurrency(cashRegister.closingBalance || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Diferencia</span>
                <span
                  className={`text-sm font-bold ${
                    cashRegister.difference === 0
                      ? "text-green-600"
                      : (cashRegister.difference || 0) > 0
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(cashRegister.difference || 0)}
                </span>
              </div>
              {cashRegister.difference !== 0 && (
                <div
                  className={`rounded-lg p-4 ${
                    (cashRegister.difference || 0) > 0
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {(cashRegister.difference || 0) > 0 ? "Sobrante" : "Faltante"}
                  </p>
                  <p className="text-xs mt-1">
                    {(cashRegister.difference || 0) > 0
                      ? "Hay más efectivo del esperado"
                      : "Falta efectivo en caja"}
                  </p>
                </div>
              )}
              {cashRegister.notes && (
                <div>
                  <span className="text-sm font-medium">Notas</span>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {cashRegister.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>Detalle de todas las transacciones y ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList>
              <TabsTrigger value="transactions">
                Transacciones ({transactions.length})
              </TabsTrigger>
              <TabsTrigger value="sales">
                Ventas ({sales.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="mt-4">
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay transacciones registradas
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const createdAt = new Date(transaction.createdAt)
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <div className="text-sm">
                              {createdAt.toLocaleDateString("es-AR")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {createdAt.toLocaleTimeString("es-AR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {transaction.type === "INCOME" ? (
                              <Badge variant="default" className="bg-blue-600">
                                <TrendingUp className="mr-1 h-3 w-3" />
                                Ingreso
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <TrendingDown className="mr-1 h-3 w-3" />
                                Egreso
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{transaction.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {transaction.reference || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {transaction.user.name}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span
                              className={
                                transaction.type === "INCOME"
                                  ? "text-blue-600"
                                  : "text-red-600"
                              }
                            >
                              {transaction.type === "INCOME" ? "+" : "-"}
                              {formatCurrency(transaction.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="sales" className="mt-4">
              {sales.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay ventas registradas
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Medio de Pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => {
                      const createdAt = new Date(sale.createdAt)
                      // Determine the primary payment method label
                      const methodLabel = PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod
                      // Is this a cash sale?
                      const isCash = sale.paymentMethod === "CASH"
                      return (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <div className="text-sm">
                              {createdAt.toLocaleDateString("es-AR")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {createdAt.toLocaleTimeString("es-AR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {sale.customer?.name || "Cliente General"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isCash ? "default" : "outline"}
                              className={isCash ? "bg-green-600" : ""}
                            >
                              {methodLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sale.status === "COMPLETED" ? "default" : "secondary"
                              }
                            >
                              {sale.status === "COMPLETED" ? "Completada" : sale.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(sale.total)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
