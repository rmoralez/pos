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

// ============================================================================
// CONFIGURACIÓN DE DENOMINACIONES
// ============================================================================
// Para agregar, quitar o modificar denominaciones, edita este array:
// - value: valor numérico de la denominación
// - label: texto a mostrar (usa coma para decimales: "$0,50")
//
// Las denominaciones se clasifican automáticamente como:
// - Billetes grandes: >= $200
// - Billetes chicos: >= $10 y < $200
// - Monedas: < $10
// ============================================================================

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
          <div className="sticky top-0 bg-background z-10 rounded-lg border-2 border-primary bg-primary/5 p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total Contado:</span>
              <span className="text-3xl font-bold text-primary">
                ${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Denominations Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-semibold">Denominación</th>
                  <th className="text-center p-3 font-semibold w-32">Cantidad</th>
                  <th className="text-right p-3 font-semibold w-40">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_DENOMINATIONS.map((denom, index) => {
                  const count = counts[denom.value] || 0
                  const subtotal = denom.value * count
                  const isBigBill = denom.value >= 200
                  const isSmallBill = denom.value >= 10 && denom.value < 200
                  const isCoin = denom.value < 10

                  return (
                    <tr
                      key={denom.value}
                      className={`border-t hover:bg-accent/50 transition-colors ${
                        count > 0 ? "bg-accent/20" : ""
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{denom.label}</span>
                          {isBigBill && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Billete grande
                            </span>
                          )}
                          {isSmallBill && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              Billete
                            </span>
                          )}
                          {isCoin && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Moneda
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Input
                          id={`denom-${denom.value}`}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={count || ""}
                          onChange={(e) => handleCountChange(denom.value, e.target.value)}
                          className="text-center text-lg w-full"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <span className={`text-lg font-semibold ${subtotal > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          ${subtotal.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-muted border-t-2">
                <tr>
                  <td colSpan={2} className="p-3 text-right font-bold text-lg">
                    TOTAL:
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-2xl font-bold text-primary">
                      ${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
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
