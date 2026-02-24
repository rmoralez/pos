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
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Clock, ShoppingCart, User, Trash2, RotateCcw } from "lucide-react"
import { type Customer } from "@/components/pos/customer-selector"

interface Product {
  id: string
  sku: string
  name: string
  salePrice: number
  taxRate: number
  stock: Array<{ quantity: number }>
  hasVariants?: boolean
  ProductVariant?: any[]
}

interface ProductVariant {
  id: string
  sku: string
  variantValues: string
  salePrice: string
  costPrice: string
  Stock: Array<{ quantity: number }>
}

interface CartItem {
  product: Product
  quantity: number
  subtotal: number
  taxAmount: number
  total: number
  variant?: ProductVariant
  discountType: "FIXED" | "PERCENTAGE"
  discountValue: number
}

interface SuspendedSale {
  id: string
  cart: CartItem[]
  customer: Customer | null
  cartDiscountType: "FIXED" | "PERCENTAGE"
  cartDiscountValue: number
  timestamp: number
}

interface SuspendedSalesDialogProps {
  open: boolean
  onClose: () => void
  suspendedSales: SuspendedSale[]
  onResume: (sale: SuspendedSale) => void
  onDelete: (saleId: string) => void
}

export function SuspendedSalesDialog({
  open,
  onClose,
  suspendedSales,
  onResume,
  onDelete,
}: SuspendedSalesDialogProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = (saleId: string) => {
    const confirmed = window.confirm("¿Estás seguro de eliminar esta venta suspendida?")
    if (confirmed) {
      setDeletingId(saleId)
      onDelete(saleId)
      setTimeout(() => setDeletingId(null), 300)
    }
  }

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return "hace unos segundos"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
    const days = Math.floor(hours / 24)
    return `hace ${days} día${days > 1 ? 's' : ''}`
  }

  const calculateTotal = (sale: SuspendedSale) => {
    const itemsTotal = sale.cart.reduce((sum, item) => sum + item.total, 0)
    let discountAmount = 0
    if (sale.cartDiscountValue > 0) {
      if (sale.cartDiscountType === "PERCENTAGE") {
        discountAmount = (itemsTotal * sale.cartDiscountValue) / 100
      } else {
        discountAmount = sale.cartDiscountValue
      }
    }
    return itemsTotal - discountAmount
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ventas Suspendidas</DialogTitle>
          <DialogDescription>
            {suspendedSales.length === 0
              ? "No hay ventas suspendidas"
              : `${suspendedSales.length} venta${suspendedSales.length > 1 ? 's' : ''} suspendida${suspendedSales.length > 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {suspendedSales.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay ventas suspendidas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Las ventas suspendidas aparecerán aquí
              </p>
            </div>
          ) : (
            suspendedSales.map((sale) => (
              <div
                key={sale.id}
                className={`border rounded-lg p-4 space-y-3 transition-all ${
                  deletingId === sale.id ? "opacity-50" : ""
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(sale.timestamp)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {sale.cart.length} item{sale.cart.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {sale.customer && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{sale.customer.name}</span>
                      </div>
                    )}
                    {!sale.customer && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Sin cliente</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {formatCurrency(calculateTotal(sale))}
                    </div>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="border-t pt-2">
                  <div className="space-y-1 text-sm">
                    {sale.cart.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-muted-foreground">
                        <span className="truncate">
                          {item.product.name} x{item.quantity}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                    {sale.cart.length > 3 && (
                      <div className="text-xs text-muted-foreground italic">
                        + {sale.cart.length - 3} producto{sale.cart.length - 3 > 1 ? 's' : ''} más...
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    onClick={() => onResume(sale)}
                    className="flex-1"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retomar
                  </Button>
                  <Button
                    onClick={() => handleDelete(sale.id)}
                    variant="outline"
                    size="sm"
                    disabled={deletingId === sale.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-4 flex justify-end">
          <Button onClick={onClose} variant="outline">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
