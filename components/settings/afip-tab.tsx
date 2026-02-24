"use client"

import { useState, useEffect } from "react"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Upload,
  FileText,
  AlertCircle,
  Shield,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface AfipConfig {
  cuit: string
  afipMode: string
  afipPuntoVenta: number
  afipDefaultInvoiceType: string
  afipEnabled: boolean
  afipTokenExpiresAt: string | null
  hasCredentials: boolean
  hasValidToken: boolean
}

export function AfipTab() {
  const [config, setConfig] = useState<AfipConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [gettingToken, setGettingToken] = useState(false)

  const [formData, setFormData] = useState({
    afipMode: "homologacion" as "homologacion" | "produccion",
    afipCert: "",
    afipKey: "",
    afipPuntoVenta: 1,
    afipDefaultInvoiceType: "B" as "A" | "B" | "C",
    afipEnabled: false,
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/afip/config")
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setFormData({
          afipMode: data.afipMode || "homologacion",
          afipCert: "",
          afipKey: "",
          afipPuntoVenta: data.afipPuntoVenta || 1,
          afipDefaultInvoiceType: data.afipDefaultInvoiceType || "B",
          afipEnabled: data.afipEnabled || false,
        })
      }
    } catch (error) {
      console.error("Error fetching AFIP config:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/afip/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al guardar configuración")
      }

      toast({
        title: "Configuración guardada",
        description: "La configuración de AFIP se guardó correctamente",
      })

      fetchConfig()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGetToken = async () => {
    setGettingToken(true)
    try {
      const response = await fetch("/api/afip/auth", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al obtener token")
      }

      const data = await response.json()

      toast({
        title: "Token obtenido",
        description: `Token válido hasta: ${new Date(
          data.expiresAt
        ).toLocaleString("es-AR")}`,
      })

      fetchConfig()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGettingToken(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch("/api/afip/test")

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Error al probar conexión")
      }

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Conexión exitosa",
          description: `Conectado a AFIP en modo ${data.mode}`,
        })
      } else {
        throw new Error(data.error || "Error de conexión")
      }
    } catch (error: any) {
      toast({
        title: "Error de conexión",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  const handleCertFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setFormData({ ...formData, afipCert: content })
      }
      reader.readAsText(file)
    }
  }

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setFormData({ ...formData, afipKey: content })
      }
      reader.readAsText(file)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado de AFIP</CardTitle>
              <CardDescription>
                Facturación electrónica con AFIP
              </CardDescription>
            </div>
            <Badge
              variant={config?.afipEnabled ? "default" : "secondary"}
              className="text-sm"
            >
              {config?.afipEnabled ? "Activado" : "Desactivado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {config?.hasCredentials ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium">Certificado</p>
                <p className="text-xs text-muted-foreground">
                  {config?.hasCredentials ? "Configurado" : "No configurado"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {config?.hasValidToken ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium">Token AFIP</p>
                <p className="text-xs text-muted-foreground">
                  {config?.hasValidToken ? "Válido" : "No disponible"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Modo</p>
                <p className="text-xs text-muted-foreground">
                  {config?.afipMode === "produccion"
                    ? "Producción"
                    : "Homologación"}
                </p>
              </div>
            </div>
          </div>

          {config?.afipTokenExpiresAt && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm">
                <strong>Token expira:</strong>{" "}
                {new Date(config.afipTokenExpiresAt).toLocaleString("es-AR")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración General</CardTitle>
          <CardDescription>
            Configurá los parámetros básicos de AFIP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="afipMode">Modo de Operación</Label>
              <Select
                value={formData.afipMode}
                onValueChange={(value: "homologacion" | "produccion") =>
                  setFormData({ ...formData, afipMode: value })
                }
              >
                <SelectTrigger id="afipMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacion">
                    Homologación (Pruebas)
                  </SelectItem>
                  <SelectItem value="produccion">
                    Producción (Real)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Usá Homologación para pruebas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afipPuntoVenta">Punto de Venta</Label>
              <Input
                id="afipPuntoVenta"
                type="number"
                min="1"
                value={formData.afipPuntoVenta}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    afipPuntoVenta: parseInt(e.target.value) || 1,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Número de punto de venta en AFIP
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afipDefaultInvoiceType">
                Tipo de Factura por Defecto
              </Label>
              <Select
                value={formData.afipDefaultInvoiceType}
                onValueChange={(value: "A" | "B" | "C") =>
                  setFormData({ ...formData, afipDefaultInvoiceType: value })
                }
              >
                <SelectTrigger id="afipDefaultInvoiceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Factura A</SelectItem>
                  <SelectItem value="B">Factura B</SelectItem>
                  <SelectItem value="C">Factura C</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A: Responsable Inscripto, B: Consumidor Final, C: Exento
              </p>
            </div>

            <div className="space-y-2 flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <Switch
                  id="afipEnabled"
                  checked={formData.afipEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, afipEnabled: checked })
                  }
                />
                <Label htmlFor="afipEnabled">Activar Facturación AFIP</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Activá para generar facturas electrónicas
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>CUIT configurado:</strong> {config?.cuit}
                <br />
                Este CUIT se usa para todas las operaciones con AFIP
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader>
          <CardTitle>Certificados y Claves</CardTitle>
          <CardDescription>
            Cargá el certificado X.509 y la clave privada de AFIP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="certFile">Certificado (archivo .crt o .pem)</Label>
            <div className="flex gap-2">
              <Input
                id="certFile"
                type="file"
                accept=".crt,.pem,.cer"
                onChange={handleCertFileUpload}
                className="flex-1"
              />
              {config?.hasCredentials && (
                <Badge variant="secondary" className="self-center">
                  <FileText className="h-3 w-3 mr-1" />
                  Cargado
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyFile">Clave Privada (archivo .key)</Label>
            <div className="flex gap-2">
              <Input
                id="keyFile"
                type="file"
                accept=".key,.pem"
                onChange={handleKeyFileUpload}
                className="flex-1"
              />
              {config?.hasCredentials && (
                <Badge variant="secondary" className="self-center">
                  <FileText className="h-3 w-3 mr-1" />
                  Cargado
                </Badge>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>¿Cómo obtener los certificados?</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Ingresá a AFIP con Clave Fiscal</li>
                  <li>
                    Andá a &quot;Administrador de Relaciones de Clave Fiscal&quot;
                  </li>
                  <li>Seleccioná &quot;Nueva Relación&quot;</li>
                  <li>Buscá el servicio &quot;wsfe&quot; (Facturación Electrónica)</li>
                  <li>Generá el certificado y descargá los archivos</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSaveConfig} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Button>

        <Button
          onClick={handleGetToken}
          disabled={gettingToken || !config?.hasCredentials}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${gettingToken ? "animate-spin" : ""}`} />
          Obtener Token AFIP
        </Button>

        <Button
          onClick={handleTestConnection}
          disabled={testing || !config?.hasValidToken}
          variant="outline"
        >
          {testing ? "Probando..." : "Probar Conexión"}
        </Button>
      </div>
    </div>
  )
}
