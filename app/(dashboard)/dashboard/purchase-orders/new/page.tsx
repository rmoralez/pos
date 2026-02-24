"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Minus, Trash2, ShoppingCart, Save } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { FileUpload } from "@/components/upload/file-upload"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Product {
  id: string
  sku: string
  name: string
  costPrice: number | null
  salePrice: number | null
  taxRate: number
}

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
}

interface OrderItem {
  productId: string
  productName: string
  quantityOrdered: number
  unitCost: number
  taxRate: number
  subtotal: number
  total: number
}

interface ExtraItem {
  description: string
  quantityReceived: number
  unitCost: number
  taxRate: number
  total: number
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<string>("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([])
  const [notes, setNotes] = useState("")
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("")
  const [supplierRemitoNumber, setSupplierRemitoNumber] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [scannedInvoicePath, setScannedInvoicePath] = useState<string>("")
  const [remitoFilePath, setRemitoFilePath] = useState<string>("")
  const [tempPoId] = useState(() => crypto.randomUUID())

  // Product search for adding to order
  const [productSearch, setProductSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Product[]>([])

  useEffect(() => {
    fetchSuppliers()
    fetchProducts()
  }, [])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      if (!response.ok) throw new Error("Failed to fetch suppliers")
      const data = await response.json()
      setSuppliers(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los proveedores",
        variant: "destructive",
      })
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products?isActive=true")
      if (!response.ok) throw new Error("Failed to fetch products")
      const data = await response.json()
      setProducts(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    }
  }

  const handleProductSearch = (value: string) => {
    setProductSearch(value)
    if (value.length >= 2) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.sku?.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10)
      setSearchResults(filtered)
    } else {
      setSearchResults([])
    }
  }

  const addProduct = (product: Product) => {
    const existingItem = items.find(item => item.productId === product.id)

    if (existingItem) {
      updateItemQuantity(product.id, existingItem.quantityOrdered + 1)
    } else {
      const unitCost = Number(product.costPrice) || 0
      const taxRate = Number(product.taxRate) || 21
      const newItem: OrderItem = {
        productId: product.id,
        productName: product.name,
        quantityOrdered: 1,
        unitCost,
        taxRate,
        subtotal: unitCost,
        total: unitCost * (1 + taxRate / 100),
      }
      setItems([...items, newItem])
    }

    setProductSearch("")
    setSearchResults([])
  }

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }

    setItems(items.map(item => {
      if (item.productId === productId) {
        const subtotal = item.unitCost * quantity
        const total = subtotal * (1 + item.taxRate / 100)
        return { ...item, quantityOrdered: quantity, subtotal, total }
      }
      return item
    }))
  }

  const updateItemCost = (productId: string, cost: number) => {
    setItems(items.map(item => {
      if (item.productId === productId) {
        const subtotal = cost * item.quantityOrdered
        const total = subtotal * (1 + item.taxRate / 100)
        return { ...item, unitCost: cost, subtotal, total }
      }
      return item
    }))
  }

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId))
  }

  const addExtraItem = () => {
    setExtraItems([
      ...extraItems,
      {
        description: "",
        quantityReceived: 1,
        unitCost: 0,
        taxRate: 21,
        total: 0,
      },
    ])
  }

  const updateExtraItem = (index: number, field: keyof ExtraItem, value: string | number) => {
    setExtraItems(extraItems.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value }
        if (field !== "total") {
          const subtotal = Number(updated.unitCost) * Number(updated.quantityReceived)
          updated.total = subtotal * (1 + Number(updated.taxRate) / 100)
        }
        return updated
      }
      return item
    }))
  }

  const removeExtraItem = (index: number) => {
    setExtraItems(extraItems.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    const itemsSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const itemsTax = items.reduce((sum, item) => sum + (item.total - item.subtotal), 0)

    const extrasSubtotal = extraItems.reduce((sum, item) => {
      const subtotal = Number(item.unitCost) * Number(item.quantityReceived)
      return sum + subtotal
    }, 0)
    const extrasTax = extraItems.reduce((sum, item) => sum + (item.total - (Number(item.unitCost) * Number(item.quantityReceived))), 0)

    const subtotal = itemsSubtotal + extrasSubtotal
    const taxAmount = itemsTax + extrasTax
    const total = subtotal + taxAmount

    return { subtotal, taxAmount, total }
  }

  const handleSave = async (status: "DRAFT" | "PENDING") => {
    if (!selectedSupplier) {
      toast({
        title: "Error",
        description: "Debe seleccionar un proveedor",
        variant: "destructive",
      })
      return
    }

    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un producto",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        supplierId: selectedSupplier,
        status,
        items: items.map(item => ({
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
        })),
        extraItems: extraItems.length > 0
          ? extraItems.filter(item => item.description.trim() !== "").map(item => ({
              description: item.description,
              quantityReceived: item.quantityReceived,
              unitCost: item.unitCost,
              taxRate: item.taxRate,
            }))
          : undefined,
        notes: notes || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        supplierRemitoNumber: supplierRemitoNumber || undefined,
        scannedInvoicePath: scannedInvoicePath || undefined,
        remitoFilePath: remitoFilePath || undefined,
      }

      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create purchase order")
      }

      const result = await response.json()

      toast({
        title: "Orden de compra creada",
        description: `La orden ${result.purchaseNumber} ha sido creada exitosamente`,
      })

      router.push(`/dashboard/purchase-orders/${result.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la orden de compra",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Compra</h1>
          <p className="text-muted-foreground">
            Crear una nueva orden de compra a proveedor
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave("DRAFT")}
            disabled={isSaving || items.length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            Guardar Borrador
          </Button>
          <Button
            onClick={() => handleSave("PENDING")}
            disabled={isSaving || items.length === 0}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Crear Orden
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor *</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">N° Factura Proveedor</Label>
                <Input
                  id="invoiceNumber"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  placeholder="Ej: 0001-00001234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remitoNumber">N° Remito</Label>
                <Input
                  id="remitoNumber"
                  value={supplierRemitoNumber}
                  onChange={(e) => setSupplierRemitoNumber(e.target.value)}
                  placeholder="Ej: R-001234"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones o comentarios..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
            <CardDescription>
              Adjuntar factura del proveedor y remito escaneados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              label="Factura del Proveedor"
              description="Subir factura escaneada (PDF o imagen)"
              onFileUploaded={setScannedInvoicePath}
              currentFilePath={scannedInvoicePath}
              recordType="purchase-order"
              recordId={tempPoId}
              documentType="invoice"
            />
            <FileUpload
              label="Remito"
              description="Subir remito escaneado (PDF o imagen)"
              onFileUploaded={setRemitoFilePath}
              currentFilePath={remitoFilePath}
              recordType="purchase-order"
              recordId={tempPoId}
              documentType="remito"
            />
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
                ${totals.subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA:</span>
              <span className="font-medium">
                ${totals.taxAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>
                ${totals.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-sm text-muted-foreground border-t pt-2">
              <div className="flex justify-between">
                <span>Items:</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Items extra:</span>
                <span>{extraItems.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Agregar productos a la orden de compra
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar producto</Label>
            <Input
              value={productSearch}
              onChange={(e) => handleProductSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
            />
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map(product => (
                  <div
                    key={product.id}
                    className="p-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
                    onClick={() => addProduct(product)}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {product.sku} | Costo: ${Number(product.costPrice || 0).toLocaleString("es-AR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos agregados</p>
              <p className="text-sm">Busca y agrega productos arriba</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-24">Cantidad</TableHead>
                    <TableHead className="w-32">Costo Unit.</TableHead>
                    <TableHead className="w-24">IVA %</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.productId, item.quantityOrdered - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantityOrdered}
                            onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                            className="h-8 w-16 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.productId, item.quantityOrdered + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItemCost(item.productId, parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.taxRate}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        ${item.subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.productId)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items Extra</CardTitle>
              <CardDescription>
                Gastos adicionales (envío, impuestos, etc.)
              </CardDescription>
            </div>
            <Button onClick={addExtraItem} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Item Extra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {extraItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay items extra agregados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {extraItems.map((item, index) => (
                <div key={index} className="flex gap-4 items-start border-b pb-4 last:border-b-0">
                  <div className="flex-1 grid gap-4 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <Label>Descripción</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateExtraItem(index, "description", e.target.value)}
                        placeholder="Ej: Envío, Seguro..."
                      />
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantityReceived}
                        onChange={(e) => updateExtraItem(index, "quantityReceived", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Costo</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateExtraItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="pt-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExtraItem(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
