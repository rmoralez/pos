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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface VariantAttribute {
  key: string
  value: string
}

interface ConfiguredAttribute {
  id: string
  name: string
  displayName: string
  sortOrder: number
}

interface VariantDialogProps {
  open: boolean
  onClose: () => void
  productId: string
  productSku?: string
  variant?: any // Existing variant for edit mode
  onSuccess: () => void
}

export function VariantDialog({
  open,
  onClose,
  productId,
  productSku,
  variant,
  onSuccess,
}: VariantDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [attributes, setAttributes] = useState<VariantAttribute[]>([])
  const [configuredAttributes, setConfiguredAttributes] = useState<ConfiguredAttribute[]>([])
  const [parentProduct, setParentProduct] = useState<any>(null)
  const [formData, setFormData] = useState({
    sku: "",
    barcode: "",
    costPrice: "",
    salePrice: "",
    marginPercent: "",
    weight: "",
    width: "",
    height: "",
    depth: "",
    isActive: true,
  })

  // Fetch configured variant attributes
  useEffect(() => {
    const fetchConfiguredAttributes = async () => {
      try {
        const response = await fetch("/api/variant-attributes")
        if (response.ok) {
          const data = await response.json()
          setConfiguredAttributes(data)
        }
      } catch (error) {
        console.error("Failed to fetch configured attributes:", error)
      }
    }

    if (open) {
      fetchConfiguredAttributes()
    }
  }, [open])

  // Fetch parent product data to preset values
  useEffect(() => {
    const fetchParentProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          const data = await response.json()
          setParentProduct(data)
        }
      } catch (error) {
        console.error("Failed to fetch parent product:", error)
      }
    }

    if (open && !variant) {
      fetchParentProduct()
    }
  }, [open, variant, productId])

  // Reset form when dialog opens/closes or variant changes
  useEffect(() => {
    if (open) {
      if (variant) {
        // Edit mode: populate from existing variant
        try {
          const variantValues = JSON.parse(variant.variantValues)
          const attrs = Object.entries(variantValues).map(([key, value]) => ({
            key,
            value: String(value),
          }))
          setAttributes(attrs)
        } catch {
          setAttributes([])
        }

        const costPrice = variant.costPrice ? parseFloat(String(variant.costPrice)) : 0
        const salePrice = variant.salePrice ? parseFloat(String(variant.salePrice)) : 0
        const margin = costPrice > 0 ? ((salePrice - costPrice) / costPrice * 100) : 0

        setFormData({
          sku: variant.sku || "",
          barcode: variant.barcode || "",
          costPrice: variant.costPrice ? String(variant.costPrice) : "",
          salePrice: variant.salePrice ? String(variant.salePrice) : "",
          marginPercent: margin > 0 ? margin.toFixed(2) : "",
          weight: variant.weight || "",
          width: variant.width || "",
          height: variant.height || "",
          depth: variant.depth || "",
          isActive: variant.isActive !== false,
        })
      } else {
        // Create mode: preset from parent product
        setAttributes([{ key: "", value: "" }])

        if (parentProduct) {
          const costPrice = parentProduct.costPrice ? parseFloat(String(parentProduct.costPrice)) : 0
          const salePrice = parentProduct.salePrice ? parseFloat(String(parentProduct.salePrice)) : 0
          const margin = costPrice > 0 ? ((salePrice - costPrice) / costPrice * 100) : 0

          setFormData({
            sku: "",
            barcode: "",
            costPrice: parentProduct.costPrice ? String(parentProduct.costPrice) : "",
            salePrice: parentProduct.salePrice ? String(parentProduct.salePrice) : "",
            marginPercent: margin > 0 ? margin.toFixed(2) : "",
            weight: "0",
            width: "",
            height: "",
            depth: "",
            isActive: true,
          })
        } else {
          setFormData({
            sku: "",
            barcode: "",
            costPrice: "",
            salePrice: "",
            marginPercent: "",
            weight: "0",
            width: "",
            height: "",
            depth: "",
            isActive: true,
          })
        }
      }
    }
  }, [open, variant, parentProduct])

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: "", value: "" }])
  }

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index))
  }

  const handleAttributeChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...attributes]
    updated[index][field] = value
    setAttributes(updated)
  }

  // Price calculation helpers (similar to product-form)
  const handleCostPriceChange = (value: string) => {
    setFormData({ ...formData, costPrice: value })
    if (value && formData.marginPercent) {
      const cost = parseFloat(value)
      const margin = parseFloat(formData.marginPercent)
      if (!isNaN(cost) && !isNaN(margin) && cost > 0) {
        const salePrice = cost * (1 + margin / 100)
        setFormData({
          ...formData,
          costPrice: value,
          salePrice: salePrice.toFixed(2),
        })
      }
    }
  }

  const handleSalePriceChange = (value: string) => {
    setFormData({ ...formData, salePrice: value })
    if (value && formData.costPrice) {
      const cost = parseFloat(formData.costPrice)
      const sale = parseFloat(value)
      if (!isNaN(cost) && !isNaN(sale) && cost > 0) {
        const margin = ((sale - cost) / cost) * 100
        setFormData({
          ...formData,
          salePrice: value,
          marginPercent: margin.toFixed(2),
        })
      }
    }
  }

  const handleMarginChange = (value: string) => {
    setFormData({ ...formData, marginPercent: value })
    if (value && formData.costPrice) {
      const cost = parseFloat(formData.costPrice)
      const margin = parseFloat(value)
      if (!isNaN(cost) && !isNaN(margin) && cost > 0) {
        const salePrice = cost * (1 + margin / 100)
        setFormData({
          ...formData,
          marginPercent: value,
          salePrice: salePrice.toFixed(2),
        })
      }
    }
  }

  const applyMarginPreset = (margin: number) => {
    if (formData.costPrice) {
      const cost = parseFloat(formData.costPrice)
      if (!isNaN(cost) && cost > 0) {
        const salePrice = cost * (1 + margin / 100)
        setFormData({
          ...formData,
          marginPercent: margin.toFixed(2),
          salePrice: salePrice.toFixed(2),
        })
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate attributes
    const validAttributes = attributes.filter((attr) => attr.key && attr.value)
    if (validAttributes.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un atributo de variante",
        variant: "destructive",
      })
      return
    }

    // Check for duplicate attribute keys
    const keys = validAttributes.map((attr) => attr.key)
    if (new Set(keys).size !== keys.length) {
      toast({
        title: "Error",
        description: "No puede haber atributos duplicados",
        variant: "destructive",
      })
      return
    }

    // Validate prices
    if (!formData.costPrice || parseFloat(formData.costPrice) <= 0) {
      toast({
        title: "Error",
        description: "El precio de costo es requerido y debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    if (!formData.salePrice || parseFloat(formData.salePrice) <= 0) {
      toast({
        title: "Error",
        description: "El precio de venta es requerido y debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Build variant values object
      const variantValues: Record<string, string> = {}
      validAttributes.forEach((attr) => {
        variantValues[attr.key] = attr.value
      })

      const payload = {
        variantValues: JSON.stringify(variantValues),
        sku: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        costPrice: parseFloat(formData.costPrice),
        salePrice: parseFloat(formData.salePrice),
        weight: formData.weight || "0",
        width: formData.width || undefined,
        height: formData.height || undefined,
        depth: formData.depth || undefined,
        isActive: formData.isActive,
      }

      const url = variant
        ? `/api/products/${productId}/variants/${variant.id}`
        : `/api/products/${productId}/variants`
      const method = variant ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save variant")
      }

      toast({
        title: variant ? "Variante actualizada" : "Variante creada",
        description: variant
          ? "La variante se actualizó exitosamente"
          : "La variante se creó exitosamente",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar la variante",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {variant ? "Editar Variante" : "Crear Variante"}
          </DialogTitle>
          <DialogDescription>
            {variant
              ? "Modifica los datos de la variante del producto"
              : "Agrega una nueva variante del producto con atributos únicos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Attributes Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Atributos de Variante</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAttribute}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar Atributo
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {configuredAttributes.length > 0
                ? "Define los atributos que diferencian esta variante"
                : "No hay atributos configurados. Configura atributos de variantes en Configuración > Atributos Variantes para usar selectores predefinidos."
              }
            </p>

            {attributes.map((attr, index) => (
              <div key={index} className="flex gap-2">
                {configuredAttributes.length > 0 ? (
                  <Select
                    value={attr.key}
                    onValueChange={(value) => handleAttributeChange(index, "key", value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar atributo" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredAttributes.map((confAttr) => (
                        <SelectItem key={confAttr.id} value={confAttr.name}>
                          {confAttr.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Atributo (ej: color, talle)"
                    value={attr.key}
                    onChange={(e) =>
                      handleAttributeChange(index, "key", e.target.value)
                    }
                    disabled={isLoading}
                    className="flex-1"
                  />
                )}
                <Input
                  placeholder="Valor (ej: Rojo, L, 500g)"
                  value={attr.value}
                  onChange={(e) =>
                    handleAttributeChange(index, "value", e.target.value)
                  }
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveAttribute(index)}
                  disabled={isLoading || attributes.length === 1}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* SKU and Barcode */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                disabled={isLoading}
                placeholder={
                  productSku
                    ? `Auto: ${productSku}-VARIANT`
                    : "Auto-generado si se deja vacío"
                }
              />
              <p className="text-xs text-muted-foreground">
                Se genera automáticamente si se deja vacío
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
                disabled={isLoading}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Prices */}
          <div className="space-y-3">
            <Label className="text-base">Precios</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Precio de costo *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => handleCostPriceChange(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio de venta *</Label>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) => handleSalePriceChange(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginPercent">Margen %</Label>
                <Input
                  id="marginPercent"
                  type="number"
                  step="0.01"
                  value={formData.marginPercent}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  disabled={isLoading}
                  placeholder="0.00"
                  className={
                    formData.marginPercent && parseFloat(formData.marginPercent) > 0
                      ? "border-green-500 text-green-700"
                      : ""
                  }
                />
              </div>
            </div>
            {/* Quick margin presets */}
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyMarginPreset(5)}
                disabled={isLoading || !formData.costPrice}
                className="text-xs"
              >
                +5%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyMarginPreset(10)}
                disabled={isLoading || !formData.costPrice}
                className="text-xs"
              >
                +10%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyMarginPreset(50)}
                disabled={isLoading || !formData.costPrice}
                className="text-xs"
              >
                +50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyMarginPreset(100)}
                disabled={isLoading || !formData.costPrice}
                className="text-xs"
              >
                +100%
              </Button>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <Label className="text-base">Dimensiones (Opcional)</Label>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm">
                  Peso
                </Label>
                <Input
                  id="weight"
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: e.target.value })
                  }
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width" className="text-sm">
                  Ancho
                </Label>
                <Input
                  id="width"
                  value={formData.width}
                  onChange={(e) =>
                    setFormData({ ...formData, width: e.target.value })
                  }
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-sm">
                  Alto
                </Label>
                <Input
                  id="height"
                  value={formData.height}
                  onChange={(e) =>
                    setFormData({ ...formData, height: e.target.value })
                  }
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depth" className="text-sm">
                  Profundidad
                </Label>
                <Input
                  id="depth"
                  value={formData.depth}
                  onChange={(e) =>
                    setFormData({ ...formData, depth: e.target.value })
                  }
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked === true })
              }
              disabled={isLoading}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Activo
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Guardando..."
                : variant
                ? "Actualizar Variante"
                : "Crear Variante"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
