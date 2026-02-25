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
  AlertCircle,
  Shield,
  Building2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface AfipConfig {
  cuit: string
  afipPuntoVenta: number
  afipDefaultInvoiceType: string
  afipEnabled: boolean
  hasMasterCredentials: boolean
  masterMode: string
  providerCuit: string
}

export function AfipTab() {
  const [config, setConfig] = useState<AfipConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [formData, setFormData] = useState({
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
        description: "La configuración AFIP se guardó correctamente",
      })
      fetchConfig()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch("/api/afip/test")
      const data = await response.json()

      if (data.success) {
        toast({
          title: "Conexión exitosa",
          description: data.message,
        })
      } else {
        throw new Error(data.error || "Error al probar conexión")
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: error.message,
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">Cargando configuración...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Estado del Servicio</CardTitle>
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <CardDescription>
            Sistema de facturación electrónica AFIP (Modelo Delegado)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Certificado Maestro (Proveedor)
              </div>
              <div className="flex items-center gap-2">
                {config?.hasMasterCredentials ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      Configurado
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                      No configurado
                    </span>
                  </>
                )}
              </div>
              {config?.hasMasterCredentials && (
                <div className="text-xs text-muted-foreground">
                  Modo: {config.masterMode === "homologacion" ? "Homologación (test)" : "Producción"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                CUIT del Proveedor
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">
                  {config?.providerCuit || "No disponible"}
                </span>
              </div>
            </div>
          </div>

          {!config?.hasMasterCredentials && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <strong>Atención:</strong> El proveedor del sistema debe configurar
                  los certificados maestros AFIP en las variables de entorno antes de
                  que puedas usar facturación electrónica.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de tu Comercio</CardTitle>
          <CardDescription>
            Configurá el punto de venta y el tipo de factura que usarás
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="punto-venta">Punto de Venta</Label>
              <Input
                id="punto-venta"
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
                Número asignado por AFIP para tu punto de venta
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-type">Tipo de Factura por Defecto</Label>
              <Select
                value={formData.afipDefaultInvoiceType}
                onValueChange={(value: "A" | "B" | "C") =>
                  setFormData({ ...formData, afipDefaultInvoiceType: value })
                }
              >
                <SelectTrigger id="invoice-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">
                    Factura A - Responsables Inscriptos
                  </SelectItem>
                  <SelectItem value="B">
                    Factura B - Consumidor Final
                  </SelectItem>
                  <SelectItem value="C">Factura C - Operaciones Exentas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="afip-enabled" className="text-base">
                Activar Facturación AFIP
              </Label>
              <p className="text-sm text-muted-foreground">
                Habilitar emisión de facturas electrónicas
              </p>
            </div>
            <Switch
              id="afip-enabled"
              checked={formData.afipEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, afipEnabled: checked })
              }
              disabled={!config?.hasMasterCredentials}
            />
          </div>

          {formData.afipEnabled && !config?.hasMasterCredentials && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              No se puede activar: el proveedor no ha configurado los certificados maestros.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>¿Cómo configurar la facturación electrónica?</CardTitle>
          <CardDescription>
            Seguí estos pasos para autorizar a tu proveedor a facturar en tu nombre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 w-full">
                <strong className="block mb-2">
                  Paso 1: Dar de alta tu Punto de Venta en AFIP
                </strong>
                <ol className="list-decimal list-inside space-y-1.5 ml-2">
                  <li>Ingresá a AFIP con tu Clave Fiscal</li>
                  <li>Andá a &quot;Administración de puntos de venta y domicilios&quot;</li>
                  <li>Seleccioná tu empresa</li>
                  <li>Hacé clic en &quot;A/B/M de Puntos de venta&quot;</li>
                  <li>Agregá un nuevo punto de venta:</li>
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>Elegí un número (ejemplo: 1, 2, 3...)</li>
                    <li>Sistema: &quot;RECE para aplicativo y web services&quot;</li>
                    <li>Domicilio fiscal de tu comercio</li>
                  </ul>
                  <li>Guardá el número de punto de venta</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 w-full">
                <strong className="block mb-2">
                  Paso 2: Autorizar al Proveedor en AFIP
                </strong>
                <ol className="list-decimal list-inside space-y-1.5 ml-2">
                  <li>En AFIP, andá a &quot;Administrador de Relaciones de Clave Fiscal&quot;</li>
                  <li>Hacé clic en &quot;Nueva Relación&quot;</li>
                  <li>Buscá el servicio &quot;Factura Electrónica&quot; o &quot;wsfe&quot;</li>
                  <li>En el campo &quot;Representante&quot;, ingresá el CUIT del proveedor:</li>
                  {config?.providerCuit && (
                    <div className="bg-white p-3 rounded border border-blue-300 font-mono text-base font-bold my-2">
                      {config.providerCuit}
                    </div>
                  )}
                  <li>Confirmá la relación</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 w-full">
                <strong className="block mb-2">Paso 3: Configurar en este Sistema</strong>
                <ol className="list-decimal list-inside space-y-1.5 ml-2">
                  <li>Ingresá el número de punto de venta que creaste en el paso 1</li>
                  <li>Seleccioná tu tipo de factura por defecto</li>
                  <li>Guardá la configuración</li>
                  <li>Probá la conexión con el botón &quot;Probar Conexión&quot;</li>
                  <li>Si todo funciona, activá la facturación con el switch</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
            <strong className="text-yellow-900">⚠️ Importante:</strong>
            <ul className="list-disc list-inside text-xs mt-1.5 space-y-1 text-yellow-800">
              <li>Estos pasos deben realizarse desde tu cuenta de AFIP (con tu CUIT)</li>
              <li>La relación con el proveedor te permite a vos emitir facturas usando tu CUIT</li>
              <li>
                El proveedor NO tiene acceso a tu Clave Fiscal ni a ningún dato sensible de
                tu empresa
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSaveConfig} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Button>

        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || !config?.hasMasterCredentials || !formData.afipPuntoVenta}
        >
          {testing ? "Probando..." : "Probar Conexión"}
        </Button>
      </div>
    </div>
  )
}
