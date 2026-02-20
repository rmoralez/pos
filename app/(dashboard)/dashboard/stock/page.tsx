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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Boxes,
  Search,
  Plus,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Package,
  History
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface StockItem {
  id: string
  quantity: number
  product: {
    id: string
    sku: string
    name: string
    minStock: number
    category: {
      id: string
      name: string
    } | null
  }
  location: {
    id: string
    name: string
  }
}

interface StockMovement {
  id: string
  type: string
  quantity: number
  reason: string | null
  createdAt: string
  product: {
    id: string
    sku: string
    name: string
  }
  user: {
    id: string
    name: string
  }
  sale: {
    id: string
    saleNumber: string
  } | null
}

const movementTypeLabels: Record<string, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferencia",
  RETURN: "Devolución",
  LOSS: "Pérdida",
}

const movementTypeColors: Record<string, string> = {
  PURCHASE: "bg-green-500",
  RETURN: "bg-green-500",
  ADJUSTMENT: "bg-blue-500",
  TRANSFER: "bg-purple-500",
  SALE: "bg-red-500",
  LOSS: "bg-red-500",
}

export default function StockPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showLowStock, setShowLowStock] = useState(false)
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [movementForm, setMovementForm] = useState({
    type: "ADJUSTMENT",
    quantity: "",
    reason: "",
  })

  const fetchStock = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (showLowStock) params.append("lowStock", "true")

      const response = await fetch(`/api/stock?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch stock")

      const data = await response.json()
      setStockItems(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el inventario",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [search, showLowStock])

  const fetchMovements = useCallback(async () => {
    try {
      const response = await fetch("/api/stock/movements?limit=50")
      if (!response.ok) throw new Error("Failed to fetch movements")

      const data = await response.json()
      setMovements(data)
    } catch (error) {
      console.error("Failed to fetch movements:", error)
    }
  }, [])

  useEffect(() => {
    fetchStock()
    fetchMovements()
  }, [fetchStock, fetchMovements])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchStock()
  }

  const handleAddMovement = async () => {
    if (!selectedProduct || !movementForm.quantity) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      })
      return
    }

    try {
      const stockItem = stockItems.find((item) => item.product.id === selectedProduct)
      if (!stockItem) {
        throw new Error("Product not found")
      }

      const response = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct,
          type: movementForm.type,
          quantity: parseInt(movementForm.quantity),
          reason: movementForm.reason || undefined,
          locationId: stockItem.location.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create movement")
      }

      toast({
        title: "Movimiento registrado",
        description: "El movimiento de stock ha sido registrado exitosamente",
      })

      setShowMovementDialog(false)
      setSelectedProduct("")
      setMovementForm({ type: "ADJUSTMENT", quantity: "", reason: "" })
      fetchStock()
      fetchMovements()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo registrar el movimiento",
        variant: "destructive",
      })
    }
  }

  const getLowStockCount = () => {
    return stockItems.filter((item) => item.quantity <= item.product.minStock).length
  }

  const getTotalProducts = () => {
    return stockItems.length
  }

  const getTotalQuantity = () => {
    return stockItems.reduce((acc, item) => acc + item.quantity, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">
            Gestiona el stock de productos en tus ubicaciones
          </p>
        </div>
        <Button onClick={() => setShowMovementDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Movimiento de Stock
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalProducts()}</div>
            <p className="text-xs text-muted-foreground">
              {getTotalQuantity()} unidades totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{getLowStockCount()}</div>
            <p className="text-xs text-muted-foreground">
              Productos por debajo del mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimientos Recientes</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimos 50 movimientos
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stock Actual</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Niveles de Stock</CardTitle>
              <CardDescription>
                Consulta y gestiona los niveles de inventario por producto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="mb-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o SKU..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button type="submit">Buscar</Button>
                  <Button
                    type="button"
                    variant={showLowStock ? "default" : "outline"}
                    onClick={() => setShowLowStock(!showLowStock)}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Stock Bajo
                  </Button>
                </div>
              </form>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Cargando inventario...</p>
                  </div>
                </div>
              ) : stockItems.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No se encontraron productos</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead className="text-right">Stock Actual</TableHead>
                        <TableHead className="text-right">Stock Mínimo</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.map((item) => {
                        const isLowStock = item.quantity <= item.product.minStock
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">
                              {item.product.sku}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.product.name}
                            </TableCell>
                            <TableCell>
                              {item.product.category ? (
                                <Badge variant="outline">{item.product.category.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{item.location.name}</span>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              <span className={isLowStock ? "text-destructive" : ""}>
                                {item.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.product.minStock}
                            </TableCell>
                            <TableCell>
                              {item.quantity === 0 ? (
                                <Badge variant="destructive">Sin Stock</Badge>
                              ) : isLowStock ? (
                                <Badge variant="secondary" className="bg-yellow-500 text-white">
                                  Stock Bajo
                                </Badge>
                              ) : (
                                <Badge variant="default">Normal</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Movimientos</CardTitle>
              <CardDescription>
                Registro de todos los movimientos de stock realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay movimientos registrados</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="text-sm">
                            {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm", {
                              locale: es,
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge className={movementTypeColors[movement.type]}>
                              {movementTypeLabels[movement.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{movement.product.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {movement.product.sku}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {["PURCHASE", "RETURN"].includes(movement.type) && (
                              <TrendingUp className="inline h-4 w-4 text-green-500 mr-1" />
                            )}
                            {["SALE", "LOSS"].includes(movement.type) && (
                              <TrendingDown className="inline h-4 w-4 text-red-500 mr-1" />
                            )}
                            {movement.quantity}
                          </TableCell>
                          <TableCell className="text-sm">{movement.user.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {movement.reason || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento de Stock</DialogTitle>
            <DialogDescription>
              Registra un ajuste, compra o cualquier movimiento de inventario
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Producto</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map((item) => (
                    <SelectItem key={item.product.id} value={item.product.id}>
                      {item.product.name} ({item.product.sku}) - Stock: {item.quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Tipo de Movimiento</Label>
              <Select
                value={movementForm.type}
                onValueChange={(value) =>
                  setMovementForm({ ...movementForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PURCHASE">Compra</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  <SelectItem value="RETURN">Devolución</SelectItem>
                  <SelectItem value="LOSS">Pérdida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity">
                Cantidad {["PURCHASE", "RETURN"].includes(movementForm.type) && "(positiva)"}
                {["LOSS"].includes(movementForm.type) && "(a descontar)"}
              </Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Ingresa la cantidad"
                value={movementForm.quantity}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, quantity: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Describe el motivo del movimiento..."
                value={movementForm.reason}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, reason: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovementDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddMovement}>Registrar Movimiento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
