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
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DisputeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string
  onSuccess?: () => void
}

export function DisputeDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  onSuccess,
}: DisputeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!disputeReason.trim()) {
      toast.error("Debe ingresar un motivo de disputa")
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/supplier-invoices/${invoiceId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeReason: disputeReason.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to dispute invoice")
      }

      toast.success(`Factura ${invoiceNumber} marcada como disputada`)
      setDisputeReason("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error disputing invoice:", error)
      toast.error(error.message || "No se pudo disputar la factura")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Disputar Factura</DialogTitle>
          <DialogDescription>
            Marcar factura {invoiceNumber} como disputada
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta acción marcará la factura como disputada y bloqueará los pagos hasta que se resuelva.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="disputeReason">Motivo de la Disputa *</Label>
            <Textarea
              id="disputeReason"
              placeholder="Describa en detalle el motivo de la disputa: errores en la factura, productos no recibidos, precios incorrectos, etc."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              Este motivo quedará registrado en el historial de la factura.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Marcar como Disputada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
