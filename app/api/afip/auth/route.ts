import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { getAfipCredentials, type AfipConfig } from "@/lib/afip"

/**
 * POST /api/afip/auth
 * Get authentication token from AFIP WSAA
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
        afipMode: true,
        afipCert: true,
        afipKey: true,
        afipPuntoVenta: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    // Validate configuration
    if (!tenant.afipCert || !tenant.afipKey) {
      return NextResponse.json(
        {
          error:
            "Configuración AFIP incompleta. Debes cargar el certificado y la clave privada.",
        },
        { status: 400 }
      )
    }

    if (!tenant.afipPuntoVenta) {
      return NextResponse.json(
        { error: "Punto de venta no configurado" },
        { status: 400 }
      )
    }

    const config: AfipConfig = {
      mode: (tenant.afipMode as "homologacion" | "produccion") || "homologacion",
      cuit: tenant.cuit,
      cert: tenant.afipCert,
      key: tenant.afipKey,
      puntoVenta: tenant.afipPuntoVenta,
    }

    // Get credentials from AFIP
    const credentials = await getAfipCredentials(config)

    // Save credentials to database
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        afipToken: credentials.token,
        afipSign: credentials.sign,
        afipTokenExpiresAt: credentials.expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      expiresAt: credentials.expiresAt,
      message: "Token AFIP obtenido correctamente",
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
