"use client"

import { useState } from "react"
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
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { AlertCircle, Calculator } from "lucide-react"
import { BillCounterDialog } from "./bill-counter-dialog"

interface CloseCashRegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  cashRegister: {
    id: string
    openingBalance: number
    currentBalance?: number
  }
}

export function CloseCashRegisterDialog({
  open,
  onOpenChange,
  onSuccess,
  cashRegister,
}: CloseCashRegisterDialogProps) {
  const [loading, setLoading] = useState(false)
  const [showBillCounter, setShowBillCounter] = useState(false)
  const [formData, setFormData] = useState({
    closingBalance: "",
    notes: "",
  })

  const expectedBalance = cashRegister.currentBalance || 0
  const closingBalance = parseFloat(formData.closingBalance) || 0
  const difference = closingBalance - expectedBalance

  const handleBillCounterConfirm = (total: number) => {
    setFormData({ ...formData, closingBalance: total.toFixed(2) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/cash-registers/${cashRegister.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingBalance: parseFloat(formData.closingBalance),
          notes: formData.notes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al cerrar caja")
      }

      toast({
        title: "Caja cerrada",
        description: "La caja ha sido cerrada exitosamente",
      })

      setFormData({ closingBalance: "", notes: "" })
      onSuccess()
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar Caja</DialogTitle>
          <DialogDescription>
            Realiza el arqueo de caja e ingresa el monto final
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance Inicial:</span>
                <span className="font-medium">
                  {formatCurrency(cashRegister.openingBalance)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance Esperado:</span>
                <span className="font-medium">{formatCurrency(expectedBalance)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="closingBalance">Balance Final (Contado) *</Label>
              <div className="flex gap-2">
                <Input
                  id="closingBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.closingBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, closingBalance: e.target.value })
                  }
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBillCounter(true)}
                  className="shrink-0"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Contar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Cuenta el dinero físico en caja o usa el contador de billetes
              </p>
            </div>

            {formData.closingBalance && (
              <div
                className={`rounded-lg p-4 ${
                  difference === 0
                    ? "bg-green-50 border border-green-200"
                    : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">
                    {difference === 0
                      ? "Balance Correcto"
                      : difference > 0
                      ? "Sobrante"
                      : "Faltante"}
                  </span>
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(Math.abs(difference))}
                </div>
                {difference !== 0 && (
                  <p className="text-sm mt-1">
                    {difference > 0
                      ? "Hay más dinero del esperado"
                      : "Falta dinero en caja"}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Observaciones sobre el cierre..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
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
              {loading ? "Cerrando..." : "Cerrar Caja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <BillCounterDialog
        open={showBillCounter}
        onOpenChange={setShowBillCounter}
        onConfirm={handleBillCounterConfirm}
        currentValue={closingBalance}
      />
    </Dialog>
  )
}
