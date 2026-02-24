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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { Loader2, DollarSign, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SupplierInvoice {
  id: string
  invoiceNumber: string
  total: number
  paidAmount: number
  balance: number
  status: string
  invoiceDate: string
  dueDate: string | null
}

interface PaymentAllocation {
  invoiceId: string
  amount: number
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  preSelectedSupplierId?: string
  preSelectedInvoiceId?: string
}

export function PaymentDialog({
  open,
  onOpenChange,
  onSuccess,
  preSelectedSupplierId,
  preSelectedInvoiceId,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map())

  // Form state
  const [supplierId, setSupplierId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER")
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [reference, setReference] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [checkDate, setCheckDate] = useState("")
  const [notes, setNotes] = useState("")

  // Load suppliers on mount
  useEffect(() => {
    if (open) {
      fetchSuppliers()
      resetForm()
      // Set pre-selected supplier if provided
      if (preSelectedSupplierId) {
        setSupplierId(preSelectedSupplierId)
      }
    }
  }, [open, preSelectedSupplierId])

  // Load invoices when supplier changes
  useEffect(() => {
    if (supplierId) {
      fetchInvoices(supplierId)
    } else {
      setInvoices([])
      setSelectedInvoices(new Set())
      setAllocations(new Map())
    }
  }, [supplierId])

  // Auto-select pre-selected invoice
  useEffect(() => {
    if (preSelectedInvoiceId && invoices.length > 0) {
      const invoice = invoices.find((inv) => inv.id === preSelectedInvoiceId)
      if (invoice) {
        setSelectedInvoices(new Set([preSelectedInvoiceId]))
        setAllocations(new Map([[preSelectedInvoiceId, invoice.balance]]))
        setAmount(invoice.balance.toString())
      }
    }
  }, [preSelectedInvoiceId, invoices])

  const resetForm = () => {
    setSupplierId(preSelectedSupplierId || "")
    setAmount("")
    setPaymentMethod("BANK_TRANSFER")
    setPaymentDate(new Date().toISOString().split("T")[0])
    setReference("")
    setBankAccount("")
    setCheckNumber("")
    setCheckDate("")
    setNotes("")
    setSelectedInvoices(new Set())
    setAllocations(new Map())
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.map((s: any) => ({ id: s.id, name: s.name })))
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error)
      toast.error("Error al cargar proveedores")
    }
  }

  const fetchInvoices = async (supplierId: string) => {
    try {
      const params = new URLSearchParams()
      params.set("supplierId", supplierId)
      params.set("status", "PENDING")

      const response = await fetch(`/api/supplier-invoices?${params}`)
      if (response.ok) {
        const data = await response.json()
        const pendingInvoices = (data.invoices || []).filter(
          (inv: SupplierInvoice) =>
            inv.status === "PENDING" || inv.status === "PARTIAL"
        )
        setInvoices(pendingInvoices)
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast.error("Error al cargar facturas")
    }
  }

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoices)
    const newAllocations = new Map(allocations)

    if (checked) {
      newSelected.add(invoiceId)
      const invoice = invoices.find((inv) => inv.id === invoiceId)
      if (invoice) {
        newAllocations.set(invoiceId, invoice.balance)
      }
    } else {
      newSelected.delete(invoiceId)
      newAllocations.delete(invoiceId)
    }

    setSelectedInvoices(newSelected)
    setAllocations(newAllocations)
  }

  const handleAllocationChange = (invoiceId: string, value: string) => {
    const newAllocations = new Map(allocations)
    const numValue = parseFloat(value) || 0
    newAllocations.set(invoiceId, numValue)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      // Validation
      if (!supplierId) {
        toast.error("Seleccione un proveedor")
        return
      }

      const amountNum = parseFloat(amount)
      if (!amountNum || amountNum <= 0) {
        toast.error("Ingrese un monto válido")
        return
      }

      if (!paymentDate) {
        toast.error("Seleccione la fecha de pago")
        return
      }

      // Build allocations array
      const allocationsList: PaymentAllocation[] = []
      selectedInvoices.forEach((invoiceId) => {
        const allocAmount = allocations.get(invoiceId)
        if (allocAmount && allocAmount > 0) {
          allocationsList.push({
            invoiceId,
            amount: allocAmount,
          })
        }
      })

      // Validate total allocated doesn't exceed payment amount
      const totalAllocated = getTotalAllocated()
      if (totalAllocated > amountNum) {
        toast.error("El total asignado excede el monto del pago")
        return
      }

      // Validate each allocation doesn't exceed invoice balance
      for (const allocation of allocationsList) {
        const invoice = invoices.find((inv) => inv.id === allocation.invoiceId)
        if (invoice && allocation.amount > invoice.balance) {
          toast.error(
            `El monto asignado a la factura ${invoice.invoiceNumber} excede el saldo pendiente`
          )
          return
        }
      }

      const payload = {
        supplierId,
        amount: amountNum,
        paymentMethod,
        paymentDate,
        reference: reference || undefined,
        bankAccount: bankAccount || undefined,
        checkNumber: checkNumber || undefined,
        checkDate: checkDate || undefined,
        notes: notes || undefined,
        allocations: allocationsList.length > 0 ? allocationsList : undefined,
      }

      const response = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create payment")
      }

      toast.success("Pago registrado exitosamente")
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error creating payment:", error)
      toast.error(error.message || "Error al registrar el pago")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
          <DialogDescription>
            Registre un pago y asígnelo a las facturas correspondientes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Proveedor *</Label>
            <Select
              disabled={!!preSelectedSupplierId}
              value={supplierId}
              onValueChange={setSupplierId}
            >
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Seleccione un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Payment Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Monto del Pago *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
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
            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pago *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="BANK_TRANSFER">
                    Transferencia Bancaria
                  </SelectItem>
                  <SelectItem value="CHECK">Cheque</SelectItem>
                  <SelectItem value="DEBIT_NOTE">Nota de Débito</SelectItem>
                  <SelectItem value="CREDIT_NOTE">Nota de Crédito</SelectItem>
                  <SelectItem value="ACCOUNT_CREDIT">
                    Crédito en Cuenta
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia</Label>
              <Input
                id="reference"
                placeholder="Número de referencia"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Bank Account (if bank transfer) */}
          {paymentMethod === "BANK_TRANSFER" && (
            <div className="space-y-2">
              <Label htmlFor="bankAccount">Cuenta Bancaria</Label>
              <Input
                id="bankAccount"
                placeholder="Cuenta bancaria utilizada"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
              />
            </div>
          )}

          {/* Check fields (if check) */}
          {paymentMethod === "CHECK" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkNumber">Número de Cheque</Label>
                <Input
                  id="checkNumber"
                  placeholder="Número de cheque"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkDate">Fecha del Cheque</Label>
                <Input
                  id="checkDate"
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Invoice Allocation Section */}
          {supplierId && invoices.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Asignación a Facturas</h3>
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

              {getUnallocatedAmount() > 0 && selectedInvoices.size > 0 && (
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
                      <th className="p-2 text-left text-sm font-medium">
                        Factura
                      </th>
                      <th className="p-2 text-left text-sm font-medium">Fecha</th>
                      <th className="p-2 text-right text-sm font-medium">Total</th>
                      <th className="p-2 text-right text-sm font-medium">Saldo</th>
                      <th className="p-2 text-right text-sm font-medium">
                        Monto a Pagar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const isSelected = selectedInvoices.has(invoice.id)
                      const allocationAmount = allocations.get(invoice.id) || 0

                      return (
                        <tr key={invoice.id} className="border-t hover:bg-muted/50">
                          <td className="p-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleInvoiceToggle(invoice.id, checked as boolean)
                              }
                            />
                          </td>
                          <td className="p-2 text-sm font-medium">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {new Date(invoice.invoiceDate).toLocaleDateString(
                              "es-AR"
                            )}
                          </td>
                          <td className="p-2 text-sm text-right">
                            {formatCurrency(invoice.total)}
                          </td>
                          <td className="p-2 text-sm text-right font-medium text-destructive">
                            {formatCurrency(invoice.balance)}
                          </td>
                          <td className="p-2 text-right">
                            {isSelected ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={invoice.balance}
                                value={allocationAmount}
                                onChange={(e) =>
                                  handleAllocationChange(invoice.id, e.target.value)
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

          {supplierId && invoices.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay facturas pendientes para este proveedor
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales sobre el pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
