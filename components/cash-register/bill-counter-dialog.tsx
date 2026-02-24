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
import { Calculator } from "lucide-react"

interface BillCounterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (total: number) => void
  currentValue?: number
}

// Denominaciones comunes en Argentina
const DEFAULT_DENOMINATIONS = [
  { value: 1000, label: "$1.000" },
  { value: 500, label: "$500" },
  { value: 200, label: "$200" },
  { value: 100, label: "$100" },
  { value: 50, label: "$50" },
  { value: 20, label: "$20" },
  { value: 10, label: "$10" },
  { value: 5, label: "$5" },
  { value: 2, label: "$2" },
  { value: 1, label: "$1" },
  { value: 0.50, label: "$0,50" },
  { value: 0.25, label: "$0,25" },
  { value: 0.10, label: "$0,10" },
  { value: 0.05, label: "$0,05" },
]

export function BillCounterDialog({
  open,
  onOpenChange,
  onConfirm,
  currentValue,
}: BillCounterDialogProps) {
  const [counts, setCounts] = useState<Record<number, number>>({})

  // Reset counts when dialog opens
  useEffect(() => {
    if (open) {
      setCounts({})
    }
  }, [open])

  const handleCountChange = (denomination: number, count: string) => {
    const numCount = parseInt(count) || 0
    setCounts((prev) => ({
      ...prev,
      [denomination]: numCount,
    }))
  }

  const calculateTotal = () => {
    return Object.entries(counts).reduce((total, [denomination, count]) => {
      return total + parseFloat(denomination) * count
    }, 0)
  }

  const handleConfirm = () => {
    const total = calculateTotal()
    onConfirm(total)
    onOpenChange(false)
  }

  const handleClear = () => {
    setCounts({})
  }

  const total = calculateTotal()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Contador de Billetes y Monedas
          </DialogTitle>
          <DialogDescription>
            Ingresa la cantidad de cada denominación para calcular el total automáticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary at top */}
          <div className="sticky top-0 bg-background z-10 rounded-lg border-2 border-primary bg-primary/5 p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total Contado:</span>
              <span className="text-3xl font-bold text-primary">
                ${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Denominations Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DEFAULT_DENOMINATIONS.map((denom) => {
              const count = counts[denom.value] || 0
              const subtotal = denom.value * count

              return (
                <div
                  key={denom.value}
                  className="border rounded-lg p-3 space-y-2 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`denom-${denom.value}`}
                      className="text-base font-semibold"
                    >
                      {denom.label}
                    </Label>
                    {subtotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ${subtotal.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                  <Input
                    id={`denom-${denom.value}`}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={count || ""}
                    onChange={(e) => handleCountChange(denom.value, e.target.value)}
                    className="text-center text-lg"
                  />
                </div>
              )
            })}
          </div>

          {/* Summary by type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-4 border-t">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3">
              <div className="text-sm text-muted-foreground mb-1">Billetes Grandes</div>
              <div className="text-xl font-bold">
                ${[1000, 500, 200]
                  .reduce((sum, val) => sum + (counts[val] || 0) * val, 0)
                  .toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3">
              <div className="text-sm text-muted-foreground mb-1">Billetes Chicos</div>
              <div className="text-xl font-bold">
                ${[100, 50, 20, 10]
                  .reduce((sum, val) => sum + (counts[val] || 0) * val, 0)
                  .toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3">
              <div className="text-sm text-muted-foreground mb-1">Monedas</div>
              <div className="text-xl font-bold">
                ${[5, 2, 1, 0.5, 0.25, 0.1, 0.05]
                  .reduce((sum, val) => sum + (counts[val] || 0) * val, 0)
                  .toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={Object.keys(counts).length === 0}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-primary"
          >
            Usar este Total (${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
