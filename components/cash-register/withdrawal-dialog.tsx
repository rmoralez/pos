"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, DollarSign, TrendingDown } from "lucide-react"

interface CashAccount {
  id: string
  name: string
  type: string
  currentBalance: number
}

interface WithdrawalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  cashRegisterId: string
  availableBalance: number
}

export function WithdrawalDialog({
  open,
  onOpenChange,
  onSuccess,
  cashRegisterId,
  availableBalance,
}: WithdrawalDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [formData, setFormData] = useState({
    amount: "",
    reason: "BANK_DEPOSIT" as
      | "BANK_DEPOSIT"
      | "PETTY_CASH"
      | "OWNER_DRAW"
      | "EXPENSE"
      | "OTHER",
    concept: "",
    recipientName: "",
    destinationAccountId: "",
    reference: "",
  })

  // Fetch cash accounts when dialog opens
  useEffect(() => {
    if (open) {
      fetchCashAccounts()
    }
  }, [open])

  const fetchCashAccounts = async () => {
    setLoadingAccounts(true)
    try {
      const response = await fetch("/api/cash-accounts")
      if (!response.ok) {
        throw new Error("Error al cargar cuentas")
      }
      const data = await response.json()
      setCashAccounts(data.accounts || [])
    } catch (error: any) {
      console.error("Error fetching cash accounts:", error)
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate amount
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error("El monto debe ser mayor a cero")
      }

      if (amount > availableBalance) {
        throw new Error(
          `Saldo insuficiente. Disponible: ${formatCurrency(availableBalance)}`
        )
      }

      // Validate required fields
      if (!formData.recipientName.trim()) {
        throw new Error("El nombre del receptor es requerido")
      }

      if (!formData.concept.trim()) {
        throw new Error("El concepto es requerido")
      }

      const response = await fetch("/api/cash-registers/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashRegisterId,
          amount,
          reason: formData.reason,
          concept: formData.concept,
          recipientName: formData.recipientName,
          destinationAccountId: formData.destinationAccountId || undefined,
          reference: formData.reference || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al registrar retiro")
      }

      toast({
        title: "Retiro registrado",
        description: `Se ha registrado el retiro de ${formatCurrency(amount)} exitosamente`,
      })

      // Reset form
      setFormData({
        amount: "",
        reason: "BANK_DEPOSIT",
        concept: "",
        recipientName: "",
        destinationAccountId: "",
        reference: "",
      })
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const reasonLabels = {
    BANK_DEPOSIT: "Depósito Bancario",
    PETTY_CASH: "Caja Chica",
    OWNER_DRAW: "Retiro del Dueño",
    EXPENSE: "Pago de Gasto",
    OTHER: "Otro",
  }

  const reasonDescriptions = {
    BANK_DEPOSIT: "Dinero que se llevará al banco para depositar",
    PETTY_CASH: "Dinero que se transferirá a la caja chica",
    OWNER_DRAW: "Dinero que retira el dueño del negocio",
    EXPENSE: "Dinero para pagar un gasto en efectivo",
    OTHER: "Otro tipo de retiro autorizado",
  }

  // Filter bank accounts for bank deposit option
  const bankAccounts = cashAccounts.filter((acc) => acc.type === "BANK")
  const showAccountSelector =
    formData.reason === "BANK_DEPOSIT" || formData.reason === "PETTY_CASH"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            Retiro de Efectivo
          </DialogTitle>
          <DialogDescription>
            Registra un retiro de dinero de la caja registradora
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Available Balance Alert */}
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Saldo Disponible:</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(availableBalance)}
                  </span>
                </div>
              </AlertDescription>
            </Alert>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Monto a Retirar *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance}
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
              {parseFloat(formData.amount) > availableBalance && (
                <p className="text-sm text-red-600">
                  El monto excede el saldo disponible
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del Retiro *</Label>
              <Select
                value={formData.reason}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, reason: value })
                }
              >
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {reasonDescriptions[formData.reason]}
              </p>
            </div>

            {/* Destination Account (conditional) */}
            {showAccountSelector && (
              <div className="space-y-2">
                <Label htmlFor="destinationAccount">
                  Cuenta de Destino {formData.reason === "BANK_DEPOSIT" && "*"}
                </Label>
                <Select
                  value={formData.destinationAccountId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, destinationAccountId: value })
                  }
                  disabled={loadingAccounts}
                >
                  <SelectTrigger id="destinationAccount">
                    <SelectValue
                      placeholder={
                        loadingAccounts
                          ? "Cargando..."
                          : "Selecciona una cuenta"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.reason === "BANK_DEPOSIT" &&
                      bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} - {formatCurrency(account.currentBalance)}
                        </SelectItem>
                      ))}
                    {formData.reason === "PETTY_CASH" &&
                      cashAccounts
                        .filter((acc) => acc.type === "CASH")
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} -{" "}
                            {formatCurrency(account.currentBalance)}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                {formData.reason === "BANK_DEPOSIT" && bankAccounts.length === 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No hay cuentas bancarias configuradas. Crea una cuenta
                      bancaria primero.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Recipient Name */}
            <div className="space-y-2">
              <Label htmlFor="recipientName">Receptor del Dinero *</Label>
              <Input
                id="recipientName"
                type="text"
                placeholder="Nombre de quien recibe el dinero"
                value={formData.recipientName}
                onChange={(e) =>
                  setFormData({ ...formData, recipientName: e.target.value })
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Nombre completo de la persona que recibe el efectivo
              </p>
            </div>

            {/* Concept */}
            <div className="space-y-2">
              <Label htmlFor="concept">Concepto/Descripción *</Label>
              <Textarea
                id="concept"
                placeholder="Describe el motivo del retiro..."
                value={formData.concept}
                onChange={(e) =>
                  setFormData({ ...formData, concept: e.target.value })
                }
                rows={3}
                required
              />
            </div>

            {/* Reference (optional) */}
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia (Opcional)</Label>
              <Input
                id="reference"
                type="text"
                placeholder="Número de comprobante, autorización, etc."
                value={formData.reference}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} variant="destructive">
              {loading ? "Procesando..." : "Registrar Retiro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
