"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Package, FileText } from "lucide-react"
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
  Supplier: {
    name: string
  }
  Location: {
    name: string
  }
  PurchaseOrderItem: Array<{
    id: string
    quantityOrdered: number
    quantityReceived: number
    unitCost: number
    Product: {
      id: string
      name: string
      sku: string
      costPrice: number | null
    } | null
    ProductVariant: {
      id: string
      sku: string
      variantValues: string
      costPrice: number
    } | null
  }>
}

interface ReceiveItem {
  itemId: string
  productName: string
  productId: string | null
  productVariantId: string | null
  quantityOrdered: number
  quantityReceived: number
  quantityToReceive: number
  currentCostPrice: number | null
  unitCost: number
  updateCostPrice: boolean
  newCostPrice: number
}

export default function ReceivePurchaseOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
  const [receivingNotes, setReceivingNotes] = useState("")

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

      // Initialize receive items
      const items: ReceiveItem[] = data.PurchaseOrderItem.map((item: any) => ({
        itemId: item.id,
        productName: item.Product?.name || item.ProductVariant?.variantValues || "N/A",
        productId: item.Product?.id || null,
        productVariantId: item.ProductVariant?.id || null,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        quantityToReceive: item.quantityOrdered - item.quantityReceived,
        currentCostPrice: item.Product?.costPrice || item.ProductVariant?.costPrice || null,
        unitCost: Number(item.unitCost),
        updateCostPrice: false,
        newCostPrice: Number(item.unitCost),
      }))

      setReceiveItems(items)
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

  const updateReceiveQuantity = (itemId: string, quantity: number) => {
    setReceiveItems(items =>
      items.map(item => {
        if (item.itemId === itemId) {
          const maxReceivable = item.quantityOrdered - item.quantityReceived
          const safeQuantity = Math.max(0, Math.min(quantity, maxReceivable))
          return { ...item, quantityToReceive: safeQuantity }
        }
        return item
      })
    )
  }

  const toggleUpdateCostPrice = (itemId: string, checked: boolean) => {
    setReceiveItems(items =>
      items.map(item => {
        if (item.itemId === itemId) {
          return {
            ...item,
            updateCostPrice: checked,
            newCostPrice: checked ? item.unitCost : item.newCostPrice,
          }
        }
        return item
      })
    )
  }

  const updateNewCostPrice = (itemId: string, price: number) => {
    setReceiveItems(items =>
      items.map(item => {
        if (item.itemId === itemId) {
          return { ...item, newCostPrice: price }
        }
        return item
      })
    )
  }

  const receiveAll = () => {
    setReceiveItems(items =>
      items.map(item => ({
        ...item,
        quantityToReceive: item.quantityOrdered - item.quantityReceived,
      }))
    )
  }

  const clearAll = () => {
    setReceiveItems(items =>
      items.map(item => ({
        ...item,
        quantityToReceive: 0,
      }))
    )
  }

  const handleSubmit = async () => {
    const itemsToReceive = receiveItems.filter(item => item.quantityToReceive > 0)

    if (itemsToReceive.length === 0) {
      toast({
        title: "Error",
        description: "Debe ingresar al menos un producto a recibir",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        receivedItems: itemsToReceive.map(item => ({
          itemId: item.itemId,
          quantityReceived: item.quantityToReceive,
          updateCostPrice: item.updateCostPrice,
          newCostPrice: item.updateCostPrice ? item.newCostPrice : undefined,
        })),
        receivingNotes: receivingNotes || undefined,
      }

      const response = await fetch(`/api/purchase-orders/${params.id}/receive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to receive items")
      }

      toast({
        title: "Recepción exitosa",
        description: "Los productos han sido recibidos correctamente",
      })

      router.push(`/dashboard/purchase-orders/${params.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo recibir la mercadería",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
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

  const totalToReceive = receiveItems.reduce((sum, item) => sum + item.quantityToReceive, 0)
  const totalPending = receiveItems.reduce(
    (sum, item) => sum + (item.quantityOrdered - item.quantityReceived),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Recibir Mercadería - {purchaseOrder.purchaseNumber}
            </h1>
            <p className="text-muted-foreground">
              Proveedor: {purchaseOrder.Supplier.name} | Ubicación: {purchaseOrder.Location.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || totalToReceive === 0}>
            <Package className="mr-2 h-4 w-4" />
            Confirmar Recepción ({totalToReceive} items)
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Ordenado</CardDescription>
            <CardTitle className="text-3xl">
              {receiveItems.reduce((sum, item) => sum + item.quantityOrdered, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Ya Recibido</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {receiveItems.reduce((sum, item) => sum + item.quantityReceived, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pendiente</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              {totalPending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>A Recibir Ahora</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {totalToReceive}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Productos a Recibir</CardTitle>
              <CardDescription>
                Ingrese la cantidad recibida para cada producto
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearAll}>
                Limpiar Todo
              </Button>
              <Button variant="outline" size="sm" onClick={receiveAll}>
                Recibir Todo Pendiente
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Ordenado</TableHead>
                  <TableHead className="text-center">Recibido</TableHead>
                  <TableHead className="text-center">Pendiente</TableHead>
                  <TableHead className="w-32">Recibir Ahora</TableHead>
                  <TableHead className="text-right">Costo Unit.</TableHead>
                  <TableHead className="w-48">Actualizar Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiveItems.map((item) => {
                  const pending = item.quantityOrdered - item.quantityReceived
                  return (
                    <TableRow key={item.itemId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          {item.currentCostPrice !== null && (
                            <div className="text-sm text-muted-foreground">
                              Costo actual: ${Number(item.currentCostPrice).toLocaleString("es-AR")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.quantityOrdered}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{item.quantityReceived}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={pending > 0 ? "default" : "outline"} className={pending > 0 ? "bg-yellow-600" : ""}>
                          {pending}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={pending}
                          value={item.quantityToReceive}
                          onChange={(e) => updateReceiveQuantity(item.itemId, parseInt(e.target.value) || 0)}
                          className="h-8"
                          disabled={pending === 0}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(item.unitCost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`update-${item.itemId}`}
                              checked={item.updateCostPrice}
                              onCheckedChange={(checked) =>
                                toggleUpdateCostPrice(item.itemId, checked as boolean)
                              }
                              disabled={item.quantityToReceive === 0}
                            />
                            <label
                              htmlFor={`update-${item.itemId}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Actualizar
                            </label>
                          </div>
                          {item.updateCostPrice && (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.newCostPrice}
                              onChange={(e) => updateNewCostPrice(item.itemId, parseFloat(e.target.value) || 0)}
                              className="h-8"
                              placeholder="Nuevo costo"
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas de Recepción</CardTitle>
          <CardDescription>
            Observaciones sobre la mercadería recibida (opcional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={receivingNotes}
            onChange={(e) => setReceivingNotes(e.target.value)}
            placeholder="Ej: Mercadería en perfecto estado, sin daños..."
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  )
}
