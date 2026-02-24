"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, Package, Ruler } from "lucide-react"
import { VariantDialog } from "./variant-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"

interface ProductVariantsManagerProps {
  productId: string
  productSku?: string
}

interface Variant {
  id: string
  sku: string
  barcode: string | null
  variantValues: string
  costPrice: string
  salePrice: string
  weight: string | null
  width: string | null
  height: string | null
  depth: string | null
  isActive: boolean
  stockByLocation?: Array<{
    locationId: string
    locationName: string
    quantity: number
  }>
  totalStock?: number
}

export function ProductVariantsManager({
  productId,
  productSku,
}: ProductVariantsManagerProps) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState<Variant | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDimensions, setShowDimensions] = useState(false)

  useEffect(() => {
    loadVariants()
  }, [productId])

  const loadVariants = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/variants`)
      if (!response.ok) {
        throw new Error("Failed to load variants")
      }
      const data = await response.json()
      setVariants(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar las variantes",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddVariant = () => {
    setSelectedVariant(null)
    setDialogOpen(true)
  }

  const handleEditVariant = (variant: Variant) => {
    setSelectedVariant(variant)
    setDialogOpen(true)
  }

  const handleDeleteClick = (variant: Variant) => {
    setVariantToDelete(variant)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!variantToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/products/${productId}/variants/${variantToDelete.id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete variant")
      }

      toast({
        title: "Variante eliminada",
        description: "La variante se eliminó exitosamente",
      })

      loadVariants()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la variante",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setVariantToDelete(null)
    }
  }

  const parseVariantValues = (variantValues: string): Record<string, string> => {
    try {
      return JSON.parse(variantValues)
    } catch {
      return {}
    }
  }

  const formatVariantName = (variantValues: string): string => {
    const attrs = parseVariantValues(variantValues)
    return Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ")
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Variantes del Producto</CardTitle>
          <CardDescription>Cargando variantes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Variantes del Producto</CardTitle>
              <CardDescription>
                Gestiona las diferentes variantes de este producto (ej: talles, colores, materiales)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDimensions(!showDimensions)}
              >
                <Ruler className="h-4 w-4 mr-2" />
                {showDimensions ? "Ocultar" : "Mostrar"} Dimensiones
              </Button>
              <Button onClick={handleAddVariant}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Variante
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No hay variantes creadas
              </h3>
              <p className="text-muted-foreground mb-4">
                Las variantes permiten vender diferentes versiones de un mismo producto
                con precios y stock separados.
              </p>
              <Button onClick={handleAddVariant}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Variante
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Atributos</TableHead>
                    <TableHead className="text-right">Precio Costo</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    {showDimensions && <TableHead>Dimensiones</TableHead>}
                    <TableHead className="text-right">Stock Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell className="font-mono text-sm">
                        {variant.sku}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(parseVariantValues(variant.variantValues)).map(
                            ([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}: {value}
                              </Badge>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(variant.costPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(variant.salePrice).toFixed(2)}
                      </TableCell>
                      {showDimensions && (
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {variant.weight && variant.weight !== "0" && (
                              <div>Peso: {variant.weight}</div>
                            )}
                            {variant.width && (
                              <div>Ancho: {variant.width} cm</div>
                            )}
                            {variant.height && (
                              <div>Alto: {variant.height} cm</div>
                            )}
                            {variant.depth && (
                              <div>Prof.: {variant.depth} cm</div>
                            )}
                            {(!variant.weight || variant.weight === "0") &&
                              !variant.width &&
                              !variant.height &&
                              !variant.depth && (
                                <span className="text-muted-foreground italic">
                                  Sin dimensiones
                                </span>
                              )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="font-semibold">
                            {variant.totalStock ?? 0}
                          </div>
                          {variant.stockByLocation && variant.stockByLocation.length > 0 && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {variant.stockByLocation.map((stock) => (
                                <div key={stock.locationId}>
                                  {stock.locationName}: {stock.quantity}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant.isActive ? "default" : "secondary"}>
                          {variant.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditVariant(variant)}
                            title="Editar variante"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(variant)}
                            title="Eliminar variante"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {variants.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Total de variantes: {variants.length}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variant Dialog */}
      <VariantDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setSelectedVariant(null)
        }}
        productId={productId}
        productSku={productSku}
        variant={selectedVariant}
        onSuccess={loadVariants}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea eliminar la variante &quot;{variantToDelete && formatVariantName(variantToDelete.variantValues)}&quot;?
              <br />
              <br />
              <strong>Nota:</strong> Solo se pueden eliminar variantes sin movimientos de stock ni ventas asociadas.
              Si la variante tiene historial, considere desactivarla en lugar de eliminarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
