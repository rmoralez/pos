"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { calculateDiscountAmount, type DiscountType } from "@/lib/pricing"
import { Percent, DollarSign } from "lucide-react"

interface ItemDiscountDialogProps {
  open: boolean
  onClose: () => void
  itemName: string
  unitPrice: number
  quantity: number
  currentDiscountType: DiscountType
  currentDiscountValue: number
  onApply: (discountType: DiscountType, discountValue: number) => void
}

export function ItemDiscountDialog({
  open,
  onClose,
  itemName,
  unitPrice,
  quantity,
  currentDiscountType,
  currentDiscountValue,
  onApply,
}: ItemDiscountDialogProps) {
  const [discountType, setDiscountType] = useState<DiscountType>(currentDiscountType)
  const [discountValue, setDiscountValue] = useState(currentDiscountValue)

  useEffect(() => {
    if (open) {
      setDiscountType(currentDiscountType)
      setDiscountValue(currentDiscountValue)
    }
  }, [open, currentDiscountType, currentDiscountValue])

  const baseTotal = unitPrice * quantity
  const discountAmount = calculateDiscountAmount(baseTotal, discountType, discountValue)
  const finalPrice = baseTotal - discountAmount

  const handleApply = () => {
    onApply(discountType, discountValue)
    onClose()
  }

  const handleClear = () => {
    onApply("FIXED", 0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Descuento por Artículo</DialogTitle>
          <DialogDescription>{itemName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Price Summary */}
          <div className="rounded-md border bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio unitario:</span>
              <span className="font-medium">${unitPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad:</span>
              <span className="font-medium">{quantity}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-semibold">${baseTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Discount Type */}
          <div className="space-y-2">
            <Label>Tipo de descuento</Label>
            <RadioGroup
              value={discountType}
              onValueChange={(value) => {
                setDiscountType(value as DiscountType)
                setDiscountValue(0)
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="PERCENTAGE" id="item-percentage" className="peer sr-only" />
                <Label
                  htmlFor="item-percentage"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Percent className="mb-3 h-6 w-6" />
                  <span className="text-sm font-medium">Porcentaje</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="FIXED" id="item-fixed" className="peer sr-only" />
                <Label
                  htmlFor="item-fixed"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <DollarSign className="mb-3 h-6 w-6" />
                  <span className="text-sm font-medium">Monto Fijo</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Discount Value */}
          <div className="space-y-2">
            <Label htmlFor="discount-value">
              {discountType === "PERCENTAGE" ? "Porcentaje de descuento" : "Monto de descuento"}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="discount-value"
                type="number"
                min="0"
                step={discountType === "PERCENTAGE" ? "1" : "0.01"}
                max={discountType === "PERCENTAGE" ? "100" : baseTotal.toString()}
                value={discountValue === 0 ? "" : discountValue}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0
                  if (discountType === "PERCENTAGE") {
                    setDiscountValue(Math.min(100, Math.max(0, value)))
                  } else {
                    setDiscountValue(Math.min(baseTotal, Math.max(0, value)))
                  }
                }}
                placeholder={discountType === "PERCENTAGE" ? "0" : "0.00"}
              />
              <span className="text-sm text-muted-foreground min-w-[20px]">
                {discountType === "PERCENTAGE" ? "%" : "$"}
              </span>
            </div>
          </div>

          {/* Preview */}
          {discountValue > 0 && (
            <div className="rounded-md border bg-green-50 dark:bg-green-950/20 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>Descuento:</span>
                <span className="font-semibold">-${discountAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-green-200 dark:border-green-900 pt-1">
                <span className="font-medium">Precio final:</span>
                <span className="font-bold text-base">${finalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {(currentDiscountValue > 0) && (
            <Button type="button" variant="outline" onClick={handleClear} className="sm:mr-auto">
              Quitar descuento
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleApply}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
