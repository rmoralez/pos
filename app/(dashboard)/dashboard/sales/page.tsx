"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Receipt, Search, Filter, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Sale {
  id: string
  saleNumber: string
  total: number
  status: string
  createdAt: string
  user: {
    name: string | null
  }
  items: Array<{
    quantity: number
    product: {
      name: string
    }
  }>
  payments: Array<{
    method: string
  }>
}

export default function SalesPage() {
  const router = useRouter()
  const [sales, setSales] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  useEffect(() => {
    fetchSales()
  }, [searchTerm, dateFrom, dateTo, paymentMethod, statusFilter])

  const fetchSales = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()

      if (searchTerm) params.append("search", searchTerm)
      if (dateFrom) params.append("dateFrom", dateFrom)
      if (dateTo) params.append("dateTo", dateTo)
      if (paymentMethod && paymentMethod !== "ALL") params.append("paymentMethod", paymentMethod)
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter)

      const response = await fetch(`/api/sales?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch sales")

      const data = await response.json()
      setSales(data.sales || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las ventas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setDateFrom("")
    setDateTo("")
    setPaymentMethod("ALL")
    setStatusFilter("ALL")
  }

  const hasActiveFilters = searchTerm || dateFrom || dateTo || (paymentMethod && paymentMethod !== "ALL") || (statusFilter && statusFilter !== "ALL")

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: "Efectivo",
      DEBIT_CARD: "Débito",
      CREDIT_CARD: "Crédito",
      QR: "QR",
      TRANSFER: "Transferencia",
      CHECK: "Cheque",
      OTHER: "Otro",
    }
    return labels[method] || method
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      COMPLETED: "default",
      PENDING: "secondary",
      CANCELLED: "destructive",
      REFUNDED: "secondary",
    }
    const labels: Record<string, string> = {
      COMPLETED: "Completada",
      PENDING: "Pendiente",
      CANCELLED: "Cancelada",
      REFUNDED: "Devuelta",
    }

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historial de Ventas</h1>
          <p className="text-muted-foreground">
            Consulta todas las ventas realizadas
          </p>
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} size="sm">
              <X className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          )}
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            size="sm"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtrar Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar N° Venta</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="SALE-000001"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateFrom">Fecha Desde</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateTo">Fecha Hasta</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="DEBIT_CARD">Débito</SelectItem>
                    <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                    <SelectItem value="QR">QR</SelectItem>
                    <SelectItem value="ACCOUNT">Cuenta Corriente</SelectItem>
                    <SelectItem value="CHECK">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="statusFilter">Estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="statusFilter">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="COMPLETED">Completada</SelectItem>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                    <SelectItem value="REFUNDED">Devuelta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ventas {hasActiveFilters ? "Filtradas" : "Recientes"}</CardTitle>
          <CardDescription>
            {sales.length} venta{sales.length !== 1 ? 's' : ''} encontrada{sales.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cargando ventas...</p>
              </div>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay ventas registradas</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Venta</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cajero</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow
                      key={sale.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/sales/${sale.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {sale.saleNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>{sale.user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sale.items.reduce((acc, item) => acc + item.quantity, 0)} items
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sale.payments.length > 0 && (
                          <Badge variant="secondary">
                            {getPaymentMethodLabel(sale.payments[0].method)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(sale.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
