import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { getAfipCredentials, getMasterAfipConfig } from "@/lib/afip"

/**
 * POST /api/afip/auth
 * Test AFIP WSAA authentication using master credentials (delegated model)
 */
export async function POST(request: NextRequest) {
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
            "Configuración maestra AFIP no encontrada. El proveedor debe configurar las variables de entorno AFIP_PROVIDER_CUIT, AFIP_MASTER_CERT y AFIP_MASTER_KEY.",
        },
        { status: 500 }
      )
    }

    // Get credentials from AFIP using master certificate
    const credentials = await getAfipCredentials(masterConfig)

    return NextResponse.json({
      success: true,
      expiresAt: credentials.expiresAt,
      message: "Autenticación AFIP exitosa con certificado maestro",
    })
  } catch (error: any) {
    console.error("POST /api/afip/auth error:", error)
    return NextResponse.json(
      {
        error: "Error al obtener token de AFIP",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
