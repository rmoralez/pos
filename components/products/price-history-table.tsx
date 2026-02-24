"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, TrendingUp, TrendingDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface PriceHistoryEntry {
  id: string
  oldCostPrice: number | null
  oldSalePrice: number | null
  newCostPrice: number | null
  newSalePrice: number | null
  changeReason: string | null
  createdAt: string
  User: {
    id: string
    name: string | null
    email: string | null
  }
  Product: {
    id: string
    name: string
    sku: string | null
  } | null
  ProductVariant: {
    id: string
    sku: string
    variantValues: string
  } | null
}

interface PriceHistoryTableProps {
  productId: string
}

export function PriceHistoryTable({ productId }: PriceHistoryTableProps) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [productId])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/price-history`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error("Error loading price history:", error)
    } finally {
      setLoading(false)
    }
  }

  const parseVariantValues = (variantValues: string): Record<string, string> => {
    try {
      return JSON.parse(variantValues)
    } catch {
      return {}
    }
  }

  const formatVariantName = (variantValues: string): string => {
    const attrs = parseVariantValues(variantValues)
    return Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ")
  }

  const getPriceChange = (oldPrice: number | null, newPrice: number | null) => {
    if (oldPrice === null || newPrice === null) return null
    return newPrice - oldPrice
  }

  const renderPriceChange = (oldPrice: number | null, newPrice: number | null, label: string) => {
    if (oldPrice === null && newPrice === null) return null

    const change = getPriceChange(oldPrice, newPrice)
    const isIncrease = change !== null && change > 0
    const isDecrease = change !== null && change < 0

    return (
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {oldPrice !== null ? formatCurrency(oldPrice) : "-"}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">
            {newPrice !== null ? formatCurrency(newPrice) : "-"}
          </span>
          {change !== null && change !== 0 && (
            <Badge
              variant="secondary"
              className={`text-xs ${
                isIncrease ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {isIncrease ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {isIncrease ? "+" : ""}
              {formatCurrency(Math.abs(change))}
            </Badge>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Precios
          </CardTitle>
          <CardDescription>Cargando historial...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Precios
        </CardTitle>
        <CardDescription>
          Todos los cambios de precios realizados en este producto y sus variantes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay historial de precios</h3>
            <p className="text-muted-foreground">
              Los cambios de precios se registrarán automáticamente aquí
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto / Variante</TableHead>
                  <TableHead>Precio de Costo</TableHead>
                  <TableHead>Precio de Venta</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Modificado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString("es-AR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {entry.Product?.name || "Producto eliminado"}
                        </div>
                        {entry.ProductVariant && (
                          <div className="text-xs text-muted-foreground">
                            Variante: {formatVariantName(entry.ProductVariant.variantValues)}
                            <br />
                            SKU: {entry.ProductVariant.sku}
                          </div>
                        )}
                        {!entry.ProductVariant && entry.Product && (
                          <div className="text-xs text-muted-foreground">
                            SKU: {entry.Product.sku || "N/A"}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderPriceChange(
                        entry.oldCostPrice,
                        entry.newCostPrice,
                        "Costo"
                      )}
                    </TableCell>
                    <TableCell>
                      {renderPriceChange(
                        entry.oldSalePrice,
                        entry.newSalePrice,
                        "Venta"
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.changeReason ? (
                        <span className="text-sm">{entry.changeReason}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          Sin motivo especificado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {entry.User.name || entry.User.email || "Usuario desconocido"}
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
  )
}
