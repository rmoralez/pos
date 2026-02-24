"use client"

import { useEffect, useState, useCallback } from "react"
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
import { Plus, Pencil, Trash2, CreditCard, Banknote, Building2, QrCode, FileText, Wallet } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface CashAccount {
  id: string
  name: string
  type: string
  isActive: boolean
}

interface PaymentMethodAccount {
  id: string
  paymentMethod: string
  cashAccountId: string
  tenantId: string
  createdAt: string
  updatedAt: string
  CashAccount: CashAccount
}

const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Tarjeta de Débito",
  CREDIT_CARD: "Tarjeta de Crédito",
  TRANSFER: "Transferencia",
  QR: "QR / Billetera Virtual",
  CHECK: "Cheque",
  ACCOUNT: "Cuenta Corriente",
  OTHER: "Otro",
}

const paymentMethodIcons: Record<string, any> = {
  CASH: Banknote,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  TRANSFER: Building2,
  QR: QrCode,
  CHECK: FileText,
  ACCOUNT: Wallet,
  OTHER: Wallet,
}

export function PaymentMethodAccountsTab() {
  const [mappings, setMappings] = useState<PaymentMethodAccount[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingMapping, setEditingMapping] = useState<PaymentMethodAccount | null>(null)
  const [formData, setFormData] = useState({
    paymentMethod: "",
    cashAccountId: "",
  })

  const fetchMappings = useCallback(async () => {
    try {
      const response = await fetch("/api/payment-methods/accounts")
      if (!response.ok) throw new Error("Failed to fetch mappings")
      const data = await response.json()
      setMappings(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los mapeos de métodos de pago",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCashAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/cash-accounts")
      if (!response.ok) throw new Error("Failed to fetch cash accounts")
      const data = await response.json()
      setCashAccounts(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas de efectivo",
        variant: "destructive",
      })
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchMappings(), fetchCashAccounts()])
      setIsLoading(false)
    }
    loadData()
  }, [fetchMappings, fetchCashAccounts])

  const handleOpenDialog = (mapping?: PaymentMethodAccount) => {
    if (mapping) {
      setEditingMapping(mapping)
      setFormData({
        paymentMethod: mapping.paymentMethod,
        cashAccountId: mapping.cashAccountId,
      })
    } else {
      setEditingMapping(null)
      setFormData({
        paymentMethod: "",
        cashAccountId: "",
      })
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.paymentMethod || !formData.cashAccountId) {
      toast({
        title: "Error",
        description: "Método de pago y cuenta son obligatorios",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingMapping
        ? `/api/payment-methods/accounts/${editingMapping.id}`
        : "/api/payment-methods/accounts"
      const method = editingMapping ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save mapping")
      }

      toast({
        title: editingMapping ? "Mapeo actualizado" : "Mapeo creado",
        description: `El mapeo ha sido ${editingMapping ? "actualizado" : "creado"} exitosamente`,
      })

      setShowDialog(false)
      fetchMappings()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el mapeo",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, paymentMethod: string) => {
    if (!confirm(`¿Estás seguro de eliminar el mapeo para ${paymentMethodLabels[paymentMethod]}?`)) return

    try {
      const response = await fetch(`/api/payment-methods/accounts/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete mapping")
      }

      toast({
        title: "Mapeo eliminado",
        description: "El mapeo ha sido eliminado exitosamente",
      })

      fetchMappings()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el mapeo",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando mapeos de métodos de pago...</p>
      </div>
    )
  }

  // Get available payment methods (those not already mapped)
  const mappedMethods = mappings.map(m => m.paymentMethod)
  const availablePaymentMethods = Object.keys(paymentMethodLabels).filter(
    method => !mappedMethods.includes(method) || (editingMapping && editingMapping.paymentMethod === method)
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapeo de Métodos de Pago</CardTitle>
            <CardDescription>
              Asocia métodos de pago con cuentas de efectivo para contabilización automática
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={availablePaymentMethods.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Mapeo
          </Button>
        </CardHeader>
        <CardContent>
          {availablePaymentMethods.length === 0 && mappings.length === Object.keys(paymentMethodLabels).length && (
            <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              Todos los métodos de pago ya están mapeados
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Cuenta Asociada</TableHead>
                  <TableHead>Tipo de Cuenta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay mapeos configurados. Crea uno para empezar.
                    </TableCell>
                  </TableRow>
                ) : (
                  mappings.map((mapping) => {
                    const Icon = paymentMethodIcons[mapping.paymentMethod]
                    return (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {paymentMethodLabels[mapping.paymentMethod]}
                          </div>
                        </TableCell>
                        <TableCell>{mapping.CashAccount.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {mapping.CashAccount.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={mapping.CashAccount.isActive ? "default" : "secondary"}>
                            {mapping.CashAccount.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(mapping)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(mapping.id, mapping.paymentMethod)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">¿Cómo funciona?</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Cuando se realiza una venta, cada pago se registra automáticamente en la cuenta asociada</li>
              <li>• El efectivo va a una cuenta, las tarjetas a otra, y así sucesivamente</li>
              <li>• Esto simplifica la contabilidad y seguimiento de fondos</li>
              <li>• Solo puedes mapear cada método de pago una vez</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Editar Mapeo" : "Nuevo Mapeo"}
            </DialogTitle>
            <DialogDescription>
              {editingMapping
                ? "Actualiza la cuenta asociada al método de pago"
                : "Asocia un método de pago con una cuenta de efectivo"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="paymentMethod">Método de Pago *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) =>
                  setFormData({ ...formData, paymentMethod: value })
                }
                disabled={!!editingMapping}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {availablePaymentMethods.map((method) => {
                    const Icon = paymentMethodIcons[method]
                    return (
                      <SelectItem key={method} value={method}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {paymentMethodLabels[method]}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {editingMapping && (
                <p className="text-xs text-muted-foreground">
                  No puedes cambiar el método de pago. Elimina y crea uno nuevo si es necesario.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cashAccountId">Cuenta de Efectivo *</Label>
              <Select
                value={formData.cashAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, cashAccountId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts
                    .filter(acc => acc.isActive)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {cashAccounts.filter(acc => acc.isActive).length === 0 && (
                <p className="text-xs text-destructive">
                  No hay cuentas activas disponibles. Crea una cuenta primero.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={cashAccounts.filter(acc => acc.isActive).length === 0}
            >
              {editingMapping ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
