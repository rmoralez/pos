"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Receipt } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"

interface Sale {
  id: string
  saleNumber: string
  total: number
  status: string
  createdAt: string
  user: {
    name: string | null
  }
  items: Array<{
    quantity: number
    product: {
      name: string
    }
  }>
  payments: Array<{
    method: string
  }>
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/sales")
      if (!response.ok) throw new Error("Failed to fetch sales")

      const data = await response.json()
      setSales(data.sales || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las ventas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: "Efectivo",
      DEBIT_CARD: "Débito",
      CREDIT_CARD: "Crédito",
      QR: "QR",
      TRANSFER: "Transferencia",
      CHECK: "Cheque",
      OTHER: "Otro",
    }
    return labels[method] || method
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      COMPLETED: "default",
      PENDING: "secondary",
      CANCELLED: "destructive",
      REFUNDED: "secondary",
    }
    const labels: Record<string, string> = {
      COMPLETED: "Completada",
      PENDING: "Pendiente",
      CANCELLED: "Cancelada",
      REFUNDED: "Devuelta",
    }

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historial de Ventas</h1>
        <p className="text-muted-foreground">
          Consulta todas las ventas realizadas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas Recientes</CardTitle>
          <CardDescription>
            Últimas 50 ventas registradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cargando ventas...</p>
              </div>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay ventas registradas</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Venta</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cajero</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-sm">
                        {sale.saleNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>{sale.user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sale.items.reduce((acc, item) => acc + item.quantity, 0)} items
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sale.payments.length > 0 && (
                          <Badge variant="secondary">
                            {getPaymentMethodLabel(sale.payments[0].method)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(sale.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
