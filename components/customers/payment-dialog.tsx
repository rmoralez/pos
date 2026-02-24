"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { AlertCircle, DollarSign, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Charge {
  id: string
  amount: string
  paidAmount: string
  concept: string
  createdAt: string
  dueDate: string | null
  isPaid: boolean
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
  onSuccess?: () => void
}

export function PaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [charges, setCharges] = useState<Charge[]>([])
  const [selectedCharges, setSelectedCharges] = useState<Set<string>>(new Set())
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map())

  // Form state
  const [amount, setAmount] = useState("")
  const [concept, setConcept] = useState("Pago de cuenta corriente")
  const [reference, setReference] = useState("")
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Load unpaid/partially paid charges on mount
  useEffect(() => {
    if (open && customerId) {
      fetchCharges()
      resetForm()
    }
  }, [open, customerId])

  const fetchCharges = async () => {
    try {
      const response = await fetch(
        `/api/customers/${customerId}/account/movements?limit=50`
      )
      if (response.ok) {
        const data = await response.json()
        // Filter unpaid or partially paid charges
        const unpaidCharges = (data.movements || []).filter(
          (mov: any) =>
            mov.type === "CHARGE" &&
            !mov.isPaid &&
            parseFloat(mov.amount) > parseFloat(mov.paidAmount || "0")
        )
        setCharges(unpaidCharges)
      }
    } catch (error) {
      console.error("Error fetching charges:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los cargos",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setAmount("")
    setConcept("Pago de cuenta corriente")
    setReference("")
    setPaymentDate(new Date().toISOString().split("T")[0])
    setSelectedCharges(new Set())
    setAllocations(new Map())
  }

  const handleChargeToggle = (chargeId: string, checked: boolean) => {
    const newSelected = new Set(selectedCharges)
    const newAllocations = new Map(allocations)

    if (checked) {
      newSelected.add(chargeId)
      const charge = charges.find((c) => c.id === chargeId)
      if (charge) {
        const remainingBalance =
          parseFloat(charge.amount) - parseFloat(charge.paidAmount)
        newAllocations.set(chargeId, remainingBalance)
      }
    } else {
      newSelected.delete(chargeId)
      newAllocations.delete(chargeId)
    }

    setSelectedCharges(newSelected)
    setAllocations(newAllocations)
  }

  const handleAllocationChange = (chargeId: string, value: string) => {
    const newAllocations = new Map(allocations)
    const numValue = parseFloat(value) || 0
    newAllocations.set(chargeId, numValue)
    setAllocations(newAllocations)
  }

  const getTotalAllocated = () => {
    let total = 0
    allocations.forEach((amount) => {
      total += amount
    })
    return total
  }

  const getUnallocatedAmount = () => {
    return parseFloat(amount || "0") - getTotalAllocated()
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      // Validation
      const amountNum = parseFloat(amount)
      if (!amountNum || amountNum <= 0) {
        toast({
          title: "Monto inválido",
          description: "Ingrese un monto válido",
          variant: "destructive",
        })
        return
      }

      // Build allocations array
      const allocationsList: { movementId: string; amount: number }[] = []
      selectedCharges.forEach((chargeId) => {
        const allocAmount = allocations.get(chargeId)
        if (allocAmount && allocAmount > 0) {
          allocationsList.push({
            movementId: chargeId,
            amount: allocAmount,
          })
        }
      })

      // Validate total allocated doesn't exceed payment amount
      const totalAllocated = getTotalAllocated()
      if (totalAllocated > amountNum) {
        toast({
          title: "Error",
          description: "El total asignado excede el monto del pago",
          variant: "destructive",
        })
        return
      }

      // Validate each allocation doesn't exceed charge balance
      for (const allocation of allocationsList) {
        const charge = charges.find((c) => c.id === allocation.movementId)
        if (charge) {
          const remainingBalance =
            parseFloat(charge.amount) - parseFloat(charge.paidAmount)
          if (allocation.amount > remainingBalance) {
            toast({
              title: "Error",
              description: `El monto asignado excede el saldo pendiente del cargo`,
              variant: "destructive",
            })
            return
          }
        }
      }

      const payload = {
        amount: amountNum,
        concept: concept || "Pago de cuenta corriente",
        reference: reference || undefined,
        paymentDate,
        allocations: allocationsList.length > 0 ? allocationsList : undefined,
      }

      const response = await fetch(
        `/api/accounts/${customerId}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to register payment")
      }

      toast({
        title: "Pago registrado",
        description: `${formatCurrency(amountNum)} registrado correctamente`,
      })

      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error registering payment:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el pago",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Registra un pago recibido de {customerName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Payment Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Monto del Pago *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Fecha de Pago *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Concept */}
            <div className="space-y-2">
              <Label htmlFor="concept">Concepto</Label>
              <Input
                id="concept"
                placeholder="Pago de cuenta corriente"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              />
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia (opcional)</Label>
              <Input
                id="reference"
                placeholder="Número de cheque, transferencia, etc."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Charge Allocation Section */}
          {charges.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Asignación a Cargos</h3>
                <div className="text-sm text-muted-foreground">
                  Total asignado: {formatCurrency(getTotalAllocated())} /{" "}
                  {formatCurrency(parseFloat(amount || "0"))}
                </div>
              </div>

              {getUnallocatedAmount() < 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    El total asignado excede el monto del pago por{" "}
                    {formatCurrency(Math.abs(getUnallocatedAmount()))}
                  </AlertDescription>
                </Alert>
              )}

              {getUnallocatedAmount() > 0 && selectedCharges.size > 0 && (
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    Monto sin asignar: {formatCurrency(getUnallocatedAmount())}
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium">
                        <span className="sr-only">Seleccionar</span>
                      </th>
                      <th className="p-2 text-left text-sm font-medium">Fecha</th>
                      <th className="p-2 text-left text-sm font-medium">Concepto</th>
                      <th className="p-2 text-right text-sm font-medium">Total</th>
                      <th className="p-2 text-right text-sm font-medium">Pagado</th>
                      <th className="p-2 text-right text-sm font-medium">Saldo</th>
                      <th className="p-2 text-right text-sm font-medium">
                        Monto a Pagar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((charge) => {
                      const isSelected = selectedCharges.has(charge.id)
                      const allocationAmount = allocations.get(charge.id) || 0
                      const chargeAmount = parseFloat(charge.amount)
                      const paidAmount = parseFloat(charge.paidAmount)
                      const remainingBalance = chargeAmount - paidAmount
                      const overdue = isOverdue(charge.dueDate)

                      return (
                        <tr
                          key={charge.id}
                          className={`border-t hover:bg-muted/50 ${
                            overdue ? "bg-red-50" : ""
                          }`}
                        >
                          <td className="p-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleChargeToggle(charge.id, checked as boolean)
                              }
                            />
                          </td>
                          <td className="p-2 text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(charge.createdAt).toLocaleDateString(
                              "es-AR"
                            )}
                            {charge.dueDate && (
                              <div
                                className={`text-xs ${
                                  overdue ? "text-red-600 font-medium" : ""
                                }`}
                              >
                                Vto: {new Date(charge.dueDate).toLocaleDateString("es-AR")}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-sm">{charge.concept}</td>
                          <td className="p-2 text-sm text-right">
                            {formatCurrency(chargeAmount)}
                          </td>
                          <td className="p-2 text-sm text-right text-green-600">
                            {formatCurrency(paidAmount)}
                          </td>
                          <td className="p-2 text-sm text-right font-medium text-destructive">
                            {formatCurrency(remainingBalance)}
                          </td>
                          <td className="p-2 text-right">
                            {isSelected ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={remainingBalance}
                                value={allocationAmount}
                                onChange={(e) =>
                                  handleAllocationChange(charge.id, e.target.value)
                                }
                                className="w-32 text-right"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {charges.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay cargos pendientes para asignar
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
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
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
