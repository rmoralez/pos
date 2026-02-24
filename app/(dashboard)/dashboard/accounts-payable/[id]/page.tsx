"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Trash2, Mail, Phone, MapPin, FileText, Calendar, DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitCost: number
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  Product: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  } | null
  ProductVariant: {
    id: string
    sku: string
    barcode: string | null
    variantValues: string
  } | null
}

interface Payment {
  id: string
  amount: number
  createdAt: string
  SupplierPayment: {
    id: string
    paymentNumber: string
    amount: number
    paymentMethod: string
    paymentDate: string
    reference: string | null
    User: {
      name: string | null
      email: string
    }
  }
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string | null
  subtotal: number
  taxAmount: number
  total: number
  paidAmount: number
  balance: number
  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "CANCELLED" | "DISPUTED"
  notes: string | null
  isOverdue: boolean
  createdAt: string
  Supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
    cuit: string | null
    address: string | null
  }
  PurchaseOrder: {
    id: string
    purchaseNumber: string
    status: string
    createdAt: string
  } | null
  SupplierInvoiceItem: InvoiceItem[]
  SupplierPaymentAllocation: Payment[]
  User: {
    name: string | null
    email: string
  }
}

export default function SupplierInvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoice()
  }, [params.id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/supplier-invoices/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setInvoice(data)
      } else {
        toast.error("Error al cargar la factura")
        router.push("/dashboard/accounts-payable")
      }
    } catch (error) {
      console.error("Error fetching invoice:", error)
      toast.error("Error al cargar la factura")
    } finally {
      setLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!invoice) return

    if (!confirm(`¿Está seguro de anular la factura ${invoice.invoiceNumber}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/supplier-invoices/${invoice.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Factura anulada exitosamente")
        router.push("/dashboard/accounts-payable")
      } else {
        const data = await response.json()
        toast.error(data.error || "Error al anular la factura")
      }
    } catch (error) {
      console.error("Error voiding invoice:", error)
      toast.error("Error al anular la factura")
    }
  }

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return <Badge variant="destructive">Vencida</Badge>
    }

    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-500">Pendiente</Badge>
      case "PARTIAL":
        return <Badge className="bg-orange-500">Parcial</Badge>
      case "PAID":
        return <Badge className="bg-green-500">Pagada</Badge>
      case "CANCELLED":
        return <Badge variant="secondary">Anulada</Badge>
      case "DISPUTED":
        return <Badge variant="destructive">Disputada</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-muted-foreground">Cargando factura...</div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/accounts-payable">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            Factura {invoice.invoiceNumber}
          </h1>
          <p className="text-muted-foreground">
            Detalles de la factura del proveedor
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status === "PENDING" &&
            invoice.SupplierPaymentAllocation.length === 0 && (
              <Button variant="destructive" onClick={handleVoid}>
                <Trash2 className="h-4 w-4 mr-2" />
                Anular
              </Button>
            )}
        </div>
      </div>

      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{formatCurrency(invoice.total)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pagado</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(invoice.paidAmount)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Saldo</p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(invoice.balance)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-destructive" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <div className="mt-2">
                {getStatusBadge(invoice.status, invoice.isOverdue)}
              </div>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Supplier & Invoice Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Información del Proveedor</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Proveedor</p>
              <p className="font-medium">{invoice.Supplier.name}</p>
            </div>
            {invoice.Supplier.cuit && (
              <div>
                <p className="text-sm text-muted-foreground">CUIT</p>
                <p className="font-mono">{invoice.Supplier.cuit}</p>
              </div>
            )}
            {invoice.Supplier.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{invoice.Supplier.email}</span>
              </div>
            )}
            {invoice.Supplier.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{invoice.Supplier.phone}</span>
              </div>
            )}
            {invoice.Supplier.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{invoice.Supplier.address}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Información de la Factura</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Número de Factura</p>
              <p className="font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Factura</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(invoice.invoiceDate).toLocaleDateString("es-AR")}</span>
              </div>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Vencimiento</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={invoice.isOverdue ? "text-destructive font-medium" : ""}
                  >
                    {new Date(invoice.dueDate).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </div>
            )}
            {invoice.PurchaseOrder && (
              <div>
                <p className="text-sm text-muted-foreground">Orden de Compra</p>
                <Link
                  href={`/dashboard/purchase-orders/${invoice.PurchaseOrder.id}`}
                  className="text-primary hover:underline"
                >
                  {invoice.PurchaseOrder.purchaseNumber}
                </Link>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Creado por</p>
              <p className="text-sm">{invoice.User.name || invoice.User.email}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Invoice Items */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Ítems de la Factura</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.SupplierInvoiceItem.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    {item.description}
                    {item.Product && (
                      <div className="text-xs text-muted-foreground">
                        {item.Product.name}
                        {item.Product.sku && ` (SKU: ${item.Product.sku})`}
                      </div>
                    )}
                    {item.ProductVariant && (
                      <div className="text-xs text-muted-foreground">
                        Variante: {item.ProductVariant.variantValues}
                        {item.ProductVariant.sku && ` (SKU: ${item.ProductVariant.sku})`}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.unitCost)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.subtotal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.taxAmount)}
                  <div className="text-xs text-muted-foreground">
                    ({item.taxRate}%)
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totals */}
        <div className="flex justify-end mt-6">
          <div className="w-full md:w-1/3 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA:</span>
              <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-lg">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment History */}
      {invoice.SupplierPaymentAllocation.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Historial de Pagos</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Nro. Pago</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.SupplierPaymentAllocation.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    {new Date(
                      allocation.SupplierPayment.paymentDate
                    ).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {allocation.SupplierPayment.paymentNumber}
                  </TableCell>
                  <TableCell>
                    {allocation.SupplierPayment.paymentMethod}
                  </TableCell>
                  <TableCell>
                    {allocation.SupplierPayment.reference || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(allocation.amount)}
                  </TableCell>
                  <TableCell>
                    {allocation.SupplierPayment.User.name ||
                      allocation.SupplierPayment.User.email}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Notas</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
        </Card>
      )}
    </div>
  )
}
