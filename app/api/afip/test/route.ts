import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { testAfipConnection, type AfipConfig, type AfipCredentials } from "@/lib/afip"

/**
 * GET /api/afip/test
 * Test connection to AFIP web services
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

    // Check configuration
    if (!tenant.afipCert || !tenant.afipKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración incompleta: certificado y clave privada requeridos",
        },
        { status: 400 }
      )
    }

    if (!tenant.afipToken || !tenant.afipSign || !tenant.afipTokenExpiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Token no disponible. Debes obtener credenciales primero.",
        },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(tenant.afipTokenExpiresAt) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: "Token expirado. Debes renovar las credenciales.",
        },
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

    const isConnected = await testAfipConnection(config, credentials)

    return NextResponse.json({
      success: isConnected,
      mode: tenant.afipMode,
      message: isConnected
        ? "Conexión exitosa con AFIP"
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
