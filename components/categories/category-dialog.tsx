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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import type { Category } from "./category-tree"

interface CategoryDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  category?: Category | null
  parentId?: string | null
  allCategories: Category[]
}

export function CategoryDialog({
  open,
  onClose,
  onSuccess,
  category,
  parentId,
  allCategories,
}: CategoryDialogProps) {
  const isEditing = !!category
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (category) {
        // Editing existing category
        setName(category.name)
        setDescription(category.description || "")
        setSelectedParentId(category.parentId)
      } else if (parentId) {
        // Adding child to specific parent
        setName("")
        setDescription("")
        setSelectedParentId(parentId)
      } else {
        // Adding new root category
        setName("")
        setDescription("")
        setSelectedParentId(null)
      }
    }
  }, [open, category, parentId])

  // Build flat list of categories, excluding current category and its descendants
  const getFlatCategories = (cats: Category[], excludeId?: string): Category[] => {
    const flat: Category[] = []

    const traverse = (categories: Category[]) => {
      for (const cat of categories) {
        // Skip the category being edited and its descendants
        if (excludeId && cat.id === excludeId) continue

        flat.push(cat)

        if (cat.children && cat.children.length > 0) {
          traverse(cat.children)
        }
      }
    }

    traverse(cats)
    return flat
  }

  const availableParents = getFlatCategories(allCategories, category?.id)

  // Build display path for category
  const getCategoryPath = (categoryId: string): string => {
    const findPath = (cats: Category[], targetId: string, path: string[] = []): string[] | null => {
      for (const cat of cats) {
        const currentPath = [...path, cat.name]
        if (cat.id === targetId) {
          return currentPath
        }
        if (cat.children && cat.children.length > 0) {
          const found = findPath(cat.children, targetId, currentPath)
          if (found) return found
        }
      }
      return null
    }

    const path = findPath(allCategories, categoryId)
    return path ? path.join(" > ") : ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la categoría es requerido",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const url = isEditing ? `/api/categories/${category.id}` : "/api/categories"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          parentId: selectedParentId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save category")
      }

      toast({
        title: isEditing ? "Categoría actualizada" : "Categoría creada",
        description: isEditing
          ? "La categoría se actualizó exitosamente"
          : "La categoría se creó exitosamente",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la categoría",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Categoría" : "Nueva Categoría"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos de la categoría"
              : "Crea una nueva categoría para organizar tus productos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Electrónica"
                required
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="parent">Categoría Padre (Opcional)</Label>
              <Select
                value={selectedParentId || "none"}
                onValueChange={(value) => setSelectedParentId(value === "none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoría raíz (sin padre)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Categoría raíz (sin padre)</SelectItem>
                  {availableParents.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {getCategoryPath(cat.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecciona una categoría padre para crear una subcategoría
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
