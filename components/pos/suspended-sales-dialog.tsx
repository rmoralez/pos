"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { Loader2, Trash2, Play, Clock, User } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface SuspendedSale {
  id: string
  name: string
  cartData: string
  discountType?: string | null
  discountValue?: string | null
  customerId?: string | null
  customer?: {
    id: string
    name: string
  } | null
  user: {
    id: string
    name: string | null
  }
  createdAt: string
}

interface SuspendedSalesDialogProps {
  open: boolean
  onClose: () => void
  onResume: (cartData: any, discountType?: string, discountValue?: number, customerId?: string) => void
}

export function SuspendedSalesDialog({
  open,
  onClose,
  onResume,
}: SuspendedSalesDialogProps) {
  const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSuspendedSales = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/suspended-sales")

      if (!response.ok) {
        throw new Error("Error al cargar las ventas suspendidas")
      }

      const data = await response.json()
      setSuspendedSales(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar las ventas suspendidas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchSuspendedSales()
    }
  }, [open])

  const handleResume = async (sale: SuspendedSale) => {
    try {
      const cartData = JSON.parse(sale.cartData)
      const discountValue = sale.discountValue ? parseFloat(sale.discountValue) : undefined

      onResume(
        cartData,
        sale.discountType || undefined,
        discountValue,
        sale.customerId || undefined
      )

      // Delete the suspended sale after resuming
      await fetch(`/api/suspended-sales/${sale.id}`, {
        method: "DELETE",
      })

      toast({
        title: "Venta reanudada",
        description: `La venta "${sale.name}" ha sido cargada`,
      })

      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo reanudar la venta",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar la venta "${name}"?`)) {
      return
    }

    try {
      setDeletingId(id)
      const response = await fetch(`/api/suspended-sales/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Error al eliminar la venta")
      }

      toast({
        title: "Venta eliminada",
        description: `La venta "${name}" ha sido eliminada`,
      })

      // Refresh the list
      fetchSuspendedSales()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la venta",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Ventas Suspendidas</DialogTitle>
          <DialogDescription>
            Selecciona una venta para reanudarla o eliminarla
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : suspendedSales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay ventas suspendidas</p>
            </div>
          ) : (
            suspendedSales.map((sale) => {
              const itemCount = JSON.parse(sale.cartData).length
              const timeAgo = formatDistanceToNow(new Date(sale.createdAt), {
                addSuffix: true,
                locale: es,
              })

              return (
                <div
                  key={sale.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{sale.name}</h3>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {itemCount} {itemCount === 1 ? "producto" : "productos"}
                      </Badge>

                      {sale.discountValue && parseFloat(sale.discountValue) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Desc: {sale.discountType === "PERCENTAGE"
                            ? `${sale.discountValue}%`
                            : `$${sale.discountValue}`}
                        </Badge>
                      )}

                      {sale.customer && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {sale.customer.name}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo}
                      </span>
                      <span>Por: {sale.user.name || "Usuario"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleResume(sale)}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-4 w-4" />
                      Reanudar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(sale.id, sale.name)}
                      disabled={deletingId === sale.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === sale.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
