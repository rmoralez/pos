"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package } from "lucide-react"

interface ProductVariant {
  id: string
  sku: string
  variantValues: string
  salePrice: string
  costPrice: string
  Stock: Array<{ quantity: number }>
}

interface VariantSelectorDialogProps {
  open: boolean
  onClose: () => void
  productName: string
  variants: ProductVariant[]
  onSelectVariant: (variant: ProductVariant) => void
}

export function VariantSelectorDialog({
  open,
  onClose,
  productName,
  variants,
  onSelectVariant,
}: VariantSelectorDialogProps) {
  const parseVariantValues = (variantValues: string): Record<string, string> => {
    try {
      return JSON.parse(variantValues)
    } catch {
      return {}
    }
  }

  const getVariantStock = (variant: ProductVariant): number => {
    return variant.Stock.reduce((sum, s) => sum + s.quantity, 0)
  }

  const handleSelectVariant = (variant: ProductVariant) => {
    onSelectVariant(variant)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seleccionar Variante</DialogTitle>
          <DialogDescription>
            Elige una variante de &quot;{productName}&quot; para agregar al carrito
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {variants.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay variantes disponibles</p>
            </div>
          ) : (
            variants.map((variant) => {
              const attrs = parseVariantValues(variant.variantValues)
              const stock = getVariantStock(variant)
              const hasStock = stock > 0

              return (
                <button
                  key={variant.id}
                  onClick={() => hasStock && handleSelectVariant(variant)}
                  disabled={!hasStock}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                    hasStock
                      ? "hover:border-primary hover:bg-primary/5 cursor-pointer"
                      : "opacity-50 cursor-not-allowed border-dashed"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(attrs).map(([key, value]) => (
                          <Badge key={key} variant="secondary">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {variant.sku}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-2xl font-bold">
                        ${Number(variant.salePrice).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div
                        className={`text-sm font-medium ${
                          hasStock ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {hasStock ? `Stock: ${stock}` : "Sin stock"}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
