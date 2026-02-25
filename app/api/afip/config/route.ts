import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { getMasterAfipConfig } from "@/lib/afip"

/**
 * GET /api/afip/config
 * Get AFIP configuration for the tenant (delegated model)
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
        afipPuntoVenta: true,
        afipDefaultInvoiceType: true,
        afipEnabled: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Check if master credentials are configured (provider-level)
    let hasMasterCredentials = false
    let masterMode = "homologacion"
    let providerCuit = ""
    try {
      const masterConfig = getMasterAfipConfig()
      hasMasterCredentials = true
      masterMode = masterConfig.mode
      providerCuit = masterConfig.providerCuit
    } catch (error) {
      // Master credentials not configured
    }

    return NextResponse.json({
      ...tenant,
      hasMasterCredentials,
      masterMode,
      providerCuit,
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
 * Update AFIP configuration (ADMIN only) - Delegated model
 * Only updates tenant-specific settings (punto venta, invoice type, enabled)
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
    const { afipPuntoVenta, afipDefaultInvoiceType, afipEnabled } = body

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

    // Build update data (only tenant-specific settings)
    const updateData: any = {}
    if (afipPuntoVenta !== undefined) updateData.afipPuntoVenta = afipPuntoVenta
    if (afipDefaultInvoiceType !== undefined)
      updateData.afipDefaultInvoiceType = afipDefaultInvoiceType
    if (afipEnabled !== undefined) updateData.afipEnabled = afipEnabled

    const tenant = await prisma.tenant.update({
      where: { id: user.tenantId },
      data: updateData,
      select: {
        cuit: true,
        afipPuntoVenta: true,
        afipDefaultInvoiceType: true,
        afipEnabled: true,
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
