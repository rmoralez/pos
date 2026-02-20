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
import { FileText, Plus, Eye, Trash2, CheckCircle2, XCircle, FileDown } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Quote {
  id: string
  quoteNumber: string
  total: number
  status: string
  createdAt: string
  validUntil: string | null
  user: {
    name: string | null
  }
  customer: {
    name: string
  } | null
  items: Array<{
    quantity: number
    product: {
      name: string
    }
  }>
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchQuotes()
  }, [])

  const fetchQuotes = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/quotes")
      if (!response.ok) throw new Error("Failed to fetch quotes")

      const data = await response.json()
      setQuotes(data.quotes || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los presupuestos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, className?: string }> = {
      DRAFT: { variant: "secondary", label: "Borrador", className: "bg-gray-500 hover:bg-gray-600" },
      SENT: { variant: "default", label: "Enviado", className: "bg-blue-500 hover:bg-blue-600" },
      APPROVED: { variant: "default", label: "Aprobado", className: "bg-green-500 hover:bg-green-600" },
      REJECTED: { variant: "destructive", label: "Rechazado" },
      CONVERTED: { variant: "outline", label: "Convertido", className: "bg-purple-500 hover:bg-purple-600 text-white" },
    }

    const config = variants[status] || variants.DRAFT

    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const handleDelete = async (id: string, quoteNumber: string) => {
    if (!confirm(`¿Está seguro que desea eliminar el presupuesto ${quoteNumber}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete quote")
      }

      toast({
        title: "Presupuesto eliminado",
        description: `El presupuesto ${quoteNumber} ha sido eliminado exitosamente`,
      })

      fetchQuotes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el presupuesto",
        variant: "destructive",
      })
    }
  }

  const handleConvert = async (id: string, quoteNumber: string) => {
    if (!confirm(`¿Desea convertir el presupuesto ${quoteNumber} en una venta?`)) {
      return
    }

    try {
      const response = await fetch(`/api/quotes/${id}/convert`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to convert quote")
      }

      const sale = await response.json()

      toast({
        title: "Presupuesto convertido",
        description: `El presupuesto ${quoteNumber} ha sido convertido a venta ${sale.saleNumber}`,
      })

      fetchQuotes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo convertir el presupuesto",
        variant: "destructive",
      })
    }
  }

  const handleDownloadPDF = (id: string, quoteNumber: string) => {
    window.open(`/api/quotes/${id}/pdf`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-muted-foreground">
            Gestiona todos los presupuestos del sistema
          </p>
        </div>
        <Link href="/dashboard/quotes/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Presupuesto
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presupuestos</CardTitle>
          <CardDescription>
            Todos los presupuestos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cargando presupuestos...</p>
              </div>
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay presupuestos registrados</p>
                <Link href="/dashboard/quotes/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primer Presupuesto
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Presupuesto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Válido hasta</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-mono text-sm">
                        {quote.quoteNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(quote.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {quote.customer ? quote.customer.name : "Cliente final"}
                      </TableCell>
                      <TableCell>
                        {quote.validUntil
                          ? format(new Date(quote.validUntil), "dd/MM/yyyy", { locale: es })
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {quote.items.reduce((acc, item) => acc + item.quantity, 0)} items
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(quote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/dashboard/quotes/${quote.id}`)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(quote.id, quote.quoteNumber)}
                            title="Descargar PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {(quote.status === "DRAFT" || quote.status === "SENT" || quote.status === "APPROVED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConvert(quote.id, quote.quoteNumber)}
                              title="Convertir a venta"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {quote.status === "DRAFT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(quote.id, quote.quoteNumber)}
                              title="Eliminar"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
