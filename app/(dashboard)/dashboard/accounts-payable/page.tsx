"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Eye, Trash2, AlertCircle, DollarSign, TrendingUp, Calendar, CreditCard } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PaymentDialog } from "@/components/supplier-payments/payment-dialog"

interface SupplierInvoice {
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
  Supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  PurchaseOrder: {
    id: string
    purchaseNumber: string
  } | null
  _count: {
    SupplierInvoiceItem: number
    SupplierPaymentAllocation: number
  }
}

interface Summary {
  totalPayable: number
  overdueAmount: number
  paidThisMonth: number
}

export default function AccountsPayablePage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalPayable: 0,
    overdueAmount: 0,
    paidThisMonth: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<{
    supplierId: string
    invoiceId: string
  } | null>(null)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [search, statusFilter, supplierFilter])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers")
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.map((s: any) => ({ id: s.id, name: s.name })))
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error)
    }
  }

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (supplierFilter !== "all") params.set("supplierId", supplierFilter)

      const response = await fetch(`/api/supplier-invoices?${params}`)
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices)
        setSummary(data.summary)
      } else {
        toast.error("Error al cargar las facturas")
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast.error("Error al cargar las facturas")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!confirm(`¿Está seguro de anular la factura ${invoiceNumber}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/supplier-invoices/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Factura anulada exitosamente")
        fetchInvoices()
      } else {
        const data = await response.json()
        toast.error(data.error || "Error al anular la factura")
      }
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast.error("Error al anular la factura")
    }
  }

  const handlePayInvoice = (supplierId: string, invoiceId: string) => {
    setSelectedInvoiceForPayment({ supplierId, invoiceId })
    setPaymentDialogOpen(true)
  }

  const handlePaymentDialogClose = () => {
    setPaymentDialogOpen(false)
    setSelectedInvoiceForPayment(null)
  }

  const handlePaymentSuccess = () => {
    fetchInvoices()
  }

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const isOverdue =
      dueDate &&
      new Date(dueDate) < new Date() &&
      (status === "PENDING" || status === "PARTIAL")

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cuentas por Pagar</h1>
          <p className="text-muted-foreground">
            Gestión de facturas de proveedores y cuentas por pagar
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
          <Link href="/dashboard/accounts-payable/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Factura
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total por Pagar</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalPayable)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Facturas Vencidas</p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(summary.overdueAmount)}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pagado Este Mes</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.paidThisMonth)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="search">Buscar factura</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Número de factura..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="PARTIAL">Parcial</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
                <SelectItem value="CANCELLED">Anulada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="supplier">Proveedor</Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger id="supplier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Invoices table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nro. Factura</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Cargando facturas...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No se encontraron facturas
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                    {invoice.PurchaseOrder && (
                      <div className="text-xs text-muted-foreground">
                        OC: {invoice.PurchaseOrder.purchaseNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {invoice.Supplier.name}
                    {invoice.Supplier.phone && (
                      <div className="text-xs text-muted-foreground">
                        {invoice.Supplier.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(invoice.invoiceDate).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell>
                    {invoice.dueDate ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(invoice.dueDate).toLocaleDateString("es-AR")}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.paidAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        invoice.balance > 0 ? "text-destructive font-medium" : ""
                      }
                    >
                      {formatCurrency(invoice.balance)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(invoice.status, invoice.dueDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(invoice.status === "PENDING" || invoice.status === "PARTIAL") && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            handlePayInvoice(invoice.Supplier.id, invoice.id)
                          }
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Pagar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`/dashboard/accounts-payable/${invoice.id}`)
                        }
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      {invoice.status === "PENDING" &&
                        invoice._count.SupplierPaymentAllocation === 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={handlePaymentDialogClose}
        onSuccess={handlePaymentSuccess}
        preSelectedSupplierId={selectedInvoiceForPayment?.supplierId}
        preSelectedInvoiceId={selectedInvoiceForPayment?.invoiceId}
      />
    </div>
  )
}
