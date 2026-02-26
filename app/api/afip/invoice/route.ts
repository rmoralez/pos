import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import {
  generateCAE,
  getInvoiceTypeCode,
  getDocumentTypeCode,
  getIVACode,
  formatAfipDate,
  getMasterAfipConfig,
  getAfipCredentials,
  type TenantAfipConfig,
  type AfipInvoiceData,
} from "@/lib/afip"

/**
 * POST /api/afip/invoice
 * Generate electronic invoice with CAE from AFIP (delegated model)
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
        afipPuntoVenta: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Validate tenant configuration
    if (!tenant.afipPuntoVenta) {
      return NextResponse.json(
        { error: "Punto de venta no configurado" },
        { status: 400 }
      )
    }

    // Get master configuration
    let masterConfig
    try {
      masterConfig = getMasterAfipConfig()
    } catch (error: any) {
      return NextResponse.json(
        {
          error:
            "Configuración maestra AFIP no encontrada. El proveedor debe configurar las variables de entorno.",
        },
        { status: 500 }
      )
    }

    const tenantConfig: TenantAfipConfig = {
      tenantCuit: tenant.cuit,
      puntoVenta: tenant.afipPuntoVenta,
    }

    // Get fresh credentials from AFIP
    const credentials = await getAfipCredentials(masterConfig)

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

    // Determine IVA condition based on invoice type and doc type
    let condicionIva = 5 // Default: Consumidor Final
    if (invoiceType === "A" || invoiceType === "B") {
      condicionIva = 1 // Responsable Inscripto
    } else if (invoiceType === "C") {
      condicionIva = 5 // Consumidor Final
    }

    // Build invoice data
    const invoiceData: AfipInvoiceData = {
      tipo: getInvoiceTypeCode(invoiceType as "A" | "B" | "C"),
      puntoVenta: tenantConfig.puntoVenta,
      numero: invoiceNumber,
      fecha: formatAfipDate(new Date()),
      concepto: 1, // 1=Productos
      tipoDoc: getDocumentTypeCode(customerDocType || "Consumidor Final"),
      nroDoc: customerDocNumber || "0",
      condicionIva,
      importeTotal: total,
      importeNeto: netAmount || 0,
      importeIVA: ivaAmount || 0,
      importeExento: exemptAmount || 0,
      importeTributos: 0,
      moneda: "PES",
      cotizacion: 1,
      alicuotas: alicuotas.length > 0 ? alicuotas : undefined,
    }

    // Generate CAE using master credentials
    const result = await generateCAE(
      masterConfig,
      tenantConfig,
      credentials,
      invoiceData
    )

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
