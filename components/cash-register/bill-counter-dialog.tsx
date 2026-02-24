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

interface Denomination {
  value: number
  label: string
}

// ============================================================================
// DENOMINACIONES POR DEFECTO
// ============================================================================
// Estas denominaciones se usan solo si el tenant no ha configurado las suyas.
// Para modificar las denominaciones, ve a Configuración > Denominaciones
// ============================================================================

const DEFAULT_DENOMINATIONS: Denomination[] = [
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
  const [denominations, setDenominations] = useState<Denomination[]>(DEFAULT_DENOMINATIONS)
  const [counts, setCounts] = useState<Record<number, number>>({})

  // Fetch denominations from API on mount
  useEffect(() => {
    const fetchDenominations = async () => {
      try {
        const response = await fetch("/api/denominations")
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            setDenominations(data.map((d: any) => ({
              value: Number(d.value),
              label: d.label,
            })))
          }
        }
        // If fetch fails or returns empty, keep DEFAULT_DENOMINATIONS
      } catch (error) {
        console.error("Error fetching denominations:", error)
        // Keep DEFAULT_DENOMINATIONS on error
      }
    }

    fetchDenominations()
  }, [])

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
          <div className="sticky top-0 bg-background z-10 rounded-lg border-2 border-primary bg-primary/5 p-3 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Contado:</span>
              <span className="text-2xl font-bold text-primary">
                ${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Denominations Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-semibold text-xs">Denominación</th>
                  <th className="text-center p-2 font-semibold w-24 text-xs">Cantidad</th>
                  <th className="text-right p-2 font-semibold w-32 text-xs">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {denominations.map((denom, index) => {
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
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{denom.label}</span>
                          {isBigBill && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Billete grande
                            </span>
                          )}
                          {isSmallBill && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              Billete
                            </span>
                          )}
                          {isCoin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Moneda
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <Input
                          id={`denom-${denom.value}`}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={count || ""}
                          onChange={(e) => handleCountChange(denom.value, e.target.value)}
                          className="text-center h-8 w-full"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <span className={`font-semibold ${subtotal > 0 ? "text-primary" : "text-muted-foreground"}`}>
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
                  <td colSpan={2} className="p-2 text-right font-bold">
                    TOTAL:
                  </td>
                  <td className="p-2 text-right">
                    <span className="text-xl font-bold text-primary">
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
