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

interface OpenCashRegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function OpenCashRegisterDialog({
  open,
  onOpenChange,
  onSuccess,
}: OpenCashRegisterDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    openingBalance: "",
    notes: "",
  })
  const [errors, setErrors] = useState<{ openingBalance?: string }>({})

  const validate = (): boolean => {
    const newErrors: { openingBalance?: string } = {}

    if (formData.openingBalance === "" || formData.openingBalance === null) {
      newErrors.openingBalance = "El balance inicial es obligatorio"
    } else {
      const value = parseFloat(formData.openingBalance)
      if (isNaN(value)) {
        newErrors.openingBalance = "Ingresá un monto válido"
      } else if (value < 0) {
        newErrors.openingBalance = "El balance no puede ser negativo"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/cash-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingBalance: parseFloat(formData.openingBalance),
          notes: formData.notes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al abrir caja")
      }

      toast({
        title: "Caja abierta",
        description: "La caja ha sido abierta exitosamente",
      })

      setFormData({ openingBalance: "", notes: "" })
      setErrors({})
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setErrors({})
      setFormData({ openingBalance: "", notes: "" })
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir Caja</DialogTitle>
          <DialogDescription>
            Ingresa el balance inicial de efectivo en caja
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Balance Inicial *</Label>
              <Input
                id="openingBalance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.openingBalance}
                onChange={(e) => {
                  setFormData({ ...formData, openingBalance: e.target.value })
                  if (errors.openingBalance) {
                    setErrors({})
                  }
                }}
                className={errors.openingBalance ? "border-red-500" : ""}
              />
              {errors.openingBalance ? (
                <p className="text-sm text-red-500">{errors.openingBalance}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Monto de efectivo con el que se inicia la caja
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Observaciones sobre la apertura..."
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
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Abriendo..." : "Abrir Caja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
