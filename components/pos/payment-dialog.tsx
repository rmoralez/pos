"use client"

import { useState, useEffect, useRef } from "react"
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
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { CreditCard, DollarSign, Smartphone, FileText, Receipt, BookOpen, AlertCircle, Plus, Trash2 } from "lucide-react"
import type { DiscountType } from "@/lib/pricing"

type PaymentMethod =
  | "CASH"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "TRANSFER"
  | "QR"
  | "CHECK"
  | "ACCOUNT"
  | "OTHER"

interface PaymentEntry {
  method: PaymentMethod
  amount: string // string for controlled input
  cardLastFour?: string
  transferReference?: string
}

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  cart: any[]
  totals: {
    total: number
    cartDiscountAmount?: number
    cartDiscountType?: DiscountType
    cartDiscountValue?: number
  }
  onSuccess: () => void
  initialPaymentMethod?: string
  customerId?: string | null
  customerName?: string | null
}

interface CustomerAccount {
  id: string
  balance: string
  creditLimit: string
  isActive: boolean
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Tarjeta de Débito",
  CREDIT_CARD: "Tarjeta de Crédito",
  QR: "QR (Mercado Pago)",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cuenta Corriente",
  CHECK: "Cheque",
  OTHER: "Otro",
}

const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "QR",
  "TRANSFER",
  "ACCOUNT",
]

function buildInitialPayments(method: string, total: number): PaymentEntry[] {
  return [{ method: (method || "CASH") as PaymentMethod, amount: total.toFixed(2) }]
}

export function PaymentDialog({
  open,
  onClose,
  cart,
  totals,
  onSuccess,
  initialPaymentMethod,
  customerId,
  customerName,
}: PaymentDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [payments, setPayments] = useState<PaymentEntry[]>(() =>
    buildInitialPayments(initialPaymentMethod ?? "CASH", totals.total)
  )
  const [receiptType, setReceiptType] = useState("RECEIPT")
  // Customer account info — only fetched when at least one ACCOUNT entry exists
  const [customerAccount, setCustomerAccount] = useState<CustomerAccount | null>(null)
  const [loadingAccount, setLoadingAccount] = useState(false)

  // Ref for auto-focusing the first payment amount input
  const firstAmountInputRef = useRef<HTMLInputElement>(null)

  // Reset state every time the dialog opens
  useEffect(() => {
    if (open) {
      setPayments(buildInitialPayments(initialPaymentMethod ?? "CASH", totals.total))
      setReceiptType("RECEIPT")
      setCustomerAccount(null)

      // Auto-focus the first amount input after a short delay to ensure the dialog is rendered
      const timeoutId = setTimeout(() => {
        firstAmountInputRef.current?.select()
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [open, initialPaymentMethod, totals.total])

  const hasAccountEntry = payments.some(p => p.method === "ACCOUNT")

  // Fetch customer account whenever an ACCOUNT entry is present and customer is set
  useEffect(() => {
    if (hasAccountEntry && customerId && open) {
      setLoadingAccount(true)
      fetch(`/api/customers/${customerId}/account`)
        .then(r => r.json())
        .then(data => {
          if (!data.error) setCustomerAccount(data)
          else setCustomerAccount(null)
        })
        .catch(() => setCustomerAccount(null))
        .finally(() => setLoadingAccount(false))
    } else if (!hasAccountEntry) {
      setCustomerAccount(null)
    }
  }, [hasAccountEntry, customerId, open])

  // Keyboard shortcuts inside dialog
  useKeyboardShortcuts([
    {
      key: "r",
      description: "Seleccionar Recibo",
      action: () => setReceiptType("RECEIPT"),
      disabled: !open,
    },
    {
      key: "1",
      description: "Seleccionar Recibo",
      action: () => setReceiptType("RECEIPT"),
      disabled: !open,
    },
    {
      key: "f",
      description: "Seleccionar Factura AFIP",
      action: () => setReceiptType("INVOICE"),
      disabled: !open,
    },
    {
      key: "2",
      description: "Seleccionar Factura AFIP",
      action: () => setReceiptType("INVOICE"),
      disabled: !open,
    },
    {
      key: "Enter",
      description: "Confirmar pago",
      action: () => {
        if (canProcess && !isProcessing) {
          handlePayment()
        }
      },
      disabled: !open,
    },
    {
      key: "Escape",
      description: "Cerrar sin guardar",
      action: () => {
        if (!isProcessing) {
          onClose()
        }
      },
      disabled: !open,
    },
  ])

  // ---- Derived values ----

  const paymentsSum = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0)
  const remaining = totals.total - paymentsSum
  const isBalanced = Math.abs(remaining) <= 0.01

  const accountBalance = customerAccount ? parseFloat(customerAccount.balance) : 0
  const accountCreditLimit = customerAccount ? parseFloat(customerAccount.creditLimit) : 0
  const availableCredit =
    accountCreditLimit === 0 ? null : accountCreditLimit + accountBalance

  // Total ACCOUNT-method amount across all entries
  const accountEntriesTotal = payments
    .filter(p => p.method === "ACCOUNT")
    .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0)

  const canProcess = (() => {
    if (!isBalanced) return false
    if (payments.some(p => !(parseFloat(p.amount) > 0))) return false

    // ACCOUNT entries require customer + loaded account + credit
    if (hasAccountEntry) {
      if (!customerId) return false
      if (!customerAccount) return false
      if (!customerAccount.isActive) return false
      if (
        accountCreditLimit > 0 &&
        availableCredit !== null &&
        accountEntriesTotal > availableCredit
      )
        return false
    }
    return true
  })()

  // ---- Mutation helpers ----

  const updatePayment = (index: number, patch: Partial<PaymentEntry>) => {
    setPayments(prev =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    )
  }

  const addPayment = () => {
    setPayments(prev => [
      ...prev,
      {
        method: "CASH",
        amount: remaining > 0 ? remaining.toFixed(2) : "0.00",
      },
    ])
  }

  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index))
  }

  // ---- Submit ----

  const handlePayment = async () => {
    if (!isBalanced) {
      toast({
        title: "Error",
        description: `El restante debe ser $0.00 para procesar la venta. Restante: $${remaining.toFixed(2)}`,
        variant: "destructive",
      })
      return
    }

    if (hasAccountEntry && !customerId) {
      toast({
        title: "Error",
        description: "Debe seleccionar un cliente para pagar con cuenta corriente",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      const saleData: any = {
        items: cart.map((item: any) => ({
          productId: item.product.id,
          productVariantId: item.variant?.id,
          quantity: item.quantity,
          unitPrice: item.variant ? parseFloat(item.variant.salePrice) : item.product.salePrice,
          taxRate: item.product.taxRate,
          discount: item.discount ?? 0, // Legacy support
          discountType: item.discountType,
          discountValue: item.discountValue,
        })),
        payments: payments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount),
          ...(p.cardLastFour ? { cardLastFour: p.cardLastFour } : {}),
          ...(p.transferReference ? { transferReference: p.transferReference } : {}),
        })),
      }

      // Include cart-level discount information
      if (totals.cartDiscountType && totals.cartDiscountValue !== undefined && totals.cartDiscountValue > 0) {
        // New flexible discount system
        saleData.discountType = totals.cartDiscountType
        saleData.discountValue = totals.cartDiscountValue
      } else if (totals.cartDiscountAmount && totals.cartDiscountAmount > 0) {
        // Legacy: pass discountAmount for backward compatibility
        saleData.discountAmount = totals.cartDiscountAmount
      }

      if (customerId) {
        saleData.customerId = customerId
      }

      console.log("Sending sale data:", saleData)

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Build description — show change if single cash payment with overpay
      let desc = "Venta procesada exitosamente"
      if (payments.length === 1 && payments[0].method === "CASH") {
        const cashAmount = parseFloat(payments[0].amount)
        const change = cashAmount - totals.total
        if (change > 0) {
          desc = `Venta procesada exitosamente. Vuelto: $${change.toFixed(2)}`
        }
      } else if (hasAccountEntry) {
        desc = `Cargo de $${accountEntriesTotal.toFixed(2)} registrado en cuenta corriente de ${customerName ?? "cliente"}`
      } else if (payments.length > 1) {
        desc = `Venta con ${payments.length} medios de pago procesada exitosamente`
      }

      toast({ title: "Venta completada", description: desc })

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

  // ---- Render ----

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Procesar Pago</DialogTitle>
          <DialogDescription>
            Selecciona el método de pago para completar la venta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total header */}
          <div className="flex justify-between text-lg">
            <span>Total a pagar:</span>
            <span className="font-bold text-2xl">
              ${Number(totals.total).toLocaleString("es-AR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Payment entries list */}
          <div className="space-y-3">
            {payments.map((entry, index) => (
              <PaymentEntryRow
                key={index}
                index={index}
                entry={entry}
                canRemove={payments.length > 1}
                onUpdate={patch => updatePayment(index, patch)}
                onRemove={() => removePayment(index)}
                remaining={remaining}
                totals={totals}
                inputRef={index === 0 ? firstAmountInputRef : undefined}
              />
            ))}
          </div>

          {/* Add payment button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addPayment}
            disabled={isBalanced}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar medio de pago
          </Button>

          {/* Remaining / change indicator */}
          <div className={`flex justify-between text-sm font-medium px-1 ${
            isBalanced
              ? "text-green-600"
              : remaining > 0
              ? "text-amber-600"
              : "text-red-600"
          }`}>
            <span>{remaining < -0.01 ? "Excedente:" : "Restante:"}</span>
            <span>
              ${Math.abs(remaining).toLocaleString("es-AR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Customer account info panel — shown when any ACCOUNT entry exists */}
          {hasAccountEntry && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              {!customerId ? (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Debe seleccionar un cliente en el POS para usar cuenta corriente</span>
                </div>
              ) : loadingAccount ? (
                <p className="text-sm text-muted-foreground">Cargando cuenta...</p>
              ) : customerAccount ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{customerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo actual:</span>
                    <span
                      className={`font-medium ${
                        accountBalance < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      ${accountBalance.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {accountCreditLimit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Crédito disponible:</span>
                      <span
                        className={`font-medium ${
                          availableCredit !== null && accountEntriesTotal > availableCredit
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        ${(availableCredit ?? 0).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {accountCreditLimit === 0 && (
                    <p className="text-xs text-muted-foreground">Sin límite de crédito</p>
                  )}
                  {!customerAccount.isActive && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>La cuenta corriente está inactiva</span>
                    </div>
                  )}
                  {accountCreditLimit > 0 &&
                    availableCredit !== null &&
                    accountEntriesTotal > availableCredit && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>La venta supera el crédito disponible</span>
                      </div>
                    )}
                  <div className="flex justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">Saldo después de la venta:</span>
                    <span className="font-medium text-red-600">
                      ${(accountBalance - accountEntriesTotal).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No se pudo cargar la cuenta</p>
              )}
            </div>
          )}

          {/* Receipt type */}
          <div className="border-t pt-4 space-y-3">
            <div className="space-y-2">
              <Label>Tipo de Comprobante</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptType("RECEIPT")}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                    receiptType === "RECEIPT"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 shrink-0" />
                    <span>Recibo</span>
                  </div>
                  <kbd className="ml-2 rounded border px-1.5 py-0.5 text-xs font-mono opacity-60">R</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptType("INVOICE")}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                    receiptType === "INVOICE"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span>Factura AFIP</span>
                  </div>
                  <kbd className="ml-2 rounded border px-1.5 py-0.5 text-xs font-mono opacity-60">F</kbd>
                </button>
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Items</span>
              <span>
                {cart.length} {cart.length === 1 ? "producto" : "productos"}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing}
              aria-keyshortcuts="Escape"
            >
              <span className="flex items-center justify-center gap-2">
                Cancelar
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                  ESC
                </kbd>
              </span>
            </Button>
            <Button
              className="flex-1"
              onClick={handlePayment}
              disabled={isProcessing || !canProcess}
              aria-keyshortcuts="Enter"
            >
              <span className="flex items-center justify-center gap-2">
                {isProcessing ? "Procesando..." : "Cobrar"}
                {!isProcessing && (
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-primary-foreground/20 rounded">
                    Enter
                  </kbd>
                )}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Sub-component: one payment row ----

interface PaymentEntryRowProps {
  index: number
  entry: PaymentEntry
  canRemove: boolean
  onUpdate: (patch: Partial<PaymentEntry>) => void
  onRemove: () => void
  remaining: number
  totals: { total: number }
  inputRef?: React.RefObject<HTMLInputElement>
}

function PaymentEntryRow({
  entry,
  canRemove,
  onUpdate,
  onRemove,
  remaining,
  totals,
  inputRef,
}: PaymentEntryRowProps) {
  const entryAmount = parseFloat(entry.amount) || 0
  const isCash = entry.method === "CASH"
  const isCard = entry.method === "CREDIT_CARD" || entry.method === "DEBIT_CARD"
  const isTransfer = entry.method === "TRANSFER"

  // For single cash payment: show change if over-paid
  const cashChange = isCash && entryAmount > totals.total ? entryAmount - totals.total : 0

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/10">
      <div className="flex items-center gap-2">
        {/* Method selector */}
        <Select
          value={entry.method}
          onValueChange={value => onUpdate({ method: value as PaymentMethod })}
        >
          <SelectTrigger className="flex-1 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_PAYMENT_METHODS.map(m => (
              <SelectItem key={m} value={m}>
                <div className="flex items-center gap-2">
                  {m === "CASH" && <DollarSign className="h-3.5 w-3.5" />}
                  {(m === "DEBIT_CARD" || m === "CREDIT_CARD") && (
                    <CreditCard className="h-3.5 w-3.5" />
                  )}
                  {m === "QR" && <Smartphone className="h-3.5 w-3.5" />}
                  {m === "TRANSFER" && <DollarSign className="h-3.5 w-3.5" />}
                  {m === "ACCOUNT" && <BookOpen className="h-3.5 w-3.5" />}
                  {PAYMENT_METHOD_LABELS[m]}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Amount input */}
        <Input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0.01"
          value={entry.amount}
          onChange={e => onUpdate({ amount: e.target.value })}
          className="w-32 h-9 text-right"
          placeholder="0.00"
        />

        {/* Remove button */}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Card last four */}
      {isCard && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-24 shrink-0">
            Últimos 4 dígitos
          </Label>
          <Input
            type="text"
            maxLength={4}
            value={entry.cardLastFour ?? ""}
            onChange={e =>
              onUpdate({ cardLastFour: e.target.value.replace(/\D/g, "") })
            }
            placeholder="1234"
            className="h-8 text-sm"
          />
        </div>
      )}

      {/* Transfer reference */}
      {isTransfer && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-24 shrink-0">
            Referencia
          </Label>
          <Input
            type="text"
            value={entry.transferReference ?? ""}
            onChange={e => onUpdate({ transferReference: e.target.value })}
            placeholder="Número de operación"
            className="h-8 text-sm"
          />
        </div>
      )}

      {/* Cash change (single-entry overpayment) */}
      {isCash && cashChange > 0 && (
        <p className="text-xs text-muted-foreground">
          Vuelto:{" "}
          <span className="font-semibold text-green-600">
            ${cashChange.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      )}
    </div>
  )
}
