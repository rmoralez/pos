"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, Banknote, CreditCard } from "lucide-react"
import { OpenCashRegisterDialog } from "@/components/cash-register/open-dialog"
import { CloseCashRegisterDialog } from "@/components/cash-register/close-dialog"
import { CashTransactionDialog } from "@/components/cash-register/transaction-dialog"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

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
  status: string
  openingBalance: number
  user: {
    name: string
  }
  location: {
    name: string
  }
  _count: {
    sales: number
    transactions: number
  }
  currentBalance?: number
  salesTotal?: number        // CASH only
  salesFiscalTotal?: number  // All methods
  paymentBreakdown?: PaymentBreakdown
  incomes?: number
  expenses?: number
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

export default function CashRegisterPage() {
  const [currentCashRegister, setCurrentCashRegister] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferAmount, setTransferAmount] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState("")

  const fetchCurrentCashRegister = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/cash-registers/current")

      if (response.ok) {
        const data = await response.json()
        setCurrentCashRegister(data)
      } else if (response.status === 404) {
        setCurrentCashRegister(null)
      }
    } catch (error) {
      console.error("Error fetching current cash register:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrentCashRegister()
  }, [])

  const handleCashRegisterOpened = () => {
    setShowOpenDialog(false)
    fetchCurrentCashRegister()
  }

  const handleCashRegisterClosed = () => {
    setShowCloseDialog(false)
    fetchCurrentCashRegister()
  }

  const handleTransactionAdded = () => {
    setShowTransactionDialog(false)
    fetchCurrentCashRegister()
  }

  const handleTransfer = async () => {
    if (!currentCashRegister) return
    const amount = parseFloat(transferAmount.replace(",", "."))
    if (!amount || amount <= 0) {
      setTransferError("Ingresá un monto válido")
      return
    }
    setTransferring(true)
    setTransferError("")
    try {
      const res = await fetch(
        `/api/cash-registers/${currentCashRegister.id}/transfer-to-petty-cash`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, notes: transferNotes }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al transferir")
      }
      setShowTransferDialog(false)
      setTransferAmount("")
      setTransferNotes("")
      fetchCurrentCashRegister()
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : "Error al transferir")
    } finally {
      setTransferring(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando caja...</p>
        </div>
      </div>
    )
  }

  if (!currentCashRegister) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Caja de Ventas</h1>
            <p className="text-muted-foreground">Control de caja diaria</p>
          </div>
          <Link href="/dashboard/cash/history">
            <Button variant="outline">Ver Historial</Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-gray-100 p-6">
                <AlertCircle className="h-12 w-12 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-2xl mb-2">No hay caja abierta</CardTitle>
            <CardDescription className="text-base">
              Debes abrir una caja para comenzar a registrar ventas
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-12">
            <Button size="lg" onClick={() => setShowOpenDialog(true)}>
              <DollarSign className="mr-2 h-5 w-5" />
              Abrir Caja
            </Button>
          </CardContent>
        </Card>

        <OpenCashRegisterDialog
          open={showOpenDialog}
          onOpenChange={setShowOpenDialog}
          onSuccess={handleCashRegisterOpened}
        />
      </div>
    )
  }

  const openedAt = new Date(currentCashRegister.openedAt)
  const duration = Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60))
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60

  const breakdown = currentCashRegister.paymentBreakdown
  const hasElectronicSales = breakdown && (
    breakdown.DEBIT_CARD > 0 ||
    breakdown.CREDIT_CARD > 0 ||
    breakdown.QR > 0 ||
    breakdown.TRANSFER > 0 ||
    breakdown.ACCOUNT > 0 ||
    breakdown.CHECK > 0 ||
    breakdown.OTHER > 0
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Caja de Ventas</h1>
            <Badge role="status" variant="default" className="bg-green-600">
              Abierta
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Abierta por {currentCashRegister.user.name} - {currentCashRegister.location.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/cash/history">
            <Button variant="outline">Ver Historial</Button>
          </Link>
          <Button variant="destructive" onClick={() => setShowCloseDialog(true)}>
            Cerrar Caja
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentCashRegister.currentBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Inicial: {formatCurrency(currentCashRegister.openingBalance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Efectivo</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentCashRegister.salesTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentCashRegister._count.sales} ventas totales
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
              {formatCurrency(currentCashRegister.incomes || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos adicionales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentCashRegister.expenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Gastos y retiros
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Breakdown */}
      {breakdown && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Medios de Pago</CardTitle>
            </div>
            <CardDescription>
              Desglose de ventas por medio de pago. Solo Efectivo afecta el saldo físico de caja.
              Los medios electrónicos se concilian externamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* CASH — primary, affects balance */}
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-green-700">Efectivo</p>
                  <p className="text-sm font-bold text-green-800">
                    {formatCurrency(breakdown.CASH)}
                  </p>
                </div>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>

              {/* Electronic methods — informational only */}
              {breakdown.DEBIT_CARD > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Débito</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.DEBIT_CARD)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {breakdown.CREDIT_CARD > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Crédito</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.CREDIT_CARD)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {breakdown.QR > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">QR</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.QR)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {breakdown.TRANSFER > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Transferencia</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.TRANSFER)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {breakdown.ACCOUNT > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cuenta Corriente</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.ACCOUNT)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {breakdown.CHECK > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cheque</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.CHECK)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {breakdown.OTHER > 0 && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Otro</p>
                    <p className="text-sm font-bold">{formatCurrency(breakdown.OTHER)}</p>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>

            {currentCashRegister.salesFiscalTotal !== undefined && (
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium text-muted-foreground">Total Fiscal (todos los medios)</span>
                <span className="text-sm font-bold">
                  {formatCurrency(currentCashRegister.salesFiscalTotal)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado de la Caja</CardTitle>
            <CardDescription>Información de la sesión actual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estado</span>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Abierta
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Apertura</span>
              <span className="text-sm text-muted-foreground">
                {openedAt.toLocaleString("es-AR")}
              </span>
            </div>
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
                {currentCashRegister.user.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Sucursal</span>
              <span className="text-sm text-muted-foreground">
                {currentCashRegister.location.name}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Gestionar movimientos de caja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setShowTransactionDialog(true)}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Registrar Ingreso
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setShowTransactionDialog(true)}
            >
              <TrendingDown className="mr-2 h-4 w-4" />
              Registrar Egreso
            </Button>
            <Button
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              variant="outline"
              onClick={() => {
                setTransferAmount("")
                setTransferNotes("")
                setTransferError("")
                setShowTransferDialog(true)
              }}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Enviar a Caja Chica
            </Button>
            <Link href={`/dashboard/cash/${currentCashRegister.id}`} className="block">
              <Button className="w-full" variant="outline">
                Ver Detalles Completos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <OpenCashRegisterDialog
        open={showOpenDialog}
        onOpenChange={setShowOpenDialog}
        onSuccess={handleCashRegisterOpened}
      />

      {currentCashRegister && (
        <>
          <CloseCashRegisterDialog
            open={showCloseDialog}
            onOpenChange={setShowCloseDialog}
            onSuccess={handleCashRegisterClosed}
            cashRegister={currentCashRegister}
          />

          <CashTransactionDialog
            open={showTransactionDialog}
            onOpenChange={setShowTransactionDialog}
            onSuccess={handleTransactionAdded}
            cashRegisterId={currentCashRegister.id}
          />
        </>
      )}

      {/* Transfer to Petty Cash Dialog */}
      <Dialog
        open={showTransferDialog}
        onOpenChange={(open) => {
          if (!transferring) setShowTransferDialog(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar dinero a Caja Chica</DialogTitle>
            <DialogDescription>
              El monto saldrá de la caja de ventas y se acreditará en la Caja Chica.
              Ambos movimientos quedan registrados con el mismo ID de transferencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="transfer-amount">Monto *</Label>
              <Input
                id="transfer-amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                disabled={transferring}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="transfer-notes">Notas (opcional)</Label>
              <Textarea
                id="transfer-notes"
                placeholder="Ej: Refuerzo para gastos de librería"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                disabled={transferring}
                rows={2}
              />
            </div>
            {transferError && (
              <p className="text-sm text-red-600">{transferError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferDialog(false)}
              disabled={transferring}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferring || !transferAmount}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Banknote className="mr-2 h-4 w-4" />
              {transferring ? "Transfiriendo..." : "Confirmar Transferencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
