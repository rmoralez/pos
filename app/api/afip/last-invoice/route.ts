import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import {
  getLastInvoiceNumber,
  getInvoiceTypeCode,
  type AfipConfig,
  type AfipCredentials,
} from "@/lib/afip"

/**
 * GET /api/afip/last-invoice?type=B
 * Get last authorized invoice number from AFIP
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

    const typeCode = getInvoiceTypeCode(invoiceType)
    const lastNumber = await getLastInvoiceNumber(config, credentials, typeCode)

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
