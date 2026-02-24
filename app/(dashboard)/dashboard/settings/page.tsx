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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Settings as SettingsIcon,
  Building2,
  MapPin,
  Users,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Save,
  Shield,
  ArrowRightLeft,
  CreditCard,
  Folder,
  DollarSign,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MovementTypesTab } from "@/components/settings/movement-types-tab"
import { PaymentMethodAccountsTab } from "@/components/settings/payment-method-accounts-tab"
import { DenominationsTab } from "@/components/settings/denominations-tab"
import { CategoryTree, type Category } from "@/components/categories/category-tree"
import { CategoryDialog } from "@/components/categories/category-dialog"

interface Tenant {
  id: string
  name: string
  cuit: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  province: string | null
  zipCode: string | null
  defaultTaxRate: number | null
  afipPuntoVenta: number | null
  _count: {
    users: number
    locations: number
    products: number
    sales: number
  }
}

interface Location {
  id: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  _count: {
    users: number
    stock: number
    sales: number
    cashRegisters: number
  }
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  locationId: string | null
  location: {
    id: string
    name: string
  } | null
  _count: {
    sales: number
    cashRegisters: number
  }
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  STOCK_MANAGER: "Encargado de Stock",
  VIEWER: "Consulta",
}

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Tenant form
  const [tenantForm, setTenantForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    zipCode: "",
    defaultTaxRate: "21",
    afipPuntoVenta: "",
  })

  // Location dialog
  const [showLocationDialog, setShowLocationDialog] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [locationForm, setLocationForm] = useState({
    name: "",
    address: "",
    phone: "",
    isActive: true,
  })

  // User dialog
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CASHIER",
    locationId: "",
    isActive: true,
  })

  // Category dialog
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null)

  const fetchTenant = useCallback(async () => {
    try {
      const response = await fetch("/api/tenants/current")
      if (!response.ok) throw new Error("Failed to fetch tenant")
      const data = await response.json()
      setTenant(data)
      setTenantForm({
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        province: data.province || "",
        zipCode: data.zipCode || "",
        defaultTaxRate: data.defaultTaxRate?.toString() ?? "21",
        afipPuntoVenta: data.afipPuntoVenta?.toString() || "",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar la información del comercio",
        variant: "destructive",
      })
    }
  }, [])

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/locations")
      if (!response.ok) throw new Error("Failed to fetch locations")
      const data = await response.json()
      setLocations(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las ubicaciones",
        variant: "destructive",
      })
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories")
      if (!response.ok) throw new Error("Failed to fetch categories")
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las categorías",
        variant: "destructive",
      })
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchTenant(), fetchLocations(), fetchUsers(), fetchCategories()])
      setIsLoading(false)
    }
    loadData()
  }, [fetchTenant, fetchLocations, fetchUsers, fetchCategories])

  const handleSaveTenant = async () => {
    try {
      const response = await fetch("/api/tenants/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...tenantForm,
          afipPuntoVenta: tenantForm.afipPuntoVenta
            ? parseInt(tenantForm.afipPuntoVenta)
            : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update tenant")
      }

      toast({
        title: "Configuración actualizada",
        description: "La información del comercio ha sido actualizada",
      })

      fetchTenant()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar la información",
        variant: "destructive",
      })
    }
  }

  const handleOpenLocationDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location)
      setLocationForm({
        name: location.name,
        address: location.address || "",
        phone: location.phone || "",
        isActive: location.isActive,
      })
    } else {
      setEditingLocation(null)
      setLocationForm({ name: "", address: "", phone: "", isActive: true })
    }
    setShowLocationDialog(true)
  }

  const handleSaveLocation = async () => {
    if (!locationForm.name) {
      toast({
        title: "Error",
        description: "El nombre es obligatorio",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingLocation
        ? `/api/locations/${editingLocation.id}`
        : "/api/locations"
      const method = editingLocation ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locationForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save location")
      }

      toast({
        title: editingLocation ? "Ubicación actualizada" : "Ubicación creada",
        description: `La ubicación ha sido ${editingLocation ? "actualizada" : "creada"} exitosamente`,
      })

      setShowLocationDialog(false)
      fetchLocations()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar la ubicación",
        variant: "destructive",
      })
    }
  }

  const handleDeleteLocation = async (id: string, name: string, counts: any) => {
    if (counts.users > 0 || counts.stock > 0 || counts.sales > 0 || counts.cashRegisters > 0) {
      toast({
        title: "No se puede eliminar",
        description: `La ubicación ${name} tiene datos asociados`,
        variant: "destructive",
      })
      return
    }

    if (!confirm(`¿Estás seguro de eliminar la ubicación ${name}?`)) return

    try {
      const response = await fetch(`/api/locations/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete location")
      }

      toast({
        title: "Ubicación eliminada",
        description: "La ubicación ha sido eliminada exitosamente",
      })

      fetchLocations()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar la ubicación",
        variant: "destructive",
      })
    }
  }

  const handleOpenUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setUserForm({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
        locationId: user.locationId || "",
        isActive: user.isActive,
      })
    } else {
      setEditingUser(null)
      setUserForm({
        name: "",
        email: "",
        password: "",
        role: "CASHIER",
        locationId: "",
        isActive: true,
      })
    }
    setShowUserDialog(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.email) {
      toast({
        title: "Error",
        description: "Nombre y email son obligatorios",
        variant: "destructive",
      })
      return
    }

    if (!editingUser && !userForm.password) {
      toast({
        title: "Error",
        description: "La contraseña es obligatoria para nuevos usuarios",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users"
      const method = editingUser ? "PUT" : "POST"

      const body: any = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        locationId: userForm.locationId || null,
        isActive: userForm.isActive,
      }

      if (userForm.password) {
        body.password = userForm.password
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save user")
      }

      toast({
        title: editingUser ? "Usuario actualizado" : "Usuario creado",
        description: `El usuario ha sido ${editingUser ? "actualizado" : "creado"} exitosamente`,
      })

      setShowUserDialog(false)
      fetchUsers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (id: string, name: string, counts: any) => {
    if (counts.sales > 0 || counts.cashRegisters > 0) {
      toast({
        title: "No se puede eliminar",
        description: `El usuario ${name} tiene datos asociados`,
        variant: "destructive",
      })
      return
    }

    if (!confirm(`¿Estás seguro de eliminar al usuario ${name}?`)) return

    try {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete user")
      }

      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente",
      })

      fetchUsers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el usuario",
        variant: "destructive",
      })
    }
  }

  // Category handlers
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryParentId(null)
    setShowCategoryDialog(true)
  }

  const handleAddChildCategory = (parent: Category) => {
    setEditingCategory(null)
    setCategoryParentId(parent.id)
    setShowCategoryDialog(true)
  }

  const handleAddRootCategory = () => {
    setEditingCategory(null)
    setCategoryParentId(null)
    setShowCategoryDialog(true)
  }

  const handleDeleteCategory = async (category: Category) => {
    if (category._count && category._count.products > 0) {
      toast({
        title: "No se puede eliminar",
        description: `La categoría ${category.name} tiene productos asignados`,
        variant: "destructive",
      })
      return
    }

    if (category.children && category.children.length > 0) {
      toast({
        title: "No se puede eliminar",
        description: `La categoría ${category.name} tiene subcategorías`,
        variant: "destructive",
      })
      return
    }

    if (!confirm(`¿Estás seguro de eliminar la categoría ${category.name}?`)) return

    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete category")
      }

      toast({
        title: "Categoría eliminada",
        description: "La categoría ha sido eliminada exitosamente",
      })

      fetchCategories()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar la categoría",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Gestiona la configuración del sistema y la información del negocio
        </p>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList>
          <TabsTrigger value="business">
            <Building2 className="mr-2 h-4 w-4" />
            Negocio
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="mr-2 h-4 w-4" />
            Ubicaciones
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="movement-types">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Tipos de Movimiento
          </TabsTrigger>
          <TabsTrigger value="payment-methods">
            <CreditCard className="mr-2 h-4 w-4" />
            Métodos de Pago
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Folder className="mr-2 h-4 w-4" />
            Categorías
          </TabsTrigger>
          <TabsTrigger value="denominations">
            <DollarSign className="mr-2 h-4 w-4" />
            Denominaciones
          </TabsTrigger>
          <TabsTrigger value="afip">
            <FileText className="mr-2 h-4 w-4" />
            AFIP
          </TabsTrigger>
        </TabsList>

        {/* Business Information Tab */}
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Negocio</CardTitle>
              <CardDescription>
                Datos generales de tu comercio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Comercio</Label>
                  <Input
                    id="name"
                    value={tenantForm.name}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuit">CUIT</Label>
                  <Input id="cuit" value={tenant?.cuit} disabled />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={tenantForm.email}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={tenantForm.phone}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={tenantForm.address}
                  onChange={(e) =>
                    setTenantForm({ ...tenantForm, address: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={tenantForm.city}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, city: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Provincia</Label>
                  <Input
                    id="province"
                    value={tenantForm.province}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, province: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Código Postal</Label>
                  <Input
                    id="zipCode"
                    value={tenantForm.zipCode}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, zipCode: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Tax Configuration */}
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold mb-3">Configuración Impositiva</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultTaxRate">IVA por defecto (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="defaultTaxRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={tenantForm.defaultTaxRate}
                        onChange={(e) =>
                          setTenantForm({ ...tenantForm, defaultTaxRate: e.target.value })
                        }
                        className="w-32"
                        placeholder="21"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tasa de IVA aplicada por defecto a nuevos productos (ej: 21, 10.5, 0)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTenant}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>

              {tenant && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Estadísticas</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{tenant._count.users}</p>
                      <p className="text-sm text-muted-foreground">Usuarios</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{tenant._count.locations}</p>
                      <p className="text-sm text-muted-foreground">Ubicaciones</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{tenant._count.products}</p>
                      <p className="text-sm text-muted-foreground">Productos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{tenant._count.sales}</p>
                      <p className="text-sm text-muted-foreground">Ventas</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ubicaciones</CardTitle>
                <CardDescription>
                  Gestiona las sucursales y puntos de venta
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenLocationDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Ubicación
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.name}</TableCell>
                        <TableCell>{location.address || "-"}</TableCell>
                        <TableCell>{location.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={location.isActive ? "default" : "secondary"}>
                            {location.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenLocationDialog(location)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleDeleteLocation(location.id, location.name, location._count)
                              }
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Usuarios</CardTitle>
                <CardDescription>
                  Gestiona los usuarios y sus permisos
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenUserDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Shield className="mr-1 h-3 w-3" />
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.location?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenUserDialog(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(user.id, user.name, user._count)}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movement Types Tab */}
        <TabsContent value="movement-types" className="space-y-4">
          <MovementTypesTab />
        </TabsContent>

        {/* Payment Method Accounts Tab */}
        <TabsContent value="payment-methods" className="space-y-4">
          <PaymentMethodAccountsTab />
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Categorías de Productos</CardTitle>
                  <CardDescription>
                    Organiza tus productos en categorías y subcategorías
                  </CardDescription>
                </div>
                <Button onClick={handleAddRootCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Categoría
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CategoryTree
                categories={categories}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
                onAddChild={handleAddChildCategory}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Denominations Tab */}
        <TabsContent value="denominations" className="space-y-4">
          <DenominationsTab />
        </TabsContent>

        {/* AFIP Tab */}
        <TabsContent value="afip" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración AFIP</CardTitle>
              <CardDescription>
                Configuración de facturación electrónica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="afipPuntoVenta">Punto de Venta</Label>
                <Input
                  id="afipPuntoVenta"
                  type="number"
                  placeholder="1"
                  value={tenantForm.afipPuntoVenta}
                  onChange={(e) =>
                    setTenantForm({ ...tenantForm, afipPuntoVenta: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Número de punto de venta asignado por AFIP
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTenant}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración AFIP
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  La configuración de certificados y claves AFIP se realizará en una versión futura.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Editar Ubicación" : "Nueva Ubicación"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Actualiza la información de la ubicación"
                : "Completa los datos para crear una nueva ubicación"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="locationName">Nombre</Label>
              <Input
                id="locationName"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locationAddress">Dirección</Label>
              <Input
                id="locationAddress"
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locationPhone">Teléfono</Label>
              <Input
                id="locationPhone"
                value={locationForm.phone}
                onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="locationActive"
                checked={locationForm.isActive}
                onCheckedChange={(checked) =>
                  setLocationForm({ ...locationForm, isActive: checked as boolean })
                }
              />
              <Label htmlFor="locationActive">Ubicación activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLocation}>
              {editingLocation ? "Actualizar" : "Crear"} Ubicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Actualiza la información del usuario"
                : "Completa los datos para crear un nuevo usuario"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userName">Nombre</Label>
              <Input
                id="userName"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                id="userEmail"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="userPassword">
                Contraseña {editingUser && "(dejar en blanco para no cambiar)"}
              </Label>
              <Input
                id="userPassword"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="userRole">Rol</Label>
              <Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="CASHIER">Cajero</SelectItem>
                  <SelectItem value="STOCK_MANAGER">Encargado de Stock</SelectItem>
                  <SelectItem value="VIEWER">Consulta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="userLocation">Ubicación</Label>
              <Select
                value={userForm.locationId || "none"}
                onValueChange={(value) => setUserForm({ ...userForm, locationId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="userActive"
                checked={userForm.isActive}
                onCheckedChange={(checked) =>
                  setUserForm({ ...userForm, isActive: checked as boolean })
                }
              />
              <Label htmlFor="userActive">Usuario activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? "Actualizar" : "Crear"} Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <CategoryDialog
        open={showCategoryDialog}
        onClose={() => {
          setShowCategoryDialog(false)
          setEditingCategory(null)
          setCategoryParentId(null)
        }}
        onSuccess={() => {
          fetchCategories()
        }}
        category={editingCategory}
        parentId={categoryParentId}
        allCategories={categories}
      />
    </div>
  )
}
