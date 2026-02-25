import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import {
  getLastInvoiceNumber,
  getInvoiceTypeCode,
  getMasterAfipConfig,
  getAfipCredentials,
  type TenantAfipConfig,
} from "@/lib/afip"

/**
 * GET /api/afip/last-invoice?type=B
 * Get last authorized invoice number from AFIP (delegated model)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceType = (searchParams.get("type") || "B") as "A" | "B" | "C"

    if (!["A", "B", "C"].includes(invoiceType)) {
      return NextResponse.json(
        { error: 'Tipo de factura debe ser "A", "B" o "C"' },
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

    const typeCode = getInvoiceTypeCode(invoiceType)
    const lastNumber = await getLastInvoiceNumber(
      masterConfig,
      tenantConfig,
      credentials,
      typeCode
    )

    return NextResponse.json({
      type: invoiceType,
      lastNumber,
      nextNumber: lastNumber + 1,
    })
  } catch (error: any) {
    console.error("GET /api/afip/last-invoice error:", error)
    return NextResponse.json(
      {
        error: "Error al obtener último número de factura",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
