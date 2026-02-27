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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, DollarSign, AlertCircle, Plus, History, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

interface CustomerAccount {
  id: string
  balance: number
  creditLimit: number
  isActive: boolean
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
    documentNumber: string | null
  }
  movements: Movement[]
}

interface Movement {
  id: string
  type: "CHARGE" | "PAYMENT"
  amount: number
  concept: string
  balanceBefore: number
  balanceAfter: number
  reference: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
  }
  sale: {
    id: string
    saleNumber: string
    total: number
  } | null
}

type PaymentMethod =
  | "CASH"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "TRANSFER"
  | "QR"
  | "CHECK"

interface PaymentEntry {
  method: PaymentMethod
  amount: string
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Tarjeta de Débito",
  CREDIT_CARD: "Tarjeta de Crédito",
  QR: "QR (Mercado Pago)",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
}

const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "QR",
  "TRANSFER",
  "CHECK",
]

export default function AccountsPage() {
  const [customers, setCustomers] = useState<CustomerAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "overdue">("all")

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null)
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: "CASH", amount: "" }])
  const [paymentConcept, setPaymentConcept] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentLoading, setPaymentLoading] = useState(false)

  // Movements dialog
  const [movementsDialog, setMovementsDialog] = useState(false)
  const [selectedCustomerMovements, setSelectedCustomerMovements] = useState<CustomerAccount | null>(null)

  // Fetch accounts
  useEffect(() => {
    fetchAccounts()
  }, [search, statusFilter])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter !== "all") params.set("status", statusFilter)

      const response = await fetch(`/api/accounts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers.map((c: any) => ({
          ...c.account,
          customer: {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            documentNumber: c.documentNumber,
          },
        })))
      } else {
        toast.error("Error al cargar las cuentas")
      }
    } catch (error) {
      console.error("Error fetching accounts:", error)
      toast.error("Error al cargar las cuentas")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPayment = (customer: CustomerAccount) => {
    setSelectedCustomer(customer)
    setPayments([{ method: "CASH", amount: "" }])
    setPaymentConcept("")
    setPaymentReference("")
    setPaymentDialog(true)
  }

  const getTotalPayment = () => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  }

  const updatePaymentMethod = (index: number, method: PaymentMethod) => {
    const updated = [...payments]
    updated[index].method = method
    setPayments(updated)
  }

  const updatePaymentAmount = (index: number, amount: string) => {
    const updated = [...payments]
    updated[index].amount = amount
    setPayments(updated)
  }

  const addPaymentMethod = () => {
    setPayments([...payments, { method: "CASH", amount: "" }])
  }

  const removePaymentMethod = (index: number) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index))
    }
  }

  const handleRegisterPayment = async () => {
    if (!selectedCustomer) return

    // Validate payments
    const totalAmount = getTotalPayment()
    if (totalAmount <= 0) {
      toast.error("Debe ingresar al menos un monto de pago")
      return
    }

    // Check all payments have amounts
    for (const payment of payments) {
      const amount = parseFloat(payment.amount)
      if (isNaN(amount) || amount <= 0) {
        toast.error("Todos los métodos de pago deben tener un monto válido")
        return
      }
    }

    if (!paymentConcept.trim()) {
      toast.error("Debe ingresar un concepto")
      return
    }

    try {
      setPaymentLoading(true)
      const response = await fetch(`/api/accounts/${selectedCustomer.customer.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          concept: paymentConcept,
          reference: paymentReference || undefined,
          payments: payments.map(p => ({
            method: p.method,
            amount: parseFloat(p.amount),
          })),
        }),
      })

      if (response.ok) {
        toast.success("Pago registrado exitosamente")
        setPaymentDialog(false)
        fetchAccounts()
      } else {
        const data = await response.json()
        toast.error(data.error || "Error al registrar el pago")
      }
    } catch (error) {
      console.error("Error registering payment:", error)
      toast.error("Error al registrar el pago")
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleViewMovements = (customer: CustomerAccount) => {
    setSelectedCustomerMovements(customer)
    setMovementsDialog(true)
  }

  const getBalanceBadge = (balance: number) => {
    if (balance < 0) {
      return <Badge variant="destructive">Debe: {formatCurrency(Math.abs(balance))}</Badge>
    } else if (balance > 0) {
      return <Badge variant="default">A favor: {formatCurrency(balance)}</Badge>
    } else {
      return <Badge variant="secondary">$0.00</Badge>
    }
  }

  const getAvailableCredit = (account: CustomerAccount) => {
    const used = Math.abs(Math.min(account.balance, 0))
    const available = Math.max(0, account.creditLimit - used)
    return available
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuentas Corrientes</h1>
        <p className="text-muted-foreground">
          Gestión de cuentas corrientes y cobros a clientes
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="search">Buscar cliente</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nombre, email, teléfono..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Estado</Label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="overdue">Con deuda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Accounts table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Límite</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando cuentas...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron cuentas corrientes
                </TableCell>
              </TableRow>
            ) : (
              customers.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    {account.customer.name}
                    {account.customer.documentNumber && (
                      <div className="text-xs text-muted-foreground">
                        {account.customer.documentNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.customer.email && (
                      <div className="text-sm">{account.customer.email}</div>
                    )}
                    {account.customer.phone && (
                      <div className="text-xs text-muted-foreground">
                        {account.customer.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {getBalanceBadge(account.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(account.creditLimit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={getAvailableCredit(account) <= 0 ? "text-destructive font-medium" : ""}>
                      {formatCurrency(getAvailableCredit(account))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {account.isActive ? (
                      <Badge variant="default">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewMovements(account)}
                      >
                        <History className="h-4 w-4 mr-1" />
                        Historial
                      </Button>
                      {account.balance < 0 && account.isActive && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenPayment(account)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Cobrar
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
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Cliente: {selectedCustomer?.customer.name}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Saldo actual:</span>
                  <span className="text-lg font-bold text-destructive">
                    {formatCurrency(Math.abs(selectedCustomer.balance))}
                  </span>
                </div>
              </div>

              {/* Payment Methods Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Métodos de Pago</Label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      Total: {formatCurrency(getTotalPayment())}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPaymentMethod}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </div>

                {payments.map((payment, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select
                        value={payment.method}
                        onValueChange={(value) =>
                          updatePaymentMethod(index, value as PaymentMethod)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {PAYMENT_METHOD_LABELS[method]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-40">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Monto"
                        value={payment.amount}
                        onChange={(e) => updatePaymentAmount(index, e.target.value)}
                      />
                    </div>
                    {payments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentMethod(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="concept">Concepto *</Label>
                <Input
                  id="concept"
                  placeholder="Ej: Pago de cliente"
                  value={paymentConcept}
                  onChange={(e) => setPaymentConcept(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Referencia (opcional)</Label>
                <Input
                  id="reference"
                  placeholder="Ej: Recibo #123"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialog(false)}
              disabled={paymentLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleRegisterPayment} disabled={paymentLoading}>
              {paymentLoading ? "Registrando..." : "Registrar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movements Dialog */}
      <Dialog open={movementsDialog} onOpenChange={setMovementsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Historial de Movimientos</DialogTitle>
            <DialogDescription>
              Cliente: {selectedCustomerMovements?.customer.name}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomerMovements && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Saldo Actual</div>
                  <div className="text-lg font-bold">
                    {getBalanceBadge(selectedCustomerMovements.balance)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Límite de Crédito</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(selectedCustomerMovements.creditLimit)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Crédito Disponible</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(getAvailableCredit(selectedCustomerMovements))}
                  </div>
                </div>
              </div>

              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCustomerMovements.movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay movimientos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedCustomerMovements.movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {new Date(movement.createdAt).toLocaleDateString("es-AR")}
                            <div className="text-xs text-muted-foreground">
                              {new Date(movement.createdAt).toLocaleTimeString("es-AR")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {movement.type === "CHARGE" ? (
                              <Badge variant="destructive">Cargo</Badge>
                            ) : (
                              <Badge variant="default">Pago</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>{movement.concept}</div>
                            {movement.reference && (
                              <div className="text-xs text-muted-foreground">
                                Ref: {movement.reference}
                              </div>
                            )}
                            {movement.sale && (
                              <div className="text-xs text-muted-foreground">
                                Venta: {movement.sale.saleNumber}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={movement.type === "CHARGE" ? "text-destructive" : "text-green-600"}>
                              {movement.type === "CHARGE" ? "-" : "+"}
                              {formatCurrency(movement.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(movement.balanceAfter)}
                          </TableCell>
                          <TableCell>
                            {movement.user.name || "Sistema"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setMovementsDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
