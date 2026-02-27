"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  Wallet,
  TrendingUp,
  Building2,
  Banknote,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  RefreshCw,
  ArrowLeftRight,
  FileText,
  ArrowRight,
} from "lucide-react"
import { AccountSummaryCard } from "@/components/treasury/account-summary-card"
import { TransferDialog } from "@/components/cash-accounts/transfer-dialog"

// ─── Types ───────────────────────────────────────────────────────────────────

type AccountType = "CASH_REGISTER" | "BANK" | "PETTY_CASH" | "SUPPLIER" | "OWNER" | "OPERATIONAL" | "OTHER" | "CASH"
type MovementType = "PAID" | "RECEIVED" | "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | "RETURNED" | "SALE_INCOME"

interface Account {
  id: string
  name: string
  type: AccountType
  currentBalance: number
  description?: string | null
  status: "OPEN" | "ACTIVE"
}

interface Movement {
  id: string
  type: MovementType
  amount: number
  concept: string
  reference?: string | null
  createdAt: Date
  accountName: string
  accountType: string
  userName: string | null
  source: "CASH_ACCOUNT" | "PETTY_CASH"
}

interface TreasurySummary {
  totalCash: number
  cashInRegisters: number
  bankAccounts: number
  pettyCash: number
  accountsReceivable: number
  accountBreakdown: Account[]
  recentMovements: Movement[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  CASH_REGISTER: "Caja Registradora",
  BANK: "Banco",
  PETTY_CASH: "Caja Chica",
  SUPPLIER: "Proveedor",
  OWNER: "Titular",
  OPERATIONAL: "Operativo",
  OTHER: "Otro",
  CASH: "Efectivo",
}

const TYPE_COLORS: Record<AccountType, string> = {
  CASH_REGISTER: "bg-blue-100 text-blue-800",
  BANK: "bg-green-100 text-green-800",
  PETTY_CASH: "bg-yellow-100 text-yellow-800",
  SUPPLIER: "bg-purple-100 text-purple-800",
  OWNER: "bg-indigo-100 text-indigo-800",
  OPERATIONAL: "bg-orange-100 text-orange-800",
  OTHER: "bg-gray-100 text-gray-800",
  CASH: "bg-emerald-100 text-emerald-800",
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  PAID: "Pago",
  RECEIVED: "Ingreso",
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER_IN: "Transferencia Entrada",
  TRANSFER_OUT: "Transferencia Salida",
  RETURNED: "Devolución",
  SALE_INCOME: "Venta",
}

// Helper to determine if movement is credit (adds to balance)
const isCredit = (type: MovementType) =>
  ["RECEIVED", "INCOME", "TRANSFER_IN", "SALE_INCOME"].includes(type)

// ─── Component ───────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const [summary, setSummary] = useState<TreasurySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchSummary = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch("/api/treasury")
      if (res.ok) {
        setSummary(await res.json())
      } else {
        console.error("Error fetching treasury summary:", await res.text())
      }
    } catch (e) {
      console.error("Error fetching treasury summary:", e)
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tesorería...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tesorería</h1>
          <p className="text-muted-foreground">
            Gestión y control de caja y bancos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchSummary(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AccountSummaryCard
          title="Fondos Totales"
          amount={summary?.totalCash ?? 0}
          icon={Wallet}
          iconColor="text-blue-600"
          description="Suma de todos los fondos"
        />

        <AccountSummaryCard
          title="Cajas Abiertas"
          amount={summary?.cashInRegisters ?? 0}
          icon={DollarSign}
          iconColor="text-green-600"
          description="Dinero en cajas registradoras"
        />

        <AccountSummaryCard
          title="Cuentas Bancarias"
          amount={summary?.bankAccounts ?? 0}
          icon={Building2}
          iconColor="text-emerald-600"
          description="Saldo en bancos"
        />

        <AccountSummaryCard
          title="Caja Chica"
          amount={summary?.pettyCash ?? 0}
          icon={Banknote}
          iconColor="text-yellow-600"
          description="Fondo de gastos menores"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Accede a las operaciones más frecuentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/cash">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <DollarSign className="h-6 w-6" />
                <span>Control de Caja</span>
              </Button>
            </Link>
            <Link href="/dashboard/petty-cash">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Banknote className="h-6 w-6" />
                <span>Caja Chica</span>
              </Button>
            </Link>
            <Link href="/dashboard/cash-accounts">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Wallet className="h-6 w-6" />
                <span>Cuentas</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full h-20 flex-col gap-2"
              onClick={() => setShowTransferDialog(true)}
            >
              <ArrowLeftRight className="h-6 w-6" />
              <span>Transferir</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por Cuenta</CardTitle>
          <CardDescription>
            Estado de todas las cuentas activas ({summary?.accountBreakdown.length ?? 0})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!summary?.accountBreakdown || summary.accountBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay cuentas activas
            </p>
          ) : (
            <div className="space-y-3">
              {summary.accountBreakdown.map((account) => {
                // Determine the correct detail page URL based on account type
                const detailUrl =
                  account.type === "CASH_REGISTER"
                    ? `/dashboard/cash/${account.id}`
                    : account.type === "PETTY_CASH"
                      ? `/dashboard/petty-cash`
                      : `/dashboard/cash-accounts/${account.id}`

                return (
                  <Link key={account.id} href={detailUrl}>
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                          {account.type === "CASH_REGISTER" && (
                            <DollarSign className="h-5 w-5 text-blue-600" />
                          )}
                          {account.type === "BANK" && (
                            <Building2 className="h-5 w-5 text-green-600" />
                          )}
                          {account.type === "PETTY_CASH" && (
                            <Banknote className="h-5 w-5 text-yellow-600" />
                          )}
                          {!["CASH_REGISTER", "BANK", "PETTY_CASH"].includes(
                            account.type
                          ) && <Wallet className="h-5 w-5 text-gray-600" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{account.name}</p>
                            <Badge className={TYPE_COLORS[account.type]}>
                              {TYPE_LABELS[account.type]}
                            </Badge>
                            {account.status === "OPEN" && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Abierta
                              </Badge>
                            )}
                          </div>
                          {account.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {account.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4 flex items-center gap-2">
                        <p
                          className={`text-lg font-bold ${
                            account.currentBalance < 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatCurrency(account.currentBalance)}
                        </p>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>
            Últimos 20 movimientos en todas las cuentas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!summary?.recentMovements || summary.recentMovements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay movimientos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {summary.recentMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 border rounded-lg text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {isCredit(movement.type) ? (
                        <ArrowDownCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowUpCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{movement.concept}</p>
                        <Badge
                          variant={isCredit(movement.type) ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {MOVEMENT_LABELS[movement.type] ?? movement.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {movement.accountName} · {movement.userName} ·{" "}
                        {new Date(movement.createdAt).toLocaleString("es-AR")}
                        {movement.reference && (
                          <span className="ml-1 italic">({movement.reference})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p
                      className={`font-bold ${
                        isCredit(movement.type) ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCredit(movement.type) ? "+" : "-"}
                      {formatCurrency(movement.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts Receivable Info Widget */}
      {summary && summary.accountsReceivable > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    💡 Información Adicional
                  </p>
                  <p className="text-lg font-semibold text-blue-900">
                    Tienes {formatCurrency(summary.accountsReceivable)} pendientes de cobro en cuentas corrientes
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este monto no está incluido en el efectivo disponible
                  </p>
                </div>
              </div>
              <Link href="/dashboard/accounts">
                <Button variant="outline" className="gap-2">
                  Ver detalle
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer Dialog */}
      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        onSuccess={() => fetchSummary(true)}
      />
    </div>
  )
}
