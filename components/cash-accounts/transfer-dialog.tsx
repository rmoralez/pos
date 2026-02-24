"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CashAccount {
  id: string
  name: string
  type: string
  currentBalance: number
  isActive: boolean
}

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TransferDialog({
  open,
  onOpenChange,
  onSuccess,
}: TransferDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<CashAccount[]>([])

  // Form state
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [concept, setConcept] = useState("")
  const [reference, setReference] = useState("")

  // Load accounts on mount
  useEffect(() => {
    if (open) {
      fetchAccounts()
      resetForm()
    }
  }, [open])

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/cash-accounts")
      if (response.ok) {
        const data = await response.json()
        // Filter only active accounts
        setAccounts(data.filter((acc: CashAccount) => acc.isActive))
      }
    } catch (error) {
      console.error("Error fetching accounts:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFromAccountId("")
    setToAccountId("")
    setAmount("")
    setConcept("")
    setReference("")
  }

  const fromAccount = accounts.find((acc) => acc.id === fromAccountId)
  const toAccount = accounts.find((acc) => acc.id === toAccountId)
  const amountNum = parseFloat(amount || "0")

  // Available accounts for "To" dropdown (exclude selected "From" account)
  const availableToAccounts = accounts.filter(
    (acc) => acc.id !== fromAccountId
  )

  // Validation
  const hasInsufficientBalance =
    fromAccount && amountNum > fromAccount.currentBalance
  const isValid =
    fromAccountId &&
    toAccountId &&
    fromAccountId !== toAccountId &&
    amountNum > 0 &&
    !hasInsufficientBalance &&
    concept.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      toast({
        title: "Datos incompletos",
        description: "Complete todos los campos requeridos",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      const response = await fetch("/api/cash-accounts/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: amountNum,
          concept: concept.trim(),
          reference: reference.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create transfer")
      }

      const result = await response.json()

      toast({
        title: "Transferencia exitosa",
        description: `${formatCurrency(result.transfer.amount)} transferido de ${result.transfer.fromAccount.name} a ${result.transfer.toAccount.name}`,
      })

      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error creating transfer:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo realizar la transferencia",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir entre Cuentas</DialogTitle>
          <DialogDescription>
            Transfiere dinero de una cuenta a otra
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* From Account */}
          <div className="space-y-2">
            <Label htmlFor="fromAccount">Desde Cuenta *</Label>
            <Select
              value={fromAccountId}
              onValueChange={(value) => {
                setFromAccountId(value)
                // If "to" account is the same, clear it
                if (value === toAccountId) {
                  setToAccountId("")
                }
              }}
            >
              <SelectTrigger id="fromAccount">
                <SelectValue placeholder="Seleccione cuenta origen" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - {formatCurrency(account.currentBalance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromAccount && (
              <p className="text-xs text-muted-foreground">
                Saldo disponible: {formatCurrency(fromAccount.currentBalance)}
              </p>
            )}
          </div>

          {/* Transfer Arrow */}
          {fromAccountId && (
            <div className="flex justify-center py-2">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          {/* To Account */}
          <div className="space-y-2">
            <Label htmlFor="toAccount">Hacia Cuenta *</Label>
            <Select
              value={toAccountId}
              onValueChange={setToAccountId}
              disabled={!fromAccountId}
            >
              <SelectTrigger id="toAccount">
                <SelectValue placeholder="Seleccione cuenta destino" />
              </SelectTrigger>
              <SelectContent>
                {availableToAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - {formatCurrency(account.currentBalance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {toAccount && (
              <p className="text-xs text-muted-foreground">
                Saldo actual: {formatCurrency(toAccount.currentBalance)}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Monto *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {hasInsufficientBalance && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Saldo insuficiente. Disponible: {formatCurrency(fromAccount!.currentBalance)}
                </AlertDescription>
              </Alert>
            )}
            {fromAccount && amountNum > 0 && !hasInsufficientBalance && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Saldo después en {fromAccount.name}:{" "}
                  <span className="font-medium">
                    {formatCurrency(fromAccount.currentBalance - amountNum)}
                  </span>
                </p>
                {toAccount && (
                  <p>
                    Saldo después en {toAccount.name}:{" "}
                    <span className="font-medium">
                      {formatCurrency(toAccount.currentBalance + amountNum)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Concept */}
          <div className="space-y-2">
            <Label htmlFor="concept">Concepto *</Label>
            <Textarea
              id="concept"
              placeholder="Ej: Reposición de fondos, Ajuste de caja, etc."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              rows={2}
            />
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Input
              id="reference"
              placeholder="Número de comprobante, autorización, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transferir
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
