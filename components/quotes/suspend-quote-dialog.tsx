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

interface SuspendQuoteDialogProps {
  open: boolean
  onClose: () => void
  cartData: any
  customerId?: string | null
  notes?: string
  onSuccess: () => void
}

export function SuspendQuoteDialog({
  open,
  onClose,
  cartData,
  customerId,
  notes,
  onSuccess,
}: SuspendQuoteDialogProps) {
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSuspend = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un nombre para el presupuesto suspendido",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const response = await fetch("/api/suspended-quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          cartData: JSON.stringify(cartData),
          customerId,
          notes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al suspender el presupuesto")
      }

      toast({
        title: "Presupuesto suspendido",
        description: `El presupuesto "${name}" ha sido suspendido exitosamente`,
      })

      setName("")
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo suspender el presupuesto",
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
          <DialogTitle>Suspender Presupuesto</DialogTitle>
          <DialogDescription>
            Ingresa un nombre para identificar este presupuesto y poder reanudarlo más tarde
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quote-name">Nombre del presupuesto</Label>
            <Input
              id="quote-name"
              placeholder="Ej: Presupuesto Cliente Juan"
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
            <p>Este presupuesto se guardará con:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>{cartData.length} productos</li>
              {customerId && <li>Cliente asignado</li>}
              {notes && <li>Notas incluidas</li>}
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
