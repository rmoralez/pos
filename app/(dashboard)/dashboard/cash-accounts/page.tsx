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
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Pencil, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TransferDialog } from "@/components/cash-accounts/transfer-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = "SUPPLIER" | "OWNER" | "OPERATIONAL" | "BANK" | "CASH" | "OTHER"
type MovementType = "PAID" | "RECEIVED"

interface MovementTypeOption {
  id: string
  name: string
  transactionType: string
  isActive: boolean
}

interface CashAccount {
  id: string
  name: string
  type: AccountType
  description?: string | null
  currentBalance: number
  isActive: boolean
  supplier?: { id: string; name: string } | null
  _count: { movements: number }
}

interface Movement {
  id: string
  type: MovementType | "RETURNED" | "TRANSFER_IN" | "TRANSFER_OUT"
  amount: number
  concept: string
  reference?: string | null
  balanceBefore: number
  balanceAfter: number
  createdAt: string
  user: { name: string | null }
  movementType?: { id: string; name: string } | null
}

interface AccountDetail extends Omit<CashAccount, "_count"> {
  movements: Movement[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  SUPPLIER: "Proveedor",
  OWNER: "Titular",
  OPERATIONAL: "Operativo",
  BANK: "Banco",
  CASH: "Efectivo",
  OTHER: "Otro",
}

const TYPE_COLORS: Record<AccountType, string> = {
  SUPPLIER: "bg-purple-100 text-purple-800",
  OWNER: "bg-blue-100 text-blue-800",
  OPERATIONAL: "bg-yellow-100 text-yellow-800",
  BANK: "bg-green-100 text-green-800",
  CASH: "bg-emerald-100 text-emerald-800",
  OTHER: "bg-gray-100 text-gray-800",
}

const MOVEMENT_LABELS: Record<string, string> = {
  PAID: "Pago",
  RECEIVED: "Ingreso",
  RETURNED: "Devolución",
  TRANSFER_IN: "Transferencia Entrada",
  TRANSFER_OUT: "Transferencia Salida",
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CashAccountsPage() {
  const { toast } = useToast()

  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<AccountDetail | null>(null)
  const [movementTypes, setMovementTypes] = useState<MovementTypeOption[]>([])

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Form state
  const [createData, setCreateData] = useState({
    name: "",
    type: "SUPPLIER" as AccountType,
    description: "",
  })
  const [editData, setEditData] = useState({
    name: "",
    type: "SUPPLIER" as AccountType,
    description: "",
  })
  const [movementData, setMovementData] = useState({
    type: "PAID" as MovementType,
    amount: "",
    concept: "",
    reference: "",
    movementTypeId: "",
  })
  const [submitting, setSubmitting] = useState(false)

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/cash-accounts")
      if (res.ok) {
        setAccounts(await res.json())
      }
    } catch (e) {
      console.error("Error fetching accounts:", e)
    } finally {
      setLoading(false)
    }
  }

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/cash-accounts/${id}`)
      if (res.ok) {
        setSelectedAccount(await res.json())
        setShowDetailDialog(true)
      }
    } catch (e) {
      console.error("Error fetching account detail:", e)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  useEffect(() => {
    fetch("/api/movement-types")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data))
          setMovementTypes(data.filter((mt: MovementTypeOption) => mt.isActive))
      })
      .catch(() => {}) // silent fail — category is optional
  }, [])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createData.name.trim() || !createData.type) {
      toast({
        title: "Faltan datos",
        description: "Nombre y tipo son requeridos",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cash-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createData.name.trim(),
          type: createData.type,
          description: createData.description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desconocido")
      }

      toast({ title: "Cuenta creada correctamente" })
      setShowCreateDialog(false)
      setCreateData({ name: "", type: "SUPPLIER", description: "" })
      fetchAccounts()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al crear"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const openMovementDialog = (type: MovementType) => {
    setMovementData({ type, amount: "", concept: "", reference: "", movementTypeId: "" })
    setShowMovementDialog(true)
  }

  const handleMovement = async () => {
    if (!selectedAccount) return
    if (!movementData.amount || !movementData.concept.trim()) {
      toast({
        title: "Faltan datos",
        description: "Completá el monto y el concepto",
        variant: "destructive",
      })
      return
    }

    const parsedAmount = parseFloat(movementData.amount)
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
      const res = await fetch(
        `/api/cash-accounts/${selectedAccount.id}/movements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: movementData.type,
            amount: parsedAmount,
            concept: movementData.concept.trim(),
            reference: movementData.reference.trim() || undefined,
            movementTypeId: movementData.movementTypeId || undefined,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desconocido")
      }

      toast({ title: "Movimiento registrado correctamente" })
      setShowMovementDialog(false)
      // Refresh accounts list and detail
      fetchAccounts()
      fetchDetail(selectedAccount.id)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al registrar"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = () => {
    if (!selectedAccount) return
    setEditData({
      name: selectedAccount.name,
      type: selectedAccount.type,
      description: selectedAccount.description || "",
    })
    setShowEditDialog(true)
  }

  const handleEdit = async () => {
    if (!selectedAccount) return
    if (!editData.name.trim() || !editData.type) {
      toast({
        title: "Faltan datos",
        description: "Nombre y tipo son requeridos",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cash-accounts/${selectedAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editData.name.trim(),
          type: editData.type,
          description: editData.description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desconocido")
      }

      toast({ title: "Cuenta actualizada correctamente" })
      setShowEditDialog(false)
      fetchAccounts()
      fetchDetail(selectedAccount.id)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al actualizar"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedAccount) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cash-accounts/${selectedAccount.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desconocido")
      }

      toast({ title: "Cuenta eliminada correctamente" })
      setShowDeleteDialog(false)
      setShowDetailDialog(false)
      setSelectedAccount(null)
      fetchAccounts()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al eliminar"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  const previewMovementBalance = () => {
    if (!selectedAccount || !movementData.amount) return null
    const amt = parseFloat(movementData.amount)
    if (isNaN(amt) || amt <= 0) return null
    return movementData.type === "PAID"
      ? Number(selectedAccount.currentBalance) - amt
      : Number(selectedAccount.currentBalance) + amt
  }

  const movementPreview = previewMovementBalance()

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando cuentas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cuentas</h1>
          <p className="text-muted-foreground">
            Fondos y sobres con destino específico
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/petty-cash">
            <Button variant="outline">Caja Chica</Button>
          </Link>
          <Button variant="outline" onClick={() => setShowTransferDialog(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transferir
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">
              No tenés cuentas creadas todavía
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Creá una cuenta para organizar los fondos por destino (proveedor,
              retiro del titular, gastos, etc.)
            </p>
            <Button
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              Crear primera cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => fetchDetail(account.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={TYPE_COLORS[account.type]}>
                    {TYPE_LABELS[account.type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {account._count.movements} movimientos
                  </span>
                </div>
                <CardTitle className="text-lg mt-1">{account.name}</CardTitle>
                {account.description && (
                  <CardDescription>{account.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {formatCurrency(Number(account.currentBalance))}
                </div>
                {account.supplier && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Proveedor: {account.supplier.name}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Create Account Dialog ─────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta</DialogTitle>
            <DialogDescription>
              Creá un fondo con destino específico (proveedor, retiro del
              titular, gastos operativos, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nombre *</Label>
              <Input
                id="create-name"
                value={createData.name}
                onChange={(e) =>
                  setCreateData({ ...createData, name: e.target.value })
                }
                placeholder="Ej: Editorial Atlántida, Retiro Mayo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-type">Tipo *</Label>
              <Select
                value={createData.type}
                onValueChange={(v) =>
                  setCreateData({ ...createData, type: v as AccountType })
                }
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Proveedor</SelectItem>
                  <SelectItem value="OWNER">Titular</SelectItem>
                  <SelectItem value="OPERATIONAL">Operativo</SelectItem>
                  <SelectItem value="BANK">Banco</SelectItem>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-desc">Descripción (opcional)</Label>
              <Input
                id="create-desc"
                value={createData.description}
                onChange={(e) =>
                  setCreateData({ ...createData, description: e.target.value })
                }
                placeholder="Ej: Pago mensual libros escolares"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreateDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={submitting}
              >
                {submitting ? "Creando..." : "Crear Cuenta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Account Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {selectedAccount && (
                <Badge className={TYPE_COLORS[selectedAccount.type]}>
                  {TYPE_LABELS[selectedAccount.type]}
                </Badge>
              )}
              {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>
              Saldo actual:{" "}
              <strong>
                {formatCurrency(Number(selectedAccount?.currentBalance ?? 0))}
              </strong>
              {selectedAccount?.description && (
                <span className="block mt-1 text-muted-foreground">
                  {selectedAccount.description}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => openMovementDialog("PAID")}
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Registrar Pago
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => openMovementDialog("RECEIVED")}
              >
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                Ingresar Dinero
              </Button>
            </div>

            {/* Edit and Delete buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={openEditDialog}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar Cuenta
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </div>

            {/* Movement history */}
            {selectedAccount?.movements &&
            selectedAccount.movements.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Historial de movimientos
                </h3>
                {selectedAccount.movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 border rounded-lg text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge
                          variant={m.type === "PAID" || m.type === "TRANSFER_OUT" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {MOVEMENT_LABELS[m.type] ?? m.type}
                        </Badge>
                        <span className="font-medium truncate">{m.concept}</span>
                        {m.movementType && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                            {m.movementType.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.user.name} ·{" "}
                        {new Date(m.createdAt).toLocaleString("es-AR")}
                        {m.reference && (
                          <span className="ml-1 italic">({m.reference})</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p
                        className={`font-bold ${
                          m.type === "PAID" || m.type === "TRANSFER_OUT"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {m.type === "PAID" || m.type === "TRANSFER_OUT" ? "-" : "+"}
                        {formatCurrency(Number(m.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: {formatCurrency(Number(m.balanceAfter))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Sin movimientos registrados
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Movement Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementData.type === "PAID"
                ? "Registrar Pago"
                : "Ingresar Dinero"}
            </DialogTitle>
            <DialogDescription>
              {movementData.type === "PAID"
                ? `Se descontará del saldo de "${selectedAccount?.name}"`
                : `Se sumará al saldo de "${selectedAccount?.name}"`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mov-amount">Monto *</Label>
              <Input
                id="mov-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={movementData.amount}
                onChange={(e) =>
                  setMovementData({ ...movementData, amount: e.target.value })
                }
                placeholder="0.00"
              />
              {movementPreview !== null && (
                <p
                  className={`text-sm ${
                    movementPreview < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  Saldo después:{" "}
                  <strong>{formatCurrency(movementPreview)}</strong>
                  {movementPreview < 0 && " — Saldo insuficiente"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-concept">Concepto *</Label>
              <Input
                id="mov-concept"
                value={movementData.concept}
                onChange={(e) =>
                  setMovementData({ ...movementData, concept: e.target.value })
                }
                placeholder={
                  movementData.type === "PAID"
                    ? "Ej: Pago factura 0001-00001234"
                    : "Ej: Ingreso desde caja chica"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-ref">Referencia (opcional)</Label>
              <Input
                id="mov-ref"
                value={movementData.reference}
                onChange={(e) =>
                  setMovementData({ ...movementData, reference: e.target.value })
                }
                placeholder="Nro. factura, remito, etc."
              />
            </div>

            {movementData.type === "PAID" && (
              <div className="space-y-2">
                <Label htmlFor="mov-movement-type">Categoría de Gasto (opcional)</Label>
                <Select
                  value={movementData.movementTypeId || "__none__"}
                  onValueChange={(v) =>
                    setMovementData({
                      ...movementData,
                      movementTypeId: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger id="mov-movement-type">
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

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowMovementDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleMovement}
                disabled={
                  submitting ||
                  (movementPreview !== null && movementPreview < 0)
                }
              >
                {submitting ? "Guardando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Transfer Dialog ───────────────────────────────────────────────── */}
      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        onSuccess={() => {
          fetchAccounts()
          if (selectedAccount) {
            fetchDetail(selectedAccount.id)
          }
        }}
      />

      {/* ─── Edit Account Dialog ───────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cuenta</DialogTitle>
            <DialogDescription>
              Modificá los datos de la cuenta
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                value={editData.name}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                placeholder="Ej: Editorial Atlántida, Retiro Mayo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo *</Label>
              <Select
                value={editData.type}
                onValueChange={(v) =>
                  setEditData({ ...editData, type: v as AccountType })
                }
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Proveedor</SelectItem>
                  <SelectItem value="OWNER">Titular</SelectItem>
                  <SelectItem value="OPERATIONAL">Operativo</SelectItem>
                  <SelectItem value="BANK">Banco</SelectItem>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descripción (opcional)</Label>
              <Input
                id="edit-desc"
                value={editData.description}
                onChange={(e) =>
                  setEditData({ ...editData, description: e.target.value })
                }
                placeholder="Ej: Pago mensual libros escolares"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEditDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleEdit}
                disabled={submitting}
              >
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que querés eliminar la cuenta &quot;{selectedAccount?.name}&quot;?
              <br />
              <br />
              {selectedAccount?.movements && selectedAccount.movements.length > 0 ? (
                <span className="text-destructive font-medium">
                  Esta cuenta tiene {selectedAccount.movements.length} movimientos registrados
                  y no podrá ser eliminada.
                </span>
              ) : (
                <span>
                  Esta acción no se puede deshacer. La cuenta será marcada como inactiva.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                submitting ||
                (selectedAccount?.movements && selectedAccount.movements.length > 0)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Eliminando..." : "Eliminar Cuenta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
