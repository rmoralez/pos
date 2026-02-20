"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { CheckCircle2, AlertCircle, ArrowLeft, Eye } from "lucide-react"
import Link from "next/link"

interface CashRegister {
  id: string
  openedAt: string
  closedAt: string | null
  status: string
  openingBalance: number
  closingBalance: number | null
  expectedBalance: number | null
  difference: number | null
  user: {
    name: string
  }
  location: {
    name: string
  }
  _count: {
    sales: number
    transactions: number
  }
}

export default function CashRegisterHistoryPage() {
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  })

  const fetchCashRegisters = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/cash-registers?page=${page}&limit=${pagination.limit}`)

      if (response.ok) {
        const data = await response.json()
        setCashRegisters(data.cashRegisters)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching cash registers:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCashRegisters()
  }, [])

  const handlePageChange = (newPage: number) => {
    fetchCashRegisters(newPage)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando historial...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Historial de Cajas de Ventas</h1>
          <p className="text-muted-foreground">Registro de todas las cajas de ventas abiertas y cerradas</p>
        </div>
        <Link href="/dashboard/cash">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Caja de Ventas
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros de Caja de Ventas</CardTitle>
          <CardDescription>
            {pagination.total} registro{pagination.total !== 1 ? "s" : ""} encontrado{pagination.total !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cashRegisters.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-muted-foreground">No hay registros de caja</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Apertura</TableHead>
                    <TableHead>Cajero</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Balance Inicial</TableHead>
                    <TableHead className="text-right">Balance Final</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Ventas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashRegisters.map((register) => {
                    const openedAt = new Date(register.openedAt)
                    const closedAt = register.closedAt ? new Date(register.closedAt) : null
                    const hasDifference = register.difference !== null && register.difference !== 0

                    return (
                      <TableRow key={register.id}>
                        <TableCell>
                          <div className="font-medium">
                            {openedAt.toLocaleDateString("es-AR")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {openedAt.toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </TableCell>
                        <TableCell>{register.user.name}</TableCell>
                        <TableCell>{register.location.name}</TableCell>
                        <TableCell>
                          {register.status === "OPEN" ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Abierta
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Cerrada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(register.openingBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {register.closingBalance !== null
                            ? formatCurrency(register.closingBalance)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {register.difference !== null ? (
                            <span
                              className={
                                hasDifference
                                  ? register.difference > 0
                                    ? "text-blue-600 font-medium"
                                    : "text-red-600 font-medium"
                                  : "text-green-600 font-medium"
                              }
                            >
                              {formatCurrency(register.difference)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {register._count.sales} venta{register._count.sales !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/cash/${register.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {pagination.page} de {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
