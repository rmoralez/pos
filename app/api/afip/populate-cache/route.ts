import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { getMasterAfipConfig, manuallyPopulateCache } from "@/lib/afip"

/**
 * POST /api/afip/populate-cache
 * Manually populate the AFIP credentials cache (for development/recovery)
 * This is useful when AFIP returns "alreadyAuthenticated" but we lost the cached credentials
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { token, sign, expirationTime } = await request.json()

    if (!token || !sign || !expirationTime) {
      return NextResponse.json(
        { error: "Faltan credenciales (token, sign, expirationTime)" },
        { status: 400 }
      )
    }

    // Get master config to determine cache key
    const masterConfig = getMasterAfipConfig()

    // Create credentials object
    const credentials = {
      token,
      sign,
      expiresAt: new Date(expirationTime),
    }

    // Populate the cache
    manuallyPopulateCache(masterConfig.providerCuit, masterConfig.mode, credentials)

    const cacheKey = `${masterConfig.providerCuit}-${masterConfig.mode}`

    return NextResponse.json({
      success: true,
      message: "Credenciales AFIP cacheadas exitosamente",
      cacheKey,
      expiresAt: credentials.expiresAt,
    })
  } catch (error: any) {
    console.error("POST /api/afip/populate-cache error:", error)
    return NextResponse.json(
      { error: "Error al cachear credenciales", details: error.message },
      { status: 500 }
    )
  }
}
