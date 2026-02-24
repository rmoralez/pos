"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Receipt, User, Calendar, CreditCard, Package } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"

interface SaleItem {
  id: string
  quantity: number
  unitPrice: number
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  discount: number
  discountType?: string
  discountValue?: number
  product: {
    id: string
    name: string
    sku: string
  }
  ProductVariant?: {
    id: string
    sku: string
    variantValues: string
  }
}

interface SalePayment {
  id: string
  method: string
  amount: number
  reference?: string
}

interface Sale {
  id: string
  saleNumber: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  discountType?: string
  discountValue?: number
  total: number
  status: string
  createdAt: string
  user: {
    name: string | null
    email: string
  }
  customer?: {
    id: string
    name: string
    email?: string
    phone?: string
  }
  items: SaleItem[]
  payments: SalePayment[]
  cashRegister?: {
    id: string
  }
  location?: {
    id: string
    name: string
  }
}

export default function SaleDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [sale, setSale] = useState<Sale | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSale()
  }, [params.id])

  const fetchSale = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/sales/${params.id}`)
      if (!response.ok) throw new Error("Failed to fetch sale")

      const data = await response.json()
      setSale(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar la venta",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: "Efectivo",
      DEBIT_CARD: "Débito",
      CREDIT_CARD: "Crédito",
      QR: "QR",
      TRANSFER: "Transferencia",
      CHECK: "Cheque",
      ACCOUNT: "Cuenta Corriente",
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

  const formatCurrency = (value: number) => {
    return `$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Cargando venta...</p>
        </div>
      </div>
    )
  }

  if (!sale) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Venta no encontrada</p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/sales")}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al historial
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/sales")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Venta {sale.saleNumber}
            </h1>
            <p className="text-muted-foreground">
              {format(new Date(sale.createdAt), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(sale.status)}
        </div>
      </div>

      {/* Sale Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cajero</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{sale.user.name}</div>
            <p className="text-xs text-muted-foreground">{sale.user.email}</p>
          </CardContent>
        </Card>

        {sale.customer && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliente</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{sale.customer.name}</div>
              <p className="text-xs text-muted-foreground">
                {sale.customer.email || sale.customer.phone}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {sale.items.reduce((acc, item) => acc + item.quantity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatCurrency(sale.total)}</div>
            <p className="text-xs text-muted-foreground">
              {sale.payments.length} pago{sale.payments.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>Detalle de los productos vendidos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item) => {
                  const productName = item.ProductVariant
                    ? `${item.product.name} (${item.ProductVariant.variantValues})`
                    : item.product.name
                  const sku = item.ProductVariant?.sku || item.product.sku

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{productName}</TableCell>
                      <TableCell className="font-mono text-sm">{sku}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {item.discountValue && item.discountValue > 0 ? (
                          <span className="text-orange-600">
                            {item.discountType === "PERCENTAGE"
                              ? `${item.discountValue}%`
                              : formatCurrency(item.discountValue)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.taxAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment and Totals */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Forma de Pago</CardTitle>
            <CardDescription>Métodos de pago utilizados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sale.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {getPaymentMethodLabel(payment.method)}
                    </span>
                    {payment.reference && (
                      <span className="text-xs text-muted-foreground">
                        ({payment.reference})
                      </span>
                    )}
                  </div>
                  <span className="font-bold">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>Desglose del total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (neto)</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span>{formatCurrency(sale.taxAmount)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>
                    Descuento{" "}
                    {sale.discountType === "PERCENTAGE" && sale.discountValue
                      ? `(${sale.discountValue}%)`
                      : ""}
                  </span>
                  <span>-{formatCurrency(sale.discountAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      {(sale.cashRegister || sale.location) && (
        <Card>
          <CardHeader>
            <CardTitle>Información Adicional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              {sale.cashRegister && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Caja ID:</span>
                  <span className="font-medium font-mono text-xs">{sale.cashRegister.id}</span>
                </div>
              )}
              {sale.location && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Sucursal:</span>
                  <span className="font-medium">{sale.location.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
