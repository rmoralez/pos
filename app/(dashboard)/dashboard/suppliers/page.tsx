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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Pencil, Trash2, Truck, Mail, Phone, FileText, Eye } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  cuit: string | null
  address: string | null
  isActive: boolean
  SupplierAccount: {
    balance: number
    isActive: boolean
  } | null
  _count: {
    PurchaseOrder: number
    SupplierInvoice: number
  }
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cuit: "",
    address: "",
  })
  const [validationErrors, setValidationErrors] = useState<{
    name?: string
  }>({})

  const fetchSuppliers = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (search) params.append("search", search)

      const response = await fetch(`/api/suppliers?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch suppliers")

      const data = await response.json()
      setSuppliers(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los proveedores",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchSuppliers()
  }

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        email: supplier.email || "",
        phone: supplier.phone || "",
        cuit: supplier.cuit || "",
        address: supplier.address || "",
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: "",
        email: "",
        phone: "",
        cuit: "",
        address: "",
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingSupplier(null)
    setFormData({
      name: "",
      email: "",
      phone: "",
      cuit: "",
      address: "",
    })
    setValidationErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous validation errors
    setValidationErrors({})

    // Validate required fields
    if (!formData.name || formData.name.trim() === "") {
      setValidationErrors({
        name: "El nombre es obligatorio"
      })
      return
    }

    try {
      const url = editingSupplier
        ? `/api/suppliers/${editingSupplier.id}`
        : "/api/suppliers"
      const method = editingSupplier ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save supplier")
      }

      toast({
        title: editingSupplier ? "Proveedor actualizado" : "Proveedor creado",
        description: `El proveedor ha sido ${editingSupplier ? "actualizado" : "creado"} exitosamente`,
      })

      handleCloseDialog()
      fetchSuppliers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el proveedor",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, name: string, purchaseOrderCount: number, invoiceCount: number) => {
    if (purchaseOrderCount > 0 || invoiceCount > 0) {
      toast({
        title: "No se puede eliminar",
        description: `El proveedor ${name} tiene ${purchaseOrderCount} órdenes de compra y ${invoiceCount} facturas asociadas`,
        variant: "destructive",
      })
      return
    }

    if (!confirm(`¿Estás seguro de desactivar al proveedor ${name}?`)) return

    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete supplier")
      }

      toast({
        title: "Proveedor desactivado",
        description: "El proveedor ha sido desactivado exitosamente",
      })

      fetchSuppliers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo desactivar el proveedor",
        variant: "destructive",
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground">
            Gestiona los proveedores de tu negocio
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Proveedores</CardTitle>
          <CardDescription>
            Busca y gestiona todos los proveedores registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email, teléfono o CUIT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit">Buscar</Button>
            </div>
          </form>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cargando proveedores...</p>
              </div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No hay proveedores registrados</p>
                <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer proveedor
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Saldo Cuenta</TableHead>
                    <TableHead className="text-center">OC / Facturas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">
                        {supplier.name}
                      </TableCell>
                      <TableCell>
                        {supplier.cuit ? (
                          <span className="text-sm font-mono">{supplier.cuit}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{supplier.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{supplier.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {supplier.SupplierAccount ? (
                          <span
                            className={cn(
                              "font-medium",
                              supplier.SupplierAccount.balance > 0
                                ? "text-red-600"
                                : supplier.SupplierAccount.balance < 0
                                ? "text-green-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatCurrency(supplier.SupplierAccount.balance)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant="outline">
                            {supplier._count.PurchaseOrder}
                          </Badge>
                          <span className="text-muted-foreground">/</span>
                          <Badge variant="outline">
                            {supplier._count.SupplierInvoice}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="Ver detalles"
                          >
                            <Link href={`/dashboard/suppliers/${supplier.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(supplier)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDelete(
                                supplier.id,
                                supplier.name,
                                supplier._count.PurchaseOrder,
                                supplier._count.SupplierInvoice
                              )
                            }
                            disabled={supplier._count.PurchaseOrder > 0 || supplier._count.SupplierInvoice > 0}
                            title="Desactivar"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Supplier Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? "Actualiza la información del proveedor"
                : "Completa los datos para crear un nuevo proveedor"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Nombre del proveedor"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (validationErrors.name) {
                      setValidationErrors({})
                    }
                  }}
                />
                {validationErrors.name && (
                  <p className="text-sm text-destructive">
                    {validationErrors.name}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  placeholder="20-12345678-9"
                  value={formData.cuit}
                  onChange={(e) =>
                    setFormData({ ...formData, cuit: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="proveedor@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  placeholder="+54 11 1234-5678"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  placeholder="Calle, número, ciudad"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingSupplier ? "Actualizar" : "Crear"} Proveedor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
