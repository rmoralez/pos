"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImportResult {
  success: boolean
  row: number
  sku?: string
  name: string
  error?: string
  productId?: string
}

interface ImportResponse {
  message: string
  total: number
  successCount: number
  failureCount: number
  results: ImportResult[]
}

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !importing) {
      setFile(null)
      setResults(null)
      setError(null)
    }
    onOpenChange(newOpen)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        setError("Por favor selecciona un archivo CSV")
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
      setResults(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al importar productos")
      }

      setResults(data)

      // Call onSuccess if there were successful imports
      if (data.successCount > 0) {
        onSuccess()
      }
    } catch (err) {
      console.error("Import error:", err)
      setError(err instanceof Error ? err.message : "Error al importar productos")
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    // Create CSV template
    const template = `SKU,Código de Barras,Nombre,Descripción,Precio Costo,Precio Venta,IVA %,Stock,Stock Mínimo,Unidad,Marca,Categoría,Proveedor
PROD-001,7501234567890,Producto Ejemplo,Descripción del producto,100.00,150.00,21,50,10,UNIDAD,Marca A,Electrónica,Proveedor X
PROD-002,7501234567891,Otro Producto,Otra descripción,200.00,300.00,21,30,5,CAJA,Marca B,Alimentos,Proveedor Y`

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "plantilla_productos.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Productos Masivamente</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con tus productos para importarlos en lote
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>¿No tienes un archivo CSV? Descarga nuestra plantilla</span>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="ml-4"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla
              </Button>
            </AlertDescription>
          </Alert>

          {/* Instructions */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Formato del CSV:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>Nombre</strong> y <strong>Precio Venta</strong> son obligatorios
              </li>
              <li>SKU y Código de Barras son opcionales pero recomendados</li>
              <li>Si especificas una Categoría o Proveedor, debe existir en el sistema</li>
              <li>IVA % predeterminado es 21% si no se especifica</li>
              <li>Stock y Stock Mínimo predeterminados son 0 si no se especifican</li>
              <li>Unidad predeterminada es &quot;UNIDAD&quot; si no se especifica</li>
            </ul>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label
              htmlFor="csv-file"
              className="block text-sm font-medium text-muted-foreground"
            >
              Seleccionar Archivo CSV
            </label>
            <div className="flex items-center gap-3">
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
                className="flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
              />
              {file && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {file.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 animate-pulse" />
                <span className="text-sm">Importando productos...</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse" style={{ width: "100%" }} />
              </div>
            </div>
          )}

          {/* Results Summary */}
          {results && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{results.message}</AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">{results.total}</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">Exitosos</div>
                  <div className="text-2xl font-bold text-green-600">
                    {results.successCount}
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">Fallidos</div>
                  <div className="text-2xl font-bold text-red-600">
                    {results.failureCount}
                  </div>
                </div>
              </div>

              {/* Detailed Results Table */}
              {results.failureCount > 0 && (
                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50">
                    <h4 className="font-medium">Productos con Errores</h4>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Fila</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.results
                          .filter(r => !r.success)
                          .map((result, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{result.row}</TableCell>
                              <TableCell>{result.name}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {result.sku || "-"}
                              </TableCell>
                              <TableCell className="text-red-600 text-sm">
                                {result.error}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            {results ? "Cerrar" : "Cancelar"}
          </Button>
          {!results && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
