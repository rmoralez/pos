"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, FolderPlus, Edit, Trash2, Folder } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface Category {
  id: string
  name: string
  description: string | null
  parentId: string | null
  children?: Category[]
  _count?: {
    products: number
  }
}

interface CategoryTreeProps {
  categories: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onAddChild: (parent: Category) => void
}

export function CategoryTree({ categories, onEdit, onDelete, onAddChild }: CategoryTreeProps) {
  return (
    <div className="space-y-1">
      {categories.map((category) => (
        <CategoryNode
          key={category.id}
          category={category}
          level={0}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
      {categories.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay categorías creadas</p>
          <p className="text-sm mt-1">Haz clic en &ldquo;Nueva Categoría&rdquo; para comenzar</p>
        </div>
      )}
    </div>
  )
}

interface CategoryNodeProps {
  category: Category
  level: number
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onAddChild: (parent: Category) => void
}

function CategoryNode({ category, level, onEdit, onDelete, onAddChild }: CategoryNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0)
  const hasChildren = category.children && category.children.length > 0
  const productCount = category._count?.products ?? 0

  return (
    <div>
      <div
        className="flex items-center gap-2 p-3 rounded-md hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {/* Expand/collapse button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
        </Button>

        {/* Category icon */}
        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        {/* Category info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{category.name}</span>
            {productCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {productCount} {productCount === 1 ? "producto" : "productos"}
              </Badge>
            )}
            {hasChildren && (
              <Badge variant="outline" className="text-xs">
                {category.children!.length} {category.children!.length === 1 ? "subcategoría" : "subcategorías"}
              </Badge>
            )}
          </div>
          {category.description && (
            <p className="text-sm text-muted-foreground truncate">{category.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAddChild(category)}
            title="Agregar subcategoría"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(category)}
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(category)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {category.children!.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}
