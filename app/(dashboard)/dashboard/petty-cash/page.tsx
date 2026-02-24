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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Wallet,
  Settings,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// ─── Types ───────────────────────────────────────────────────────────────────

type MovementType = "INCOME" | "EXPENSE" | "TRANSFER_OUT" | "TRANSFER_IN"

interface CashAccount {
  id: string
  name: string
  type: string
  currentBalance: number
}

interface MovementCategory {
  id: string
  name: string
  transactionType: string
}

interface Movement {
  id: string
  type: MovementType
  amount: number
  concept: string
  reference?: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
  user: { name: string | null }
  cashAccount?: { id: string; name: string; type: string } | null
  movementType?: { id: string; name: string } | null
}

interface Fund {
  id: string
  name: string
  currentBalance: number
  fixedFundAmount: number | null
  movements: Movement[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<MovementType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto directo",
  TRANSFER_OUT: "Enviado a cuenta",
  TRANSFER_IN: "Recibido de cuenta",
}

const MOVEMENT_COLORS: Record<MovementType, string> = {
  INCOME: "bg-green-100 text-green-800",
  EXPENSE: "bg-red-100 text-red-800",
  TRANSFER_OUT: "bg-orange-100 text-orange-800",
  TRANSFER_IN: "bg-blue-100 text-blue-800",
}

const isCredit = (type: MovementType) =>
  type === "INCOME" || type === "TRANSFER_IN"

// ─── Component ───────────────────────────────────────────────────────────────

export default function PettyCashPage() {
  const { toast } = useToast()

  const [fund, setFund] = useState<Fund | null>(null)
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [movementTypes, setMovementTypes] = useState<MovementCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [movementType, setMovementType] = useState<MovementType>("INCOME")
  const [formData, setFormData] = useState({
    amount: "",
    concept: "",
    reference: "",
    cashAccountId: "",
    movementTypeId: "",
  })
  const [settingsData, setSettingsData] = useState({
    name: "",
    fixedFundAmount: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchFund = async () => {
    try {
      const res = await fetch("/api/petty-cash")
      if (res.ok) {
        setFund(await res.json())
      }
    } catch (e) {
      console.error("Error fetching fund:", e)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/cash-accounts?active=true")
      if (res.ok) {
        setAccounts(await res.json())
      }
    } catch (e) {
      console.error("Error fetching accounts:", e)
    }
  }

  useEffect(() => {
    fetchFund()
    fetchAccounts()
  }, [])

  useEffect(() => {
    fetch("/api/movement-types")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data))
          setMovementTypes(data.filter((mt: MovementCategory & { isActive?: boolean }) => mt.isActive !== false))
      })
      .catch(() => {}) // silent fail — category is optional
  }, [])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const openDialog = (type: MovementType) => {
    setMovementType(type)
    setFormData({ amount: "", concept: "", reference: "", cashAccountId: "", movementTypeId: "" })
    setShowDialog(true)
  }

  const openSettingsDialog = () => {
    setSettingsData({
      name: fund?.name || "",
      fixedFundAmount: fund?.fixedFundAmount ? String(fund.fixedFundAmount) : "",
    })
    setShowSettingsDialog(true)
  }

  const handleSaveSettings = async () => {
    if (!settingsData.name) {
      toast({
        title: "Faltan datos",
        description: "El nombre es requerido",
        variant: "destructive",
      })
      return
    }

    setSavingSettings(true)
    try {
      const res = await fetch("/api/petty-cash", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsData.name,
          fixedFundAmount: settingsData.fixedFundAmount
            ? parseFloat(settingsData.fixedFundAmount)
            : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desconocido")
      }

      toast({ title: "Configuración actualizada correctamente" })
      setShowSettingsDialog(false)
      fetchFund()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al guardar"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.amount || !formData.concept) {
      toast({
        title: "Faltan datos",
        description: "Completá el monto y el concepto",
        variant: "destructive",
      })
      return
    }

    const needsAccount =
      movementType === "TRANSFER_OUT" || movementType === "TRANSFER_IN"
    if (needsAccount && !formData.cashAccountId) {
      toast({
        title: "Seleccioná una cuenta",
        description: "Debés elegir la cuenta destino/origen",
        variant: "destructive",
      })
      return
    }

    const parsedAmount = parseFloat(formData.amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Ingresá un monto mayor a 0",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/petty-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          amount: parsedAmount,
          concept: formData.concept,
          reference: formData.reference || undefined,
          cashAccountId: formData.cashAccountId || undefined,
          movementTypeId: formData.movementTypeId || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desconocido")
      }

      toast({ title: "Movimiento registrado correctamente" })
      setShowDialog(false)
      fetchFund()
      fetchAccounts()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al registrar"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  const previewBalance = () => {
    if (!fund || !formData.amount) return null
    const amt = parseFloat(formData.amount)
    if (isNaN(amt) || amt <= 0) return null
    const after = isCredit(movementType)
      ? fund.currentBalance + amt
      : fund.currentBalance - amt
    return after
  }

  const dialogTitles: Record<MovementType, string> = {
    INCOME: "Ingresar Fondos a Caja Chica",
    EXPENSE: "Registrar Gasto Directo",
    TRANSFER_OUT: "Enviar Dinero a una Cuenta",
    TRANSFER_IN: "Recibir Dinero de una Cuenta",
  }

  const dialogDescriptions: Record<MovementType, string> = {
    INCOME: "Ingresá dinero a la caja chica (reposición, fondos iniciales, etc.)",
    EXPENSE: "Registrá un pago o gasto realizado directamente desde la caja chica",
    TRANSFER_OUT:
      "El dinero saldrá de la Caja Chica y se acreditará en la cuenta seleccionada",
    TRANSFER_IN:
      "El dinero retornará desde la cuenta seleccionada a la Caja Chica",
  }

  const conceptPlaceholders: Record<MovementType, string> = {
    INCOME: "Ej: Reposición de fondos",
    EXPENSE: "Ej: Pago flete correo",
    TRANSFER_OUT: "Ej: Para pago factura mayo - Editorial Atlántida",
    TRANSFER_IN: "Ej: Devolución sobrante del sobre",
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando caja chica...</p>
        </div>
      </div>
    )
  }

  const previewAmt = previewBalance()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caja Chica</h1>
          <p className="text-muted-foreground">Gestión de efectivo y fondos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openSettingsDialog}>
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
          <Link href="/dashboard/cash-accounts">
            <Button variant="outline">Ver Cuentas</Button>
          </Link>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Saldo Actual
          </CardTitle>
          <CardDescription>{fund?.name ?? "Caja Chica"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-5xl font-bold text-primary">
              {formatCurrency(Number(fund?.currentBalance ?? 0))}
            </div>

            {fund?.fixedFundAmount && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fondo fijo:</span>
                  <span className="font-medium">
                    {formatCurrency(Number(fund.fixedFundAmount))}
                  </span>
                </div>

                {Number(fund.currentBalance) < Number(fund.fixedFundAmount) && (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-900">
                        Reposición necesaria
                      </p>
                      <p className="text-xs text-orange-700">
                        Falta: {formatCurrency(
                          Number(fund.fixedFundAmount) - Number(fund.currentBalance)
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          onClick={() => openDialog("INCOME")}
          className="h-20 flex-col gap-2 bg-green-600 hover:bg-green-700"
        >
          <ArrowDownCircle className="h-6 w-6" />
          <span>Ingresar Fondos</span>
        </Button>

        <Button
          onClick={() => openDialog("EXPENSE")}
          variant="destructive"
          className="h-20 flex-col gap-2"
        >
          <ArrowUpCircle className="h-6 w-6" />
          <span>Gasto Directo</span>
        </Button>

        <Button
          onClick={() => openDialog("TRANSFER_OUT")}
          variant="outline"
          className="h-20 flex-col gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
        >
          <ArrowRightLeft className="h-6 w-6" />
          <span>Enviar a Cuenta</span>
        </Button>

        <Button
          onClick={() => openDialog("TRANSFER_IN")}
          variant="outline"
          className="h-20 flex-col gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
        >
          <ArrowRightLeft className="h-6 w-6" />
          <span>Recibir de Cuenta</span>
        </Button>
      </div>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>Últimos 20 movimientos de la caja chica</CardDescription>
        </CardHeader>
        <CardContent>
          {!fund?.movements || fund.movements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay movimientos registrados aún
            </p>
          ) : (
            <div className="space-y-2">
              {fund.movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={MOVEMENT_COLORS[m.type]}>
                      {MOVEMENT_LABELS[m.type]}
                    </Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{m.concept}</p>
                        {m.movementType && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                            {m.movementType.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.cashAccount && (
                          <span className="mr-1">→ {m.cashAccount.name} ·</span>
                        )}
                        {m.user.name} ·{" "}
                        {new Date(m.createdAt).toLocaleString("es-AR")}
                        {m.reference && (
                          <span className="ml-1 italic">({m.reference})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p
                      className={`font-bold ${
                        isCredit(m.type) ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCredit(m.type) ? "+" : "-"}
                      {formatCurrency(Number(m.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: {formatCurrency(Number(m.balanceAfter))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movement Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitles[movementType]}</DialogTitle>
            <DialogDescription>
              {dialogDescriptions[movementType]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Account selector for transfers */}
            {(movementType === "TRANSFER_OUT" ||
              movementType === "TRANSFER_IN") && (
              <div className="space-y-2">
                <Label>
                  Cuenta{" "}
                  {movementType === "TRANSFER_OUT" ? "destino" : "origen"} *
                </Label>
                {accounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground border rounded p-3 bg-muted/40">
                    No tenés cuentas creadas.{" "}
                    <Link
                      href="/dashboard/cash-accounts"
                      className="underline text-primary"
                    >
                      Crear una cuenta
                    </Link>
                  </div>
                ) : (
                  <Select
                    value={formData.cashAccountId}
                    onValueChange={(v) =>
                      setFormData({ ...formData, cashAccountId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una cuenta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {formatCurrency(Number(a.currentBalance))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Category selector — only for EXPENSE movements */}
            {movementType === "EXPENSE" && (
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={formData.movementTypeId}
                  onValueChange={(v) =>
                    setFormData({ ...formData, movementTypeId: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría (opcional)</SelectItem>
                    {movementTypes
                      .filter((mt) => mt.transactionType === "EXPENSE")
                      .map((mt) => (
                        <SelectItem key={mt.id} value={mt.id}>
                          {mt.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
              />
              {previewAmt !== null && (
                <p
                  className={`text-sm ${
                    previewAmt < 0 ? "text-red-500" : "text-muted-foreground"
                  }`}
                >
                  Saldo después:{" "}
                  <strong>{formatCurrency(previewAmt)}</strong>
                  {previewAmt < 0 && " — Saldo insuficiente"}
                </p>
              )}
            </div>

            {/* Concept */}
            <div className="space-y-2">
              <Label htmlFor="concept">Concepto *</Label>
              <Input
                id="concept"
                value={formData.concept}
                onChange={(e) =>
                  setFormData({ ...formData, concept: e.target.value })
                }
                placeholder={conceptPlaceholders[movementType]}
              />
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia (opcional)</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
                placeholder="Nro. remito, recibo, etc."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting || (previewAmt !== null && previewAmt < 0)}
              >
                {submitting ? "Guardando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuración de Caja Chica</DialogTitle>
            <DialogDescription>
              Configura el nombre y el monto del fondo fijo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="fund-name">Nombre *</Label>
              <Input
                id="fund-name"
                value={settingsData.name}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, name: e.target.value })
                }
                placeholder="Caja Chica"
              />
            </div>

            {/* Fixed Fund Amount */}
            <div className="space-y-2">
              <Label htmlFor="fixed-fund">Monto del Fondo Fijo (opcional)</Label>
              <Input
                id="fixed-fund"
                type="number"
                step="0.01"
                min="0"
                value={settingsData.fixedFundAmount}
                onChange={(e) =>
                  setSettingsData({
                    ...settingsData,
                    fixedFundAmount: e.target.value,
                  })
                }
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Si se establece un monto fijo, se mostrará una alerta cuando el
                saldo sea menor y se indicará cuánto falta para reponer
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSettingsDialog(false)}
                disabled={savingSettings}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
