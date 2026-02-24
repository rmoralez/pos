import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/afip/config
 * Get AFIP configuration for the tenant (without sensitive data)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        cuit: true,
        afipMode: true,
        afipPuntoVenta: true,
        afipDefaultInvoiceType: true,
        afipEnabled: true,
        afipTokenExpiresAt: true,
        // Don't return cert, key, token, or sign for security
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Check if credentials are configured
    const fullTenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        afipCert: true,
        afipKey: true,
      },
    })

    const hasCredentials = !!(fullTenant?.afipCert && fullTenant?.afipKey)
    const hasValidToken =
      tenant.afipTokenExpiresAt && tenant.afipTokenExpiresAt > new Date()

    return NextResponse.json({
      ...tenant,
      hasCredentials,
      hasValidToken,
    })
  } catch (error: any) {
    console.error("GET /api/afip/config error:", error)
    return NextResponse.json(
      { error: "Error al obtener configuración AFIP" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/afip/config
 * Update AFIP configuration (ADMIN only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para modificar la configuración AFIP" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      afipMode,
      afipCert,
      afipKey,
      afipPuntoVenta,
      afipDefaultInvoiceType,
      afipEnabled,
    } = body

    // Validate mode
    if (afipMode && !["homologacion", "produccion"].includes(afipMode)) {
      return NextResponse.json(
        { error: 'Modo debe ser "homologacion" o "produccion"' },
        { status: 400 }
      )
    }

    // Validate invoice type
    if (
      afipDefaultInvoiceType &&
      !["A", "B", "C"].includes(afipDefaultInvoiceType)
    ) {
      return NextResponse.json(
        { error: 'Tipo de factura debe ser "A", "B" o "C"' },
        { status: 400 }
      )
    }

    // Validate punto de venta
    if (afipPuntoVenta !== undefined && afipPuntoVenta < 1) {
      return NextResponse.json(
        { error: "Punto de venta debe ser mayor a 0" },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: any = {}
    if (afipMode !== undefined) updateData.afipMode = afipMode
    if (afipCert !== undefined) updateData.afipCert = afipCert
    if (afipKey !== undefined) updateData.afipKey = afipKey
    if (afipPuntoVenta !== undefined) updateData.afipPuntoVenta = afipPuntoVenta
    if (afipDefaultInvoiceType !== undefined)
      updateData.afipDefaultInvoiceType = afipDefaultInvoiceType
    if (afipEnabled !== undefined) updateData.afipEnabled = afipEnabled

    const tenant = await prisma.tenant.update({
      where: { id: user.tenantId },
      data: updateData,
      select: {
        cuit: true,
        afipMode: true,
        afipPuntoVenta: true,
        afipDefaultInvoiceType: true,
        afipEnabled: true,
        afipTokenExpiresAt: true,
      },
    })

    return NextResponse.json(tenant)
  } catch (error: any) {
    console.error("POST /api/afip/config error:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración AFIP" },
      { status: 500 }
    )
  }
}
