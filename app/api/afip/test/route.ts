import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import {
  testAfipConnection,
  getMasterAfipConfig,
  getAfipCredentials,
  type TenantAfipConfig,
} from "@/lib/afip"

/**
 * GET /api/afip/test
 * Test connection to AFIP web services using master credentials (delegated model)
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
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Check tenant configuration
    if (!tenant.afipPuntoVenta) {
      return NextResponse.json(
        {
          success: false,
          error: "Punto de venta no configurado",
        },
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
          success: false,
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

    // Test connection
    const isConnected = await testAfipConnection(
      masterConfig,
      tenantConfig,
      credentials
    )

    return NextResponse.json({
      success: isConnected,
      mode: masterConfig.mode,
      message: isConnected
        ? "Conexión exitosa con AFIP usando certificado maestro"
        : "Error al conectar con AFIP",
    })
  } catch (error: any) {
    console.error("GET /api/afip/test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Error al probar conexión con AFIP",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
