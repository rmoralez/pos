"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import {
  calculateSalePriceWithTax,
  calculateMarginWithTax,
  roundSalePriceAndRecalculateMargin,
  type RoundingStrategy,
} from "@/lib/pricing"
import { Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface ProductFormProps {
  productId?: string
  initialData?: any
}

interface Category {
  id: string
  name: string
  children?: Category[]
}

interface AlternativeCode {
  id: string
  code: string
  label: string | null
}

// Pending entry used only during new product creation (before the product has an id)
interface PendingCode {
  tempId: string
  code: string
  label: string
}

export function ProductForm({ productId, initialData }: ProductFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(21)

  // Alternative codes — for existing products these are loaded from API
  const [altCodes, setAltCodes] = useState<AlternativeCode[]>(
    initialData?.alternativeCodes ?? []
  )
  // Pending codes — only used when creating a new product
  const [pendingCodes, setPendingCodes] = useState<PendingCode[]>([])
  const [newCodeInput, setNewCodeInput] = useState({ code: "", label: "" })
  const [altCodeLoading, setAltCodeLoading] = useState(false)

  // Calculate initial margin if both prices are present (tax-aware)
  const initialTaxRate = initialData?.taxRate != null ? Number(initialData.taxRate) : 21
  const initialMargin = initialData?.costPrice && initialData?.salePrice
    ? calculateMarginWithTax(Number(initialData.costPrice), initialTaxRate, Number(initialData.salePrice)).toString()
    : ""

  const [formData, setFormData] = useState({
    sku: initialData?.sku || "",
    barcode: initialData?.barcode || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    costPrice: initialData?.costPrice != null ? String(initialData.costPrice) : "",
    salePrice: initialData?.salePrice != null ? String(initialData.salePrice) : "",
    margin: initialMargin,
    taxRate: initialData?.taxRate != null ? String(initialData.taxRate) : "21",
    unit: initialData?.unit || "UNIDAD",
    brand: initialData?.brand || "",
    categoryId: initialData?.categoryId || "",
    minStock: initialData?.minStock != null ? String(initialData.minStock) : "0",
    trackStock: initialData?.trackStock !== false,
    initialStock: "",
    isActive: initialData?.isActive !== false,
  })

  // Refs to track which field was last changed to prevent calculation loops
  const lastChangedField = useRef<'costPrice' | 'salePrice' | 'margin' | 'taxRate' | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    sku?: string
    name?: string
    costPrice?: string
    salePrice?: string
    taxRate?: string
    initialStock?: string
  }>({})

  useEffect(() => {
    fetchCategories()
    fetchTenantTaxRate()
  }, [])

  const fetchTenantTaxRate = async () => {
    try {
      const response = await fetch("/api/tenants/current")
      if (response.ok) {
        const data = await response.json()
        const rate = Number(data.defaultTaxRate)
        if (!isNaN(rate)) {
          setDefaultTaxRate(rate)
          // Only set taxRate default for new products (no initialData)
          if (!initialData) {
            setFormData(prev => ({ ...prev, taxRate: String(rate) }))
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch tenant tax rate:", error)
    }
  }

  // Bidirectional pricing calculations (tax-aware)
  // When cost, sale price, or taxRate changes, recalculate margin
  useEffect(() => {
    const cost = Number(formData.costPrice)
    const sale = Number(formData.salePrice)
    const tax = Number(formData.taxRate)

    if (cost > 0 && sale > 0 && !isNaN(tax) && lastChangedField.current !== 'margin') {
      const newMargin = calculateMarginWithTax(cost, tax, sale)
      setFormData(prev => ({ ...prev, margin: newMargin.toString() }))
    }
  }, [formData.costPrice, formData.salePrice, formData.taxRate])

  // When margin changes (and we have cost + taxRate), recalculate sale price
  useEffect(() => {
    const cost = Number(formData.costPrice)
    const margin = Number(formData.margin)
    const tax = Number(formData.taxRate)

    if (cost > 0 && lastChangedField.current === 'margin' && !isNaN(margin) && !isNaN(tax)) {
      const newSalePrice = calculateSalePriceWithTax(cost, tax, margin)
      setFormData(prev => ({ ...prev, salePrice: newSalePrice.toString() }))
      lastChangedField.current = null
    }
  }, [formData.margin, formData.costPrice, formData.taxRate])

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories")
      if (response.ok) {
        const data = await response.json()
        // Flatten the tree structure for dropdown display
        const flattenCategories = (cats: Category[], parent: string = ""): Category[] => {
          const result: Category[] = []
          for (const cat of cats) {
            const path = parent ? `${parent} > ${cat.name}` : cat.name
            result.push({ ...cat, name: path })
            if (cat.children && cat.children.length > 0) {
              result.push(...flattenCategories(cat.children, path))
            }
          }
          return result
        }
        setCategories(flattenCategories(data))
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error)
    }
  }

  // --- Alternative codes handlers ---

  const handleAddCode = async () => {
    if (!newCodeInput.code.trim()) return

    if (productId) {
      // Existing product: persist immediately
      setAltCodeLoading(true)
      try {
        const res = await fetch(`/api/products/${productId}/alternative-codes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: newCodeInput.code.trim(), label: newCodeInput.label.trim() || undefined }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Error al agregar código")
        }
        const created: AlternativeCode = await res.json()
        setAltCodes((prev) => [...prev, created])
        setNewCodeInput({ code: "", label: "" })
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" })
      } finally {
        setAltCodeLoading(false)
      }
    } else {
      // New product: queue locally
      setPendingCodes((prev) => [
        ...prev,
        { tempId: crypto.randomUUID(), code: newCodeInput.code.trim(), label: newCodeInput.label.trim() },
      ])
      setNewCodeInput({ code: "", label: "" })
    }
  }

  const handleDeleteCode = async (codeId: string) => {
    if (!productId) return
    setAltCodeLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/alternative-codes/${codeId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al eliminar código")
      }
      setAltCodes((prev) => prev.filter((c) => c.id !== codeId))
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setAltCodeLoading(false)
    }
  }

  const handleDeletePending = (tempId: string) => {
    setPendingCodes((prev) => prev.filter((c) => c.tempId !== tempId))
  }

  const handleCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddCode()
    }
  }

  const handleRounding = (strategy: RoundingStrategy) => {
    const cost = Number(formData.costPrice)
    const sale = Number(formData.salePrice)
    const tax = Number(formData.taxRate)

    if (cost > 0 && sale > 0) {
      const result = roundSalePriceAndRecalculateMargin(cost, sale, strategy)
      const newMargin = calculateMarginWithTax(cost, tax, result.salePrice)
      setFormData(prev => ({
        ...prev,
        salePrice: result.salePrice.toString(),
        margin: newMargin.toString(),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous validation errors
    setValidationErrors({})

    // Validate required fields
    const errors: typeof validationErrors = {}

    if (!formData.sku || formData.sku.trim() === "") {
      errors.sku = "Campo requerido"
    }

    if (!formData.name || formData.name.trim() === "") {
      errors.name = "Campo requerido"
    }

    if (!formData.costPrice || formData.costPrice.trim() === "") {
      errors.costPrice = "Campo requerido"
    } else if (parseFloat(formData.costPrice) < 0) {
      errors.costPrice = "El precio debe ser positivo"
    }

    if (!formData.salePrice || formData.salePrice.trim() === "") {
      errors.salePrice = "Campo requerido"
    } else if (parseFloat(formData.salePrice) < 0) {
      errors.salePrice = "El precio debe ser positivo"
    }

    if (!formData.taxRate || formData.taxRate.trim() === "") {
      errors.taxRate = "Campo requerido"
    } else {
      const taxRateNum = parseFloat(formData.taxRate)
      if (taxRateNum < 0 || taxRateNum > 100) {
        errors.taxRate = "La tasa de impuesto debe ser válida (0-100)"
      }
    }

    // If there are validation errors, show them and stop
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setIsLoading(true)

    try {
      const url = productId ? `/api/products/${productId}` : "/api/products"
      const method = productId ? "PUT" : "POST"

      const payload = {
        sku: formData.sku,
        barcode: formData.barcode || undefined,
        name: formData.name,
        description: formData.description || undefined,
        costPrice: parseFloat(formData.costPrice),
        salePrice: parseFloat(formData.salePrice),
        taxRate: parseFloat(formData.taxRate),
        unit: formData.unit,
        brand: formData.brand || undefined,
        categoryId: formData.categoryId || undefined,
        minStock: parseInt(formData.minStock),
        trackStock: formData.trackStock,
        initialStock: formData.initialStock ? parseInt(formData.initialStock) : undefined,
        isActive: formData.isActive,
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save product")
      }

      // If creating a new product and we have pending alternative codes, save them now
      if (!productId && pendingCodes.length > 0) {
        const newProduct = await response.clone().json()
        await Promise.allSettled(
          pendingCodes.map((pc) =>
            fetch(`/api/products/${newProduct.id}/alternative-codes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: pc.code, label: pc.label || undefined }),
            })
          )
        )
      }

      toast({
        title: productId ? "Producto actualizado exitosamente" : "Producto creado exitosamente",
      })

      router.push("/dashboard/products")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar el producto",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
          <CardDescription>
            Datos principales del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => {
                  setFormData({ ...formData, sku: e.target.value })
                  if (validationErrors.sku) {
                    setValidationErrors({ ...validationErrors, sku: undefined })
                  }
                }}
                disabled={isLoading}
                placeholder="PROD-001"
              />
              {validationErrors.sku && (
                <p className="text-sm text-destructive">{validationErrors.sku}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                disabled={isLoading}
                placeholder="7790001234567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (validationErrors.name) {
                  setValidationErrors({ ...validationErrors, name: undefined })
                }
              }}
              disabled={isLoading}
              placeholder="Ej: Mouse Inalámbrico"
            />
            {validationErrors.name && (
              <p className="text-sm text-destructive">{validationErrors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isLoading}
              placeholder="Descripción del producto"
            />
          </div>

          {/* Active status toggle — only shown when editing */}
          {productId && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked === true })
                }
                disabled={isLoading}
              />
              <Label htmlFor="isActive">Activo</Label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                disabled={isLoading}
                placeholder="Marca del producto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoría</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precios e Impuestos</CardTitle>
          <CardDescription>
            Configuración de costos y precios de venta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Precio de costo</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) => {
                  lastChangedField.current = 'costPrice'
                  setFormData({ ...formData, costPrice: e.target.value })
                  if (validationErrors.costPrice) {
                    setValidationErrors({ ...validationErrors, costPrice: undefined })
                  }
                }}
                disabled={isLoading}
                placeholder="0.00"
              />
              {validationErrors.costPrice && (
                <p className="text-sm text-destructive">{validationErrors.costPrice}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="salePrice">Precio de venta</Label>
              <div className="space-y-2">
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) => {
                    lastChangedField.current = 'salePrice'
                    setFormData({ ...formData, salePrice: e.target.value })
                    if (validationErrors.salePrice) {
                      setValidationErrors({ ...validationErrors, salePrice: undefined })
                    }
                  }}
                  disabled={isLoading}
                  placeholder="0.00"
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRounding('nearestFive')}
                    disabled={isLoading || !formData.costPrice || !formData.salePrice}
                    className="flex-1 text-xs h-7"
                  >
                    $5
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRounding('nearestTen')}
                    disabled={isLoading || !formData.costPrice || !formData.salePrice}
                    className="flex-1 text-xs h-7"
                  >
                    $10
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRounding('nearestFifty')}
                    disabled={isLoading || !formData.costPrice || !formData.salePrice}
                    className="flex-1 text-xs h-7"
                  >
                    $50
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRounding('nearestHundred')}
                    disabled={isLoading || !formData.costPrice || !formData.salePrice}
                    className="flex-1 text-xs h-7"
                  >
                    $100
                  </Button>
                </div>
              </div>
              {validationErrors.salePrice && (
                <p className="text-sm text-destructive">{validationErrors.salePrice}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="margin">
                Margen %
              </Label>
              <Input
                id="margin"
                type="number"
                step="0.01"
                value={formData.margin}
                onChange={(e) => {
                  lastChangedField.current = 'margin'
                  setFormData({ ...formData, margin: e.target.value })
                }}
                disabled={isLoading}
                placeholder="0.00"
                className={
                  formData.margin && Number(formData.margin) < 0
                    ? "text-red-600 font-semibold"
                    : formData.margin && Number(formData.margin) > 0
                    ? "text-green-600 font-semibold"
                    : ""
                }
              />
              {formData.margin && (
                <p className={`text-xs ${Number(formData.margin) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {Number(formData.margin) >= 0 ? '+' : ''}{formData.margin}%
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">IVA (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                value={formData.taxRate}
                onChange={(e) => {
                  lastChangedField.current = 'taxRate'
                  setFormData({ ...formData, taxRate: e.target.value })
                  if (validationErrors.taxRate) {
                    setValidationErrors({ ...validationErrors, taxRate: undefined })
                  }
                }}
                disabled={isLoading}
                placeholder={String(defaultTaxRate)}
              />
              <p className="text-xs text-muted-foreground">
                Por defecto: {defaultTaxRate}% (config.)
              </p>
              {validationErrors.taxRate && (
                <p className="text-sm text-destructive">{validationErrors.taxRate}</p>
              )}
            </div>
          </div>

          {/* Price breakdown */}
          {formData.costPrice && Number(formData.costPrice) > 0 && (
            <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm">
              {(() => {
                const cost = Number(formData.costPrice)
                const tax = Number(formData.taxRate) || 0
                const margin = Number(formData.margin) || 0
                const costWithTax = cost * (1 + tax / 100)
                const sale = Number(formData.salePrice) || 0
                return (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
                    <span className="text-muted-foreground">Costo</span>
                    <span className="font-semibold">${cost.toFixed(2)}</span>
                    <span className="text-muted-foreground">+</span>
                    <span className="text-muted-foreground">IVA {tax}%</span>
                    <span className="font-semibold text-blue-600">(${(costWithTax - cost).toFixed(2)})</span>
                    <span className="text-muted-foreground">+</span>
                    <span className="text-muted-foreground">Margen {margin.toFixed(2)}%</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="font-bold text-green-700">${sale.toFixed(2)}</span>
                  </div>
                )
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock e Inventario</CardTitle>
          <CardDescription>
            Configuración de stock y unidades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unidad de Medida</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIDAD">Unidad</SelectItem>
                  <SelectItem value="KG">Kilogramo</SelectItem>
                  <SelectItem value="LITRO">Litro</SelectItem>
                  <SelectItem value="METRO">Metro</SelectItem>
                  <SelectItem value="PAQUETE">Paquete</SelectItem>
                  <SelectItem value="CAJA">Caja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Stock Mínimo</Label>
              <Input
                id="minStock"
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                disabled={isLoading}
                placeholder="0"
              />
            </div>
            {!productId && (
              <div className="space-y-2">
                <Label htmlFor="initialStock">Stock inicial</Label>
                <Input
                  id="initialStock"
                  type="number"
                  value={formData.initialStock}
                  onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Códigos Alternativos</CardTitle>
          <CardDescription>
            Códigos internos de proveedores u otros identificadores adicionales del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing codes (edit mode) */}
          {altCodes.length > 0 && (
            <div className="space-y-2">
              {altCodes.map((ac) => (
                <div key={ac.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <span className="font-mono text-sm font-medium flex-shrink-0">{ac.code}</span>
                  {ac.label && (
                    <span className="text-sm text-muted-foreground flex-1 truncate">{ac.label}</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => handleDeleteCode(ac.id)}
                    disabled={altCodeLoading || isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending codes (create mode) */}
          {pendingCodes.length > 0 && (
            <div className="space-y-2">
              {pendingCodes.map((pc) => (
                <div key={pc.tempId} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 bg-muted/30">
                  <span className="font-mono text-sm font-medium flex-shrink-0">{pc.code}</span>
                  {pc.label && (
                    <span className="text-sm text-muted-foreground flex-1 truncate">{pc.label}</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => handleDeletePending(pc.tempId)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new code input */}
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <Input
                placeholder="Código *"
                value={newCodeInput.code}
                onChange={(e) => setNewCodeInput({ ...newCodeInput, code: e.target.value })}
                onKeyDown={handleCodeKeyDown}
                disabled={altCodeLoading || isLoading}
                className="font-mono"
              />
            </div>
            <div className="space-y-1 flex-[2]">
              <Input
                placeholder="Etiqueta (ej: Código proveedor ABC)"
                value={newCodeInput.label}
                onChange={(e) => setNewCodeInput({ ...newCodeInput, label: e.target.value })}
                onKeyDown={handleCodeKeyDown}
                disabled={altCodeLoading || isLoading}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddCode}
              disabled={!newCodeInput.code.trim() || altCodeLoading || isLoading}
              className="flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Presioná Enter o el botón + para agregar. El código es requerido, la etiqueta es opcional.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar Producto"}
        </Button>
      </div>
    </form>
  )
}
