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

interface VariantAttribute {
  key: string
  value: string
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
  const [formData, setFormData] = useState({
    sku: "",
    barcode: "",
    costPrice: "",
    salePrice: "",
    weight: "",
    width: "",
    height: "",
    depth: "",
    isActive: true,
  })

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

        setFormData({
          sku: variant.sku || "",
          barcode: variant.barcode || "",
          costPrice: variant.costPrice ? String(variant.costPrice) : "",
          salePrice: variant.salePrice ? String(variant.salePrice) : "",
          weight: variant.weight || "",
          width: variant.width || "",
          height: variant.height || "",
          depth: variant.depth || "",
          isActive: variant.isActive !== false,
        })
      } else {
        // Create mode: reset form
        setAttributes([{ key: "", value: "" }])
        setFormData({
          sku: "",
          barcode: "",
          costPrice: "",
          salePrice: "",
          weight: "0",
          width: "",
          height: "",
          depth: "",
          isActive: true,
        })
      }
    }
  }, [open, variant])

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
              Define los atributos que diferencian esta variante (ej: Talle, Color, Material)
            </p>

            {attributes.map((attr, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Atributo (ej: Talle)"
                  value={attr.key}
                  onChange={(e) =>
                    handleAttributeChange(index, "key", e.target.value)
                  }
                  disabled={isLoading}
                  className="flex-1"
                />
                <Input
                  placeholder="Valor (ej: L)"
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Precio de costo *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, salePrice: e.target.value })
                }
                disabled={isLoading}
                placeholder="0.00"
                required
              />
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
