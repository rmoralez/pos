"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, XCircle, Edit, FileText } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PurchaseOrder {
  id: string
  purchaseNumber: string
  subtotal: number
  taxAmount: number
  total: number
  status: string
  notes: string | null
  createdAt: string
  supplierInvoiceNumber: string | null
  supplierRemitoNumber: string | null
  supplierInvoiceDate: string | null
  receivedAt: string | null
  Supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
    cuit: string | null
    address: string | null
  }
  Location: {
    id: string
    name: string
    address: string | null
  }
  PurchaseOrderItem: Array<{
    id: string
    quantityOrdered: number
    quantityReceived: number
    unitCost: number
    subtotal: number
    taxRate: number
    taxAmount: number
    total: number
    notes: string | null
    receivingNotes: string | null
    Product: {
      id: string
      name: string
      sku: string
      barcode: string | null
    } | null
    ProductVariant: {
      id: string
      sku: string
      barcode: string | null
      variantValues: string
    } | null
  }>
  PurchaseOrderExtraItem: Array<{
    id: string
    description: string
    quantityReceived: number
    unitCost: number
    taxRate: number
    total: number
    notes: string | null
  }>
  User_PurchaseOrder_createdByUserIdToUser: {
    name: string | null
  }
  User_PurchaseOrder_receivedByUserIdToUser: {
    name: string | null
  } | null
}

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPurchaseOrder()
  }, [params.id])

  const fetchPurchaseOrder = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/purchase-orders/${params.id}`)
      if (!response.ok) throw new Error("Failed to fetch purchase order")

      const data = await response.json()
      setPurchaseOrder(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar la orden de compra",
        variant: "destructive",
      })
      router.push("/dashboard/purchase-orders")
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

  const handleCancel = async () => {
    if (!purchaseOrder) return

    const cancellationNote = prompt(
      `¿Está seguro que desea cancelar la orden ${purchaseOrder.purchaseNumber}?\n\nMotivo de cancelación (opcional):`
    )

    if (cancellationNote === null) {
      return
    }

    try {
      const response = await fetch(`/api/purchase-orders/${params.id}/cancel`, {
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
        description: `La orden ${purchaseOrder.purchaseNumber} ha sido cancelada exitosamente`,
      })

      fetchPurchaseOrder()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cancelar la orden de compra",
        variant: "destructive",
      })
    }
  }

  const calculateProgress = () => {
    if (!purchaseOrder) return { received: 0, pending: 0, percentage: 0 }

    const totalOrdered = purchaseOrder.PurchaseOrderItem.reduce(
      (sum, item) => sum + item.quantityOrdered,
      0
    )
    const totalReceived = purchaseOrder.PurchaseOrderItem.reduce(
      (sum, item) => sum + item.quantityReceived,
      0
    )

    return {
      received: totalReceived,
      pending: totalOrdered - totalReceived,
      percentage: totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0,
    }
  }

  if (isLoading || !purchaseOrder) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Cargando orden de compra...</p>
        </div>
      </div>
    )
  }

  const progress = calculateProgress()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {purchaseOrder.purchaseNumber}
              </h1>
              {getStatusBadge(purchaseOrder.status)}
            </div>
            <p className="text-muted-foreground">
              Orden de compra creada el{" "}
              {format(new Date(purchaseOrder.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(purchaseOrder.status === "PENDING" || purchaseOrder.status === "APPROVED") && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar Orden
              </Button>
              <Button
                onClick={() => router.push(`/dashboard/purchase-orders/${params.id}/receive`)}
              >
                <Package className="mr-2 h-4 w-4" />
                Recibir Mercadería
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Proveedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="font-semibold">{purchaseOrder.Supplier.name}</p>
              {purchaseOrder.Supplier.email && (
                <p className="text-sm text-muted-foreground">{purchaseOrder.Supplier.email}</p>
              )}
              {purchaseOrder.Supplier.phone && (
                <p className="text-sm text-muted-foreground">{purchaseOrder.Supplier.phone}</p>
              )}
              {purchaseOrder.Supplier.cuit && (
                <p className="text-sm text-muted-foreground">CUIT: {purchaseOrder.Supplier.cuit}</p>
              )}
            </div>
            {purchaseOrder.Supplier.address && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{purchaseOrder.Supplier.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ubicación:</span>
              <span className="font-medium">{purchaseOrder.Location.name}</span>
            </div>
            {purchaseOrder.supplierInvoiceNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">N° Factura:</span>
                <span className="font-medium">{purchaseOrder.supplierInvoiceNumber}</span>
              </div>
            )}
            {purchaseOrder.supplierRemitoNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">N° Remito:</span>
                <span className="font-medium">{purchaseOrder.supplierRemitoNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado por:</span>
              <span className="font-medium">
                {purchaseOrder.User_PurchaseOrder_createdByUserIdToUser.name || "N/A"}
              </span>
            </div>
            {purchaseOrder.receivedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recibido:</span>
                <span className="font-medium">
                  {format(new Date(purchaseOrder.receivedAt), "dd/MM/yyyy", { locale: es })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">
                ${Number(purchaseOrder.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA:</span>
              <span className="font-medium">
                ${Number(purchaseOrder.taxAmount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>
                ${Number(purchaseOrder.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {purchaseOrder.status !== "CANCELLED" && purchaseOrder.status !== "RECEIVED" && (
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recibido:</span>
                  <span className="text-green-600 font-medium">{progress.received} items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pendiente:</span>
                  <span className="text-yellow-600 font-medium">{progress.pending} items</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            {purchaseOrder.PurchaseOrderItem.length} productos en esta orden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Ordenado</TableHead>
                  <TableHead className="text-center">Recibido</TableHead>
                  <TableHead className="text-right">Costo Unit.</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.PurchaseOrderItem.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.Product?.name || item.ProductVariant?.variantValues || "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.Product?.sku || item.ProductVariant?.sku || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{item.quantityOrdered}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.quantityReceived === item.quantityOrdered ? "default" : "secondary"}
                        className={item.quantityReceived === item.quantityOrdered ? "bg-green-600" : ""}
                      >
                        {item.quantityReceived}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(item.unitCost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {Number(item.taxRate)}%
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(item.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {purchaseOrder.PurchaseOrderExtraItem.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items Extra</CardTitle>
            <CardDescription>
              Gastos adicionales de esta orden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder.PurchaseOrderExtraItem.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.quantityReceived}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(item.unitCost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(item.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {purchaseOrder.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{purchaseOrder.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
