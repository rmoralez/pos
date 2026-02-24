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
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Eye, XCircle, Package } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface PurchaseOrder {
  id: string
  purchaseNumber: string
  total: number
  subtotal: number
  taxAmount: number
  status: string
  createdAt: string
  Supplier: {
    id: string
    name: string
  }
  Location: {
    id: string
    name: string
  }
  User_PurchaseOrder_createdByUserIdToUser: {
    name: string | null
  }
  _count: {
    PurchaseOrderItem: number
    PurchaseOrderExtraItem: number
  }
}

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()

  useEffect(() => {
    fetchPurchaseOrders()
  }, [statusFilter])

  const fetchPurchaseOrders = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (searchTerm) {
        params.append("search", searchTerm)
      }

      const response = await fetch(`/api/purchase-orders?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch purchase orders")

      const data = await response.json()
      setPurchaseOrders(data.purchaseOrders || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes de compra",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, className?: string }> = {
      DRAFT: { variant: "secondary", label: "Borrador", className: "bg-gray-500 hover:bg-gray-600" },
      PENDING: { variant: "default", label: "Pendiente", className: "bg-yellow-500 hover:bg-yellow-600" },
      APPROVED: { variant: "default", label: "Parcial", className: "bg-blue-500 hover:bg-blue-600" },
      RECEIVED: { variant: "default", label: "Recibida", className: "bg-green-500 hover:bg-green-600" },
      CANCELLED: { variant: "destructive", label: "Cancelada" },
    }

    const config = variants[status] || variants.PENDING

    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const handleCancel = async (id: string, purchaseNumber: string) => {
    const cancellationNote = prompt(
      `¿Está seguro que desea cancelar la orden ${purchaseNumber}?\n\nMotivo de cancelación (opcional):`
    )

    if (cancellationNote === null) {
      return // User clicked cancel
    }

    try {
      const response = await fetch(`/api/purchase-orders/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancellationNote: cancellationNote || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel purchase order")
      }

      toast({
        title: "Orden cancelada",
        description: `La orden ${purchaseNumber} ha sido cancelada exitosamente`,
      })

      fetchPurchaseOrders()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cancelar la orden de compra",
        variant: "destructive",
      })
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPurchaseOrders()
  }

  const filteredOrders = searchTerm
    ? purchaseOrders.filter(po =>
        po.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.Supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : purchaseOrders

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Órdenes de Compra</h1>
          <p className="text-muted-foreground">
            Gestiona todas las órdenes de compra a proveedores
          </p>
        </div>
        <Link href="/dashboard/purchase-orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Orden de Compra
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Compra</CardTitle>
          <CardDescription>
            Todas las órdenes de compra registradas en el sistema
          </CardDescription>
          <div className="flex gap-4 mt-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <Input
                placeholder="Buscar por número o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <Button type="submit" variant="outline">Buscar</Button>
            </form>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="APPROVED">Parcial</SelectItem>
                <SelectItem value="RECEIVED">Recibida</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cargando órdenes de compra...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay órdenes de compra registradas</p>
                <Link href="/dashboard/purchase-orders/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primera Orden de Compra
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Orden</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-sm">
                        {po.purchaseNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(po.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {po.Supplier.name}
                      </TableCell>
                      <TableCell>
                        {po.Location.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {po._count.PurchaseOrderItem + po._count.PurchaseOrderExtraItem} items
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(po.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(po.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(po.status === "PENDING" || po.status === "APPROVED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/dashboard/purchase-orders/${po.id}/receive`)}
                              title="Recibir mercadería"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                          {(po.status === "PENDING" || po.status === "DRAFT" || po.status === "APPROVED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancel(po.id, po.purchaseNumber)}
                              title="Cancelar"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
