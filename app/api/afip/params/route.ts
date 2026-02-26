import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { getMasterAfipConfig, getAfipCredentials } from "@/lib/afip"
import { prisma } from "@/lib/db"

const parseStringPromise = require("xml2js").parseStringPromise

/**
 * GET /api/afip/params
 * Query AFIP for parameter definitions (IVA conditions, document types, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { cuit: true },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })
    }

    const masterConfig = getMasterAfipConfig()
    const credentials = await getAfipCredentials(masterConfig)

    // Query FEParamGetTiposIva - IVA conditions
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEParamGetTiposIva>
      <ar:Auth>
        <ar:Token>${credentials.token}</ar:Token>
        <ar:Sign>${credentials.sign}</ar:Sign>
        <ar:Cuit>${tenant.cuit}</ar:Cuit>
      </ar:Auth>
    </ar:FEParamGetTiposIva>
  </soapenv:Body>
</soapenv:Envelope>`

    const wsfeUrl =
      masterConfig.mode === "produccion"
        ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
        : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"

    const response = await fetch(wsfeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FEParamGetTiposIva",
      },
      body: soapRequest,
    })

    if (!response.ok) {
      throw new Error(`AFIP HTTP error: ${response.status}`)
    }

    const xmlResponse = await response.text()
    console.log("AFIP FEParamGetTiposIva Response:", xmlResponse)

    const parsed = await parseStringPromise(xmlResponse)
    const result =
      parsed["soap:Envelope"]["soap:Body"][0]["FEParamGetTiposIvaResponse"][0][
        "FEParamGetTiposIvaResult"
      ][0]

    const ivaTypes = result.ResultGet?.[0]?.IvaTipo || []

    return NextResponse.json({
      success: true,
      ivaTypes: ivaTypes.map((tipo: any) => ({
        id: tipo.Id?.[0],
        desc: tipo.Desc?.[0],
        fechaDesde: tipo.FchDesde?.[0],
        fechaHasta: tipo.FchHasta?.[0],
      })),
    })
  } catch (error: any) {
    console.error("GET /api/afip/params error:", error)
    return NextResponse.json(
      { error: "Error al consultar parámetros AFIP", details: error.message },
      { status: 500 }
    )
  }
}
