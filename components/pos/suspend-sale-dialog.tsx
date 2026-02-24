"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"

interface SuspendSaleDialogProps {
  open: boolean
  onClose: () => void
  cartData: any
  discountType?: string
  discountValue?: number
  customerId?: string | null
  onSuccess: () => void
}

export function SuspendSaleDialog({
  open,
  onClose,
  cartData,
  discountType,
  discountValue,
  customerId,
  onSuccess,
}: SuspendSaleDialogProps) {
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSuspend = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un nombre para la venta suspendida",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const response = await fetch("/api/suspended-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          cartData: JSON.stringify(cartData),
          discountType,
          discountValue,
          customerId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al suspender la venta")
      }

      toast({
        title: "Venta suspendida",
        description: `La venta "${name}" ha sido suspendida exitosamente`,
      })

      setName("")
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo suspender la venta",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      setName("")
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspender Venta</DialogTitle>
          <DialogDescription>
            Ingresa un nombre para identificar esta venta y poder reanudarla más tarde
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sale-name">Nombre de la venta</Label>
            <Input
              id="sale-name"
              placeholder="Ej: Cliente Juan - Pedido especial"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSuspend()
                }
              }}
              autoFocus
              disabled={isSaving}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Esta venta se guardará con:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>{cartData.length} productos en el carrito</li>
              {discountValue && discountValue > 0 && (
                <li>
                  Descuento: {discountType === "PERCENTAGE" ? `${discountValue}%` : `$${discountValue}`}
                </li>
              )}
              {customerId && <li>Cliente asignado</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSuspend} disabled={isSaving || !name.trim()}>
            {isSaving ? "Guardando..." : "Suspender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
