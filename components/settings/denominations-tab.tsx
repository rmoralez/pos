"use client"

import { useEffect, useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, DollarSign, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Denomination {
  id: string
  value: number
  label: string
  sortOrder: number
  isActive: boolean
}

export function DenominationsTab() {
  const [denominations, setDenominations] = useState<Denomination[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingDenomination, setEditingDenomination] = useState<Denomination | null>(null)
  const [formData, setFormData] = useState({
    value: "",
    label: "",
  })

  const fetchDenominations = async () => {
    try {
      const response = await fetch("/api/denominations")
      if (!response.ok) throw new Error("Error al cargar denominaciones")
      const data = await response.json()
      setDenominations(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDenominations()
  }, [])

  const handleSeedDefaults = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/denominations/seed", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al inicializar denominaciones")
      }

      toast({
        title: "Denominaciones creadas",
        description: "Las denominaciones predeterminadas han sido creadas exitosamente",
      })

      fetchDenominations()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (denomination?: Denomination) => {
    if (denomination) {
      setEditingDenomination(denomination)
      setFormData({
        value: denomination.value.toString(),
        label: denomination.label,
      })
    } else {
      setEditingDenomination(null)
      setFormData({ value: "", label: "" })
    }
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = editingDenomination
        ? `/api/denominations/${editingDenomination.id}`
        : "/api/denominations"

      const response = await fetch(url, {
        method: editingDenomination ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al guardar denominación")
      }

      toast({
        title: editingDenomination ? "Denominación actualizada" : "Denominación creada",
        description: `La denominación ha sido ${editingDenomination ? "actualizada" : "creada"} exitosamente`,
      })

      setShowDialog(false)
      fetchDenominations()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta denominación?")) return

    try {
      setLoading(true)
      const response = await fetch(`/api/denominations/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al eliminar denominación")
      }

      toast({
        title: "Denominación eliminada",
        description: "La denominación ha sido eliminada exitosamente",
      })

      fetchDenominations()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReorder = async (denomination: Denomination, direction: "up" | "down") => {
    const currentIndex = denominations.findIndex((d) => d.id === denomination.id)
    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === denominations.length - 1)
    ) {
      return
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    const targetDenomination = denominations[targetIndex]

    try {
      setLoading(true)

      // Swap sort orders
      await fetch(`/api/denominations/${denomination.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: targetDenomination.sortOrder }),
      })

      await fetch(`/api/denominations/${targetDenomination.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: denomination.sortOrder }),
      })

      fetchDenominations()
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error al reordenar denominaciones",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getDenominationType = (value: number) => {
    if (value >= 200) return { label: "Billete grande", color: "bg-blue-100 text-blue-700" }
    if (value >= 10) return { label: "Billete", color: "bg-green-100 text-green-700" }
    return { label: "Moneda", color: "bg-amber-100 text-amber-700" }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Denominaciones de Efectivo
            </CardTitle>
            <CardDescription>
              Configura las denominaciones de billetes y monedas que se usarán en el contador
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {denominations.length === 0 && (
              <Button onClick={handleSeedDefaults} disabled={loading} variant="outline">
                Cargar Predeterminadas
              </Button>
            )}
            <Button onClick={() => handleOpenDialog()} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Denominación
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {denominations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay denominaciones configuradas.</p>
            <p className="text-sm mt-2">
              Puedes cargar las denominaciones predeterminadas o crear las tuyas propias.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Orden</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {denominations.map((denomination, index) => {
                const type = getDenominationType(Number(denomination.value))
                return (
                  <TableRow key={denomination.id}>
                    <TableCell className="font-semibold">
                      ${denomination.value.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>{denomination.label}</TableCell>
                    <TableCell>
                      <Badge className={type.color}>{type.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReorder(denomination, "up")}
                          disabled={index === 0 || loading}
                          className="h-6 w-6"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReorder(denomination, "down")}
                          disabled={index === denominations.length - 1 || loading}
                          className="h-6 w-6"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(denomination)}
                          disabled={loading}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(denomination.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDenomination ? "Editar" : "Nueva"} Denominación
            </DialogTitle>
            <DialogDescription>
              {editingDenomination
                ? "Modifica los datos de la denominación"
                : "Ingresa los datos de la nueva denominación"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor *</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1000"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Valor numérico de la denominación (ej: 1000, 0.50)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Etiqueta *</Label>
                <Input
                  id="label"
                  placeholder="$1.000"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Texto a mostrar (ej: $1.000, $0,50)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
