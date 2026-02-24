import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import {
  generateCAE,
  getInvoiceTypeCode,
  getDocumentTypeCode,
  getIVACode,
  formatAfipDate,
  type AfipConfig,
  type AfipCredentials,
  type AfipInvoiceData,
} from "@/lib/afip"

/**
 * POST /api/afip/invoice
 * Generate electronic invoice with CAE from AFIP
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const {
      saleId,
      invoiceType, // "A" | "B" | "C"
      invoiceNumber,
      customerDocType,
      customerDocNumber,
      total,
      netAmount,
      ivaAmount,
      exemptAmount,
      items,
    } = body

    // Validate required fields
    if (!saleId || !invoiceType || !invoiceNumber || !total) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        cuit: true,
        afipMode: true,
        afipCert: true,
        afipKey: true,
        afipPuntoVenta: true,
        afipToken: true,
        afipSign: true,
        afipTokenExpiresAt: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Validate configuration
    if (!tenant.afipCert || !tenant.afipKey) {
      return NextResponse.json(
        { error: "Configuración AFIP incompleta" },
        { status: 400 }
      )
    }

    if (!tenant.afipToken || !tenant.afipSign || !tenant.afipTokenExpiresAt) {
      return NextResponse.json(
        { error: "Token no disponible. Debes obtener credenciales primero." },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(tenant.afipTokenExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Token expirado. Debes renovar las credenciales." },
        { status: 400 }
      )
    }

    const config: AfipConfig = {
      mode: (tenant.afipMode as "homologacion" | "produccion") || "homologacion",
      cuit: tenant.cuit,
      cert: tenant.afipCert,
      key: tenant.afipKey,
      puntoVenta: tenant.afipPuntoVenta || 1,
    }

    const credentials: AfipCredentials = {
      token: tenant.afipToken,
      sign: tenant.afipSign,
      expiresAt: new Date(tenant.afipTokenExpiresAt),
    }

    // Build IVA alicuotas from items
    const alicuotasMap = new Map<number, { baseImp: number; importe: number }>()

    if (items && Array.isArray(items)) {
      items.forEach((item: any) => {
        const taxRate = item.taxRate || 21
        const ivaCode = getIVACode(taxRate)
        const baseAmount = item.price * item.quantity
        const ivaAmount = (baseAmount * taxRate) / 100

        if (alicuotasMap.has(ivaCode)) {
          const current = alicuotasMap.get(ivaCode)!
          alicuotasMap.set(ivaCode, {
            baseImp: current.baseImp + baseAmount,
            importe: current.importe + ivaAmount,
          })
        } else {
          alicuotasMap.set(ivaCode, {
            baseImp: baseAmount,
            importe: ivaAmount,
          })
        }
      })
    }

    const alicuotas = Array.from(alicuotasMap.entries()).map(([id, data]) => ({
      id,
      baseImp: data.baseImp,
      importe: data.importe,
    }))

    // Build invoice data
    const invoiceData: AfipInvoiceData = {
      tipo: getInvoiceTypeCode(invoiceType as "A" | "B" | "C"),
      puntoVenta: config.puntoVenta,
      numero: invoiceNumber,
      fecha: formatAfipDate(new Date()),
      concepto: 1, // 1=Productos
      tipoDoc: getDocumentTypeCode(customerDocType || "Consumidor Final"),
      nroDoc: customerDocNumber || "0",
      importeTotal: total,
      importeNeto: netAmount || 0,
      importeIVA: ivaAmount || 0,
      importeExento: exemptAmount || 0,
      importeTributos: 0,
      moneda: "PES",
      cotizacion: 1,
      alicuotas: alicuotas.length > 0 ? alicuotas : undefined,
    }

    // Generate CAE
    const result = await generateCAE(config, credentials, invoiceData)

    // Save CAE to Sale
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        afipResponse: JSON.stringify(result),
      },
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error("POST /api/afip/invoice error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Error al generar factura electrónica",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
