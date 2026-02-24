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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface ResolveDisputeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string
  disputeReason: string
  currentBalance: number
  paidAmount: number
  onSuccess?: () => void
}

export function ResolveDisputeDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  disputeReason,
  currentBalance,
  paidAmount,
  onSuccess,
}: ResolveDisputeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [resolution, setResolution] = useState("")
  const [newStatus, setNewStatus] = useState<"PENDING" | "PARTIAL" | "PAID">("PENDING")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!resolution.trim()) {
      toast.error("Debe ingresar notas de resolución")
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/supplier-invoices/${invoiceId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: resolution.trim(),
          newStatus,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to resolve dispute")
      }

      toast.success(`Disputa de factura ${invoiceNumber} resuelta`)
      setResolution("")
      setNewStatus("PENDING")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error resolving dispute:", error)
      toast.error(error.message || "No se pudo resolver la disputa")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolver Disputa</DialogTitle>
          <DialogDescription>
            Resolver la disputa de la factura {invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Esta acción resolverá la disputa y permitirá procesar pagos nuevamente.
            </AlertDescription>
          </Alert>

          {/* Original Dispute Reason */}
          <div className="space-y-2">
            <Label>Motivo Original de la Disputa</Label>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm whitespace-pre-wrap">{disputeReason}</p>
            </div>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label htmlFor="resolution">Notas de Resolución *</Label>
            <Textarea
              id="resolution"
              placeholder="Describa cómo se resolvió la disputa, acuerdos alcanzados, correcciones realizadas, etc."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              required
            />
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label htmlFor="newStatus">Nuevo Estado *</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
              <SelectTrigger id="newStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">
                  Pendiente (sin pagos realizados)
                </SelectItem>
                {paidAmount > 0 && (
                  <SelectItem value="PARTIAL">
                    Parcial (con pagos parciales)
                  </SelectItem>
                )}
                {currentBalance <= 0 && (
                  <SelectItem value="PAID">
                    Pagada (totalmente pagada)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Saldo actual: ${currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })} |
              Pagado: ${paidAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Validation Warnings */}
          {newStatus === "PAID" && currentBalance > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No se puede marcar como PAGADA mientras exista saldo pendiente.
              </AlertDescription>
            </Alert>
          )}

          {newStatus === "PARTIAL" && paidAmount === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No se puede marcar como PARCIAL sin pagos realizados.
              </AlertDescription>
            </Alert>
          )}

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
              Resolver Disputa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
