"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { CreditCard, DollarSign, Smartphone } from "lucide-react"

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  cart: any[]
  totals: {
    subtotal: number
    taxAmount: number
    total: number
  }
  onSuccess: () => void
}

export function PaymentDialog({ open, onClose, cart, totals, onSuccess }: PaymentDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [cashAmount, setCashAmount] = useState("")

  const change = cashAmount ? parseFloat(cashAmount) - totals.total : 0
  const isCashPayment = paymentMethod === "CASH"
  const canProcess = !isCashPayment || (cashAmount && parseFloat(cashAmount) >= totals.total)

  const handlePayment = async () => {
    // Validate cash payment
    if (isCashPayment) {
      if (!cashAmount || parseFloat(cashAmount) < totals.total) {
        toast({
          title: "Error",
          description: "El monto recibido debe ser mayor o igual al total",
          variant: "destructive",
        })
        return
      }
    }

    setIsProcessing(true)

    try {
      const saleData = {
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.salePrice,
          taxRate: item.product.taxRate,
        })),
        paymentMethod,
      }

      console.log("Sending sale data:", saleData)

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saleData),
      })

      console.log("Response status:", response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error("Sale error:", error)
        throw new Error(error.error || "Failed to process sale")
      }

      const result = await response.json()
      console.log("Sale successful:", result)

      toast({
        title: "Venta completada",
        description: `Venta procesada exitosamente${isCashPayment && change > 0 ? `. Vuelto: $${change.toFixed(2)}` : ""}`,
      })

      onSuccess()
    } catch (error: any) {
      console.error("Payment error:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la venta",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const paymentMethods = [
    { value: "CASH", label: "Efectivo", icon: DollarSign },
    { value: "DEBIT_CARD", label: "Tarjeta de Débito", icon: CreditCard },
    { value: "CREDIT_CARD", label: "Tarjeta de Crédito", icon: CreditCard },
    { value: "QR", label: "QR (Mercado Pago)", icon: Smartphone },
    { value: "TRANSFER", label: "Transferencia", icon: DollarSign },
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Procesar Pago</DialogTitle>
          <DialogDescription>
            Selecciona el método de pago para completar la venta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between text-lg">
              <span>Total a pagar:</span>
              <span className="font-bold text-2xl">
                ${Number(totals.total).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCashPayment && (
              <div className="space-y-2">
                <Label htmlFor="cashAmount">Monto recibido</Label>
                <Input
                  id="cashAmount"
                  type="number"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                />
                {cashAmount && parseFloat(cashAmount) >= totals.total && (
                  <p className="text-sm text-muted-foreground">
                    Vuelto: ${change.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${totals.subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span>${totals.taxAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{cart.length} {cart.length === 1 ? "producto" : "productos"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handlePayment}
              disabled={isProcessing || !canProcess}
            >
              {isProcessing ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
