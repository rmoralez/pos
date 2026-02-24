"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface InvoiceItem {
  id: string
  productId?: string
  productVariantId?: string
  description: string
  quantity: number
  unitCost: number
  taxRate: number
  subtotal: number
  taxAmount: number
  total: number
}

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
}

interface PurchaseOrder {
  id: string
  purchaseNumber: string
  total: number
  status: string
}

export default function NewSupplierInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  const [formData, setFormData] = useState({
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    purchaseOrderId: "",
    notes: "",
  })

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      quantity: 1,
      unitCost: 0,
      taxRate: 21,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  ])

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    if (formData.supplierId) {
      fetchPurchaseOrders(formData.supplierId)
    } else {
      setPurchaseOrders([])
      setFormData((prev) => ({ ...prev, purchaseOrderId: "" }))
    }
  }, [formData.supplierId])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data)
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error)
      toast.error("Error al cargar los proveedores")
    }
  }

  const fetchPurchaseOrders = async (supplierId: string) => {
    try {
      const response = await fetch(`/api/purchase-orders?supplierId=${supplierId}&status=APPROVED`)
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrders(data.purchaseOrders || [])
      }
    } catch (error) {
      console.error("Error fetching purchase orders:", error)
    }
  }

  const calculateItemTotals = (
    quantity: number,
    unitCost: number,
    taxRate: number
  ): Partial<InvoiceItem> => {
    const subtotal = quantity * unitCost
    const taxAmount = (subtotal * taxRate) / 100
    const total = subtotal + taxAmount
    return { subtotal, taxAmount, total }
  }

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          const totals = calculateItemTotals(
            updatedItem.quantity,
            updatedItem.unitCost,
            updatedItem.taxRate
          )
          return { ...updatedItem, ...totals }
        }
        return item
      })
    )
  }

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitCost: 0,
        taxRate: 21,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error("Debe haber al menos un ítem")
      return
    }
    setItems(items.filter((item) => item.id !== id))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0)
    const total = items.reduce((sum, item) => sum + item.total, 0)
    return { subtotal, taxAmount, total }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.supplierId) {
      toast.error("Debe seleccionar un proveedor")
      return
    }

    if (!formData.invoiceNumber.trim()) {
      toast.error("Debe ingresar el número de factura")
      return
    }

    if (!formData.invoiceDate) {
      toast.error("Debe ingresar la fecha de factura")
      return
    }

    const validItems = items.filter((item) => item.description.trim())
    if (validItems.length === 0) {
      toast.error("Debe agregar al menos un ítem con descripción")
      return
    }

    try {
      setLoading(true)

      const payload = {
        supplierId: formData.supplierId,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || undefined,
        purchaseOrderId: formData.purchaseOrderId || undefined,
        notes: formData.notes || undefined,
        items: validItems.map((item) => ({
          productId: item.productId || undefined,
          productVariantId: item.productVariantId || undefined,
          description: item.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
        })),
      }

      const response = await fetch("/api/supplier-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success("Factura creada exitosamente")
        router.push(`/dashboard/accounts-payable/${data.id}`)
      } else {
        const data = await response.json()
        toast.error(data.error || "Error al crear la factura")
      }
    } catch (error) {
      console.error("Error creating invoice:", error)
      toast.error("Error al crear la factura")
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/accounts-payable">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-2">Nueva Factura de Proveedor</h1>
          <p className="text-muted-foreground">
            Registra una nueva factura recibida de un proveedor
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Header */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Información de la Factura</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplierId">
                Proveedor <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) =>
                  setFormData({ ...formData, supplierId: value })
                }
              >
                <SelectTrigger id="supplierId">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="invoiceNumber">
                Número de Factura <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoiceNumber"
                placeholder="Ej: 0001-00001234"
                value={formData.invoiceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNumber: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="invoiceDate">
                Fecha de Factura <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formData.invoiceDate}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceDate: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>

            {purchaseOrders.length > 0 && (
              <div>
                <Label htmlFor="purchaseOrderId">Orden de Compra (opcional)</Label>
                <Select
                  value={formData.purchaseOrderId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, purchaseOrderId: value })
                  }
                >
                  <SelectTrigger id="purchaseOrderId">
                    <SelectValue placeholder="Seleccionar OC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin OC</SelectItem>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.purchaseNumber} - {formatCurrency(po.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales..."
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>
        </Card>

        {/* Invoice Items */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ítems de la Factura</h2>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Ítem
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-24">Cantidad</TableHead>
                  <TableHead className="w-32">Costo Unit.</TableHead>
                  <TableHead className="w-24">IVA %</TableHead>
                  <TableHead className="text-right w-32">Subtotal</TableHead>
                  <TableHead className="text-right w-32">IVA</TableHead>
                  <TableHead className="text-right w-32">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        placeholder="Descripción del producto/servicio"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(item.id, "description", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "quantity",
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitCost}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "unitCost",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.taxRate}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "taxRate",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.taxAmount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-6">
            <div className="w-full md:w-1/3 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA:</span>
                <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/dashboard/accounts-payable">
            <Button type="button" variant="outline" disabled={loading}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Guardando..." : "Guardar Factura"}
          </Button>
        </div>
      </form>
    </div>
  )
}
