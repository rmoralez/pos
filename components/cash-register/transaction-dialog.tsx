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

interface MovementType {
  id: string
  name: string
  description: string | null
  transactionType: "INCOME" | "EXPENSE"
}

interface CashTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  cashRegisterId: string
}

export function CashTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
  cashRegisterId,
}: CashTransactionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([])
  const [formData, setFormData] = useState({
    movementTypeId: "",
    amount: "",
    reason: "",
    reference: "",
  })

  // Fetch movement types when dialog opens
  useEffect(() => {
    if (open) {
      fetchMovementTypes()
    }
  }, [open])

  const fetchMovementTypes = async () => {
    setLoadingTypes(true)
    try {
      const response = await fetch("/api/movement-types")
      if (!response.ok) {
        throw new Error("Error al cargar tipos de movimiento")
      }
      const types = await response.json()
      setMovementTypes(types)

      // Set default selection to first type if available
      if (types.length > 0 && !formData.movementTypeId) {
        setFormData(prev => ({ ...prev, movementTypeId: types[0].id }))
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingTypes(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/cash-registers/${cashRegisterId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementTypeId: formData.movementTypeId,
          amount: parseFloat(formData.amount),
          reason: formData.reason || undefined,
          reference: formData.reference || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al registrar transacción")
      }

      const selectedType = movementTypes.find(t => t.id === formData.movementTypeId)
      const isIncome = selectedType?.transactionType === "INCOME"

      toast({
        title: isIncome ? "Ingreso registrado" : "Egreso registrado",
        description: `Se ha registrado ${isIncome ? "el ingreso" : "el egreso"} exitosamente`,
      })

      // Reset form but keep first movement type selected
      setFormData({
        movementTypeId: movementTypes.length > 0 ? movementTypes[0].id : "",
        amount: "",
        reason: "",
        reference: ""
      })
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

  const selectedType = movementTypes.find(t => t.id === formData.movementTypeId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Transacción</DialogTitle>
          <DialogDescription>
            Registra un ingreso o egreso de efectivo en caja
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="movementType">Tipo de Movimiento *</Label>
              <Select
                value={formData.movementTypeId}
                onValueChange={(value) =>
                  setFormData({ ...formData, movementTypeId: value })
                }
                disabled={loadingTypes}
              >
                <SelectTrigger id="movementType">
                  <SelectValue placeholder={loadingTypes ? "Cargando..." : "Selecciona un tipo"} />
                </SelectTrigger>
                <SelectContent>
                  {movementTypes.filter(t => t.transactionType === "INCOME").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-green-600">Ingresos</div>
                      {movementTypes
                        .filter(t => t.transactionType === "INCOME")
                        .map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  {movementTypes.filter(t => t.transactionType === "EXPENSE").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-red-600">Egresos</div>
                      {movementTypes
                        .filter(t => t.transactionType === "EXPENSE")
                        .map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-sm text-muted-foreground">
                  {selectedType.transactionType === "INCOME"
                    ? "Dinero que ingresa a la caja"
                    : "Dinero que sale de la caja"}
                  {selectedType.description && ` - ${selectedType.description}`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (Opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Descripción adicional del motivo..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Información adicional sobre la transacción
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Referencia (Opcional)</Label>
              <Input
                id="reference"
                placeholder="Número de factura, recibo, etc."
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
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar Transacción"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
