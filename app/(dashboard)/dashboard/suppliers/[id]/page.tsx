"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Mail, Phone, MapPin, FileText, Receipt, CreditCard, Package, Pencil, DollarSign } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { PaymentDialog } from "@/components/supplier-payments/payment-dialog"

interface SupplierDetails {
  id: string
  name: string
  email: string | null
  phone: string | null
  cuit: string | null
  address: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  SupplierAccount: {
    id: string
    balance: number
    creditLimit: number
    isActive: boolean
    SupplierInvoice: Array<{
      id: string
      invoiceNumber: string
      total: number
      balance: number
      status: string
      invoiceDate: string
      dueDate: string | null
    }>
  } | null
  PurchaseOrder: Array<{
    id: string
    purchaseNumber: string
    total: number
    status: string
    createdAt: string
  }>
  SupplierInvoice: Array<{
    id: string
    invoiceNumber: string
    total: number
    balance: number
    status: string
    invoiceDate: string
    dueDate: string | null
  }>
  SupplierPayment: Array<{
    id: string
    paymentNumber: string
    amount: number
    paymentMethod: string
    paymentDate: string
  }>
  _count: {
    PurchaseOrder: number
    SupplierInvoice: number
    SupplierPayment: number
    products: number
  }
}

export default function SupplierDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [supplier, setSupplier] = useState<SupplierDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  useEffect(() => {
    fetchSupplier()
  }, [params.id])

  const fetchSupplier = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/suppliers/${params.id}`)

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "No encontrado",
            description: "El proveedor no existe",
            variant: "destructive",
          })
          router.push("/dashboard/suppliers")
          return
        }
        throw new Error("Failed to fetch supplier")
      }

      const data = await response.json()
      setSupplier(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el proveedor",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    fetchSupplier()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      DRAFT: { variant: "secondary", label: "Borrador" },
      PENDING: { variant: "outline", label: "Pendiente" },
      APPROVED: { variant: "default", label: "Aprobado" },
      RECEIVED: { variant: "default", label: "Recibido" },
      CANCELLED: { variant: "destructive", label: "Cancelado" },
      PARTIAL: { variant: "outline", label: "Parcial" },
      PAID: { variant: "default", label: "Pagado" },
      DISPUTED: { variant: "destructive", label: "Disputado" },
    }

    const config = statusConfig[status] || { variant: "outline" as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
          <p className="text-muted-foreground">Cargando proveedor...</p>
        </div>
      </div>
    )
  }

  if (!supplier) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/suppliers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
            <p className="text-muted-foreground">
              Detalles del proveedor
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {supplier.SupplierAccount && supplier.SupplierAccount.balance > 0 && (
            <Button variant="default" onClick={() => setPaymentDialogOpen(true)}>
              <DollarSign className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/dashboard/suppliers/${supplier.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Supplier Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo de Cuenta</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              supplier.SupplierAccount && supplier.SupplierAccount.balance > 0
                ? "text-red-600"
                : supplier.SupplierAccount && supplier.SupplierAccount.balance < 0
                ? "text-green-600"
                : "text-muted-foreground"
            )}>
              {supplier.SupplierAccount ? formatCurrency(supplier.SupplierAccount.balance) : "-"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {supplier.SupplierAccount && supplier.SupplierAccount.balance > 0
                ? "Deuda pendiente"
                : supplier.SupplierAccount && supplier.SupplierAccount.balance < 0
                ? "A favor del proveedor"
                : "Sin saldo"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes de Compra</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supplier._count.PurchaseOrder}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supplier._count.SupplierInvoice}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de facturas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Realizados</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supplier._count.SupplierPayment}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de pagos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">CUIT</p>
                <p className="text-sm text-muted-foreground">
                  {supplier.cuit || "No especificado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">
                  {supplier.email || "No especificado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Teléfono</p>
                <p className="text-sm text-muted-foreground">
                  {supplier.phone || "No especificado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Dirección</p>
                <p className="text-sm text-muted-foreground">
                  {supplier.address || "No especificada"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Orders, Invoices, Payments */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">
            Órdenes de Compra ({supplier.PurchaseOrder.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Facturas ({supplier.SupplierInvoice.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Pagos ({supplier.SupplierPayment.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Compra</CardTitle>
              <CardDescription>
                Últimas 10 órdenes de compra del proveedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {supplier.PurchaseOrder.length === 0 ? (
                <div className="text-center py-6">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No hay órdenes de compra</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.PurchaseOrder.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/dashboard/purchase-orders/${order.id}`}
                              className="hover:underline"
                            >
                              {order.purchaseNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(parseFloat(order.total.toString()))}
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

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Facturas</CardTitle>
              <CardDescription>
                Últimas 10 facturas del proveedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {supplier.SupplierInvoice.length === 0 ? (
                <div className="text-center py-6">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No hay facturas</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.SupplierInvoice.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.invoiceNumber}
                          </TableCell>
                          <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                          <TableCell>
                            {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(parseFloat(invoice.total.toString()))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={cn(
                              parseFloat(invoice.balance.toString()) > 0 ? "text-red-600" : "text-green-600"
                            )}>
                              {formatCurrency(parseFloat(invoice.balance.toString()))}
                            </span>
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

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pagos</CardTitle>
                <CardDescription>
                  Últimos 10 pagos realizados al proveedor
                </CardDescription>
              </div>
              <Button onClick={() => setPaymentDialogOpen(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Nuevo Pago
              </Button>
            </CardHeader>
            <CardContent>
              {supplier.SupplierPayment.length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No hay pagos registrados</p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => setPaymentDialogOpen(true)}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Registrar Primer Pago
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.SupplierPayment.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {payment.paymentNumber}
                          </TableCell>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(parseFloat(payment.amount.toString()))}
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

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSuccess={handlePaymentSuccess}
        preSelectedSupplierId={supplier.id}
      />
    </div>
  )
}
