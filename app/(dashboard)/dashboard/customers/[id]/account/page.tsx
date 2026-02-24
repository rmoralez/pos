"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  BookOpen,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Settings,
  Plus,
  Clock,
  XCircle,
} from "lucide-react"
import { PaymentDialog } from "@/components/customers/payment-dialog"

interface CustomerAccount {
  id: string
  balance: string
  creditLimit: string
  isActive: boolean
  notes: string | null
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
}

interface Movement {
  id: string
  type: "CHARGE" | "PAYMENT" | "ADJUSTMENT" | "CREDIT"
  amount: string
  concept: string
  reference: string | null
  balanceBefore: string
  balanceAfter: string
  createdAt: string
  dueDate: string | null
  isPaid: boolean
  paidAmount: string
  paidDate: string | null
  user: { id: string; name: string | null; email: string } | null
  sale: { id: string; saleNumber: string } | null
}

const movementTypeLabel: Record<string, string> = {
  CHARGE: "Cargo",
  PAYMENT: "Pago",
  ADJUSTMENT: "Ajuste",
  CREDIT: "Crédito",
}

const movementTypeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CHARGE: "destructive",
  PAYMENT: "default",
  ADJUSTMENT: "secondary",
  CREDIT: "outline",
}

export default function CustomerAccountPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [totalMovements, setTotalMovements] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  // Settings dialog state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [settingsCreditLimit, setSettingsCreditLimit] = useState("")
  const [settingsIsActive, setSettingsIsActive] = useState(true)
  const [settingsNotes, setSettingsNotes] = useState("")
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/account`)
      if (!res.ok) throw new Error("Failed to fetch account")
      const data = await res.json()
      setAccount(data)
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la cuenta", variant: "destructive" })
    }
  }, [customerId])

  const fetchMovements = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/account/movements?limit=50`)
      if (!res.ok) throw new Error("Failed to fetch movements")
      const data = await res.json()
      setMovements(data.movements)
      setTotalMovements(data.total)
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los movimientos", variant: "destructive" })
    }
  }, [customerId])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([fetchAccount(), fetchMovements()])
    setIsLoading(false)
  }, [fetchAccount, fetchMovements])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleOpenSettings = () => {
    if (!account) return
    setSettingsCreditLimit(parseFloat(account.creditLimit).toString())
    setSettingsIsActive(account.isActive)
    setSettingsNotes(account.notes ?? "")
    setShowSettingsDialog(true)
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingSettings(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditLimit: parseFloat(settingsCreditLimit) || 0,
          isActive: settingsIsActive,
          notes: settingsNotes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update account")
      }
      toast({ title: "Configuración guardada", description: "La cuenta fue actualizada" })
      setShowSettingsDialog(false)
      await fetchAccount()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar la cuenta",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingSettings(false)
    }
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const balance = account ? parseFloat(account.balance) : 0
  const creditLimit = account ? parseFloat(account.creditLimit) : 0
  const availableCredit = creditLimit === 0 ? null : creditLimit + balance

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Cargando cuenta corriente...</p>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground">No se encontró la cuenta</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/customers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cuenta Corriente</h1>
            <p className="text-muted-foreground">{account.customer.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenSettings}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
          <Button size="sm" onClick={() => setShowPaymentDialog(true)} disabled={!account.isActive}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        </div>
      </div>

      {/* Account summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance < 0 ? "text-red-600" : "text-green-600"}`}>
              ${balance.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {balance < 0 ? "Deuda pendiente" : balance === 0 ? "Sin deuda" : "A favor"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Límite de Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {creditLimit === 0 ? "Sin límite" : `$${creditLimit.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            {availableCredit !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                Disponible: ${availableCredit.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {account.isActive ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-lg font-semibold text-green-600">Activa</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-lg font-semibold text-red-600">Inactiva</span>
                </>
              )}
            </div>
            {account.notes && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{account.notes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movements table */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>
            Historial de cargos y pagos ({totalMovements} en total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay movimientos registrados</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mov) => {
                    const amount = parseFloat(mov.amount)
                    const balanceAfter = parseFloat(mov.balanceAfter)
                    const paidAmount = parseFloat(mov.paidAmount)
                    const isCharge = mov.type === "CHARGE"
                    const overdue = isOverdue(mov.dueDate)

                    // Determine status badge for charges
                    let statusBadge = null
                    if (isCharge) {
                      if (mov.isPaid) {
                        statusBadge = (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Pagado
                          </Badge>
                        )
                      } else if (paidAmount > 0) {
                        statusBadge = (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Parcial
                          </Badge>
                        )
                      } else if (overdue) {
                        statusBadge = (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Vencido
                          </Badge>
                        )
                      } else {
                        statusBadge = (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendiente
                          </Badge>
                        )
                      }
                    }

                    return (
                      <TableRow key={mov.id} className={overdue && !mov.isPaid ? "bg-red-50" : ""}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(mov.createdAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {mov.dueDate && isCharge && (
                            <div className={`text-xs ${overdue ? "text-red-600 font-medium" : ""}`}>
                              Vto: {new Date(mov.dueDate).toLocaleDateString("es-AR")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={movementTypeVariant[mov.type] ?? "secondary"}>
                            <span className="flex items-center gap-1">
                              {isCharge ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                              {movementTypeLabel[mov.type] ?? mov.type}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {mov.concept}
                          {mov.sale && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({mov.sale.saleNumber})
                            </span>
                          )}
                          {isCharge && paidAmount > 0 && !mov.isPaid && (
                            <div className="text-xs text-green-600 mt-1">
                              Pagado: ${paidAmount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mov.reference ?? "-"}
                        </TableCell>
                        <TableCell>
                          {statusBadge}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isCharge ? "text-red-600" : "text-green-600"}`}>
                          {isCharge ? "-" : "+"}${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        customerId={customerId}
        customerName={account.customer.name}
        onSuccess={loadAll}
      />

      {/* Settings dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Configurar Cuenta Corriente</DialogTitle>
            <DialogDescription>
              Ajusta el límite de crédito y el estado de la cuenta
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="creditLimit">Límite de Crédito</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0 = sin límite"
                  value={settingsCreditLimit}
                  onChange={(e) => setSettingsCreditLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Ingresa 0 para no aplicar límite de crédito</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={settingsIsActive}
                  onChange={(e) => setSettingsIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border border-input"
                />
                <Label htmlFor="isActive" className="cursor-pointer">Cuenta activa</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas internas</Label>
                <Input
                  id="notes"
                  placeholder="Observaciones sobre la cuenta..."
                  value={settingsNotes}
                  onChange={(e) => setSettingsNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingSettings}>
                {isSubmittingSettings ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
