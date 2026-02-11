"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface MovementType {
  id: string
  name: string
  description: string | null
  transactionType: "INCOME" | "EXPENSE"
  isActive: boolean
  _count: {
    transactions: number
  }
}

export function MovementTypesTab() {
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingType, setEditingType] = useState<MovementType | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    transactionType: "INCOME" as "INCOME" | "EXPENSE",
    isActive: true,
  })

  const fetchMovementTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/movement-types")
      if (!response.ok) throw new Error("Failed to fetch movement types")
      const data = await response.json()
      setMovementTypes(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los tipos de movimiento",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMovementTypes()
  }, [fetchMovementTypes])

  const handleOpenDialog = (type?: MovementType) => {
    if (type) {
      setEditingType(type)
      setFormData({
        name: type.name,
        description: type.description || "",
        transactionType: type.transactionType,
        isActive: type.isActive,
      })
    } else {
      setEditingType(null)
      setFormData({
        name: "",
        description: "",
        transactionType: "INCOME",
        isActive: true,
      })
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast({
        title: "Error",
        description: "El nombre es obligatorio",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingType
        ? `/api/movement-types/${editingType.id}`
        : "/api/movement-types"
      const method = editingType ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save movement type")
      }

      toast({
        title: editingType ? "Tipo actualizado" : "Tipo creado",
        description: `El tipo de movimiento ha sido ${editingType ? "actualizado" : "creado"} exitosamente`,
      })

      setShowDialog(false)
      fetchMovementTypes()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el tipo de movimiento",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, name: string, transactionCount: number) => {
    if (transactionCount > 0) {
      toast({
        title: "No se puede eliminar",
        description: `El tipo de movimiento "${name}" tiene ${transactionCount} transacciones asociadas`,
        variant: "destructive",
      })
      return
    }

    if (!confirm(`¿Estás seguro de eliminar el tipo de movimiento "${name}"?`)) return

    try {
      const response = await fetch(`/api/movement-types/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete movement type")
      }

      toast({
        title: "Tipo eliminado",
        description: "El tipo de movimiento ha sido eliminado exitosamente",
      })

      fetchMovementTypes()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el tipo de movimiento",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando tipos de movimiento...</p>
      </div>
    )
  }

  const incomeTypes = movementTypes.filter(t => t.transactionType === "INCOME")
  const expenseTypes = movementTypes.filter(t => t.transactionType === "EXPENSE")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tipos de Ingreso</CardTitle>
            <CardDescription>
              Categorías para registrar ingresos de efectivo
            </CardDescription>
          </div>
          <Button onClick={() => {
            setFormData({ ...formData, transactionType: "INCOME" })
            handleOpenDialog()
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Ingreso
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Transacciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay tipos de ingreso configurados
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="h-4 w-4 text-green-600" />
                          {type.name}
                        </div>
                      </TableCell>
                      <TableCell>{type.description || "-"}</TableCell>
                      <TableCell>{type._count.transactions}</TableCell>
                      <TableCell>
                        <Badge variant={type.isActive ? "default" : "secondary"}>
                          {type.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(type.id, type.name, type._count.transactions)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tipos de Egreso</CardTitle>
            <CardDescription>
              Categorías para registrar egresos de efectivo
            </CardDescription>
          </div>
          <Button onClick={() => {
            setFormData({ ...formData, transactionType: "EXPENSE" })
            handleOpenDialog()
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Egreso
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Transacciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay tipos de egreso configurados
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="h-4 w-4 text-red-600" />
                          {type.name}
                        </div>
                      </TableCell>
                      <TableCell>{type.description || "-"}</TableCell>
                      <TableCell>{type._count.transactions}</TableCell>
                      <TableCell>
                        <Badge variant={type.isActive ? "default" : "secondary"}>
                          {type.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(type.id, type.name, type._count.transactions)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Editar Tipo de Movimiento" : "Nuevo Tipo de Movimiento"}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? "Actualiza la información del tipo de movimiento"
                : "Completa los datos para crear un nuevo tipo de movimiento"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Venta de productos usados"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transactionType">Tipo de Transacción *</Label>
              <Select
                value={formData.transactionType}
                onValueChange={(value: "INCOME" | "EXPENSE") =>
                  setFormData({ ...formData, transactionType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-green-600" />
                      Ingreso
                    </div>
                  </SelectItem>
                  <SelectItem value="EXPENSE">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-red-600" />
                      Egreso
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive">Tipo activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingType ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
