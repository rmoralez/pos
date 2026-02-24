"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2 } from "lucide-react"
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

interface VariantAttribute {
  id: string
  name: string
  displayName: string
  sortOrder: number
  isActive: boolean
}

export function VariantAttributesTab() {
  const [attributes, setAttributes] = useState<VariantAttribute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAttribute, setSelectedAttribute] = useState<VariantAttribute | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<VariantAttribute | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    sortOrder: 0,
  })

  useEffect(() => {
    fetchAttributes()
  }, [])

  const fetchAttributes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/variant-attributes")
      if (response.ok) {
        const data = await response.json()
        setAttributes(data)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los atributos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (attribute?: VariantAttribute) => {
    if (attribute) {
      setSelectedAttribute(attribute)
      setFormData({
        name: attribute.name,
        displayName: attribute.displayName,
        sortOrder: attribute.sortOrder,
      })
    } else {
      setSelectedAttribute(null)
      setFormData({
        name: "",
        displayName: "",
        sortOrder: attributes.length,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedAttribute(null)
    setFormData({ name: "", displayName: "", sortOrder: 0 })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = selectedAttribute
        ? `/api/variant-attributes/${selectedAttribute.id}`
        : "/api/variant-attributes"
      const method = selectedAttribute ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al guardar atributo")
      }

      toast({
        title: selectedAttribute ? "Atributo actualizado" : "Atributo creado",
        description: selectedAttribute
          ? "El atributo se actualizó exitosamente"
          : "El atributo se creó exitosamente",
      })

      fetchAttributes()
      handleCloseDialog()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error",
        variant: "destructive",
      })
    }
  }

  const handleDeleteClick = (attribute: VariantAttribute) => {
    setAttributeToDelete(attribute)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!attributeToDelete) return

    try {
      const response = await fetch(`/api/variant-attributes/${attributeToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al eliminar atributo")
      }

      toast({
        title: "Atributo eliminado",
        description: "El atributo se eliminó exitosamente",
      })

      fetchAttributes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setAttributeToDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Atributos de Variantes</h3>
            <p className="text-sm text-muted-foreground">
              Configura los atributos que se pueden usar en las variantes de productos (ej: color, talle, presentación)
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Atributo
          </Button>
        </div>

        {attributes.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground mb-4">
              No hay atributos de variantes configurados
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Atributo
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre (Clave)</TableHead>
                  <TableHead>Nombre para Mostrar</TableHead>
                  <TableHead className="text-right">Orden</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attributes.map((attribute) => (
                  <TableRow key={attribute.id}>
                    <TableCell className="font-mono text-sm">{attribute.name}</TableCell>
                    <TableCell className="font-medium">{attribute.displayName}</TableCell>
                    <TableCell className="text-right">{attribute.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(attribute)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(attribute)}
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAttribute ? "Editar Atributo" : "Nuevo Atributo"}
            </DialogTitle>
            <DialogDescription>
              {selectedAttribute
                ? "Modifica los datos del atributo"
                : "Crea un nuevo atributo para usar en variantes de productos"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre (Clave) *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="color, talle, presentacion"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Nombre técnico del atributo (sin espacios, en minúsculas)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">
                Nombre para Mostrar *
              </Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Color, Talle, Presentación"
                required
              />
              <p className="text-xs text-muted-foreground">
                Nombre que se mostrará en los formularios
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">
                Orden
              </Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Orden en que aparecerá en los formularios (menor primero)
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {selectedAttribute ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea eliminar el atributo &quot;{attributeToDelete?.displayName}&quot;?
              <br />
              <br />
              <strong>Nota:</strong> Los productos con variantes que usen este atributo seguirán
              funcionando, pero no podrás crear nuevas variantes con este atributo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
