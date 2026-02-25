/**
 * AFIP Integration Service (Delegated/SaaS Model)
 * Handles authentication (WSAA) and electronic invoicing (WSFEv1)
 *
 * In this model:
 * - The provider (you) has ONE master certificate
 * - Clients authorize your CUIT from their AFIP
 * - You invoice on behalf of clients using master cert + their CUIT
 */

import { parseStringPromise, Builder } from "xml2js"
import { createSign, createHash } from "crypto"

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Master AFIP configuration (provider-level, from environment variables)
 */
export interface MasterAfipConfig {
  mode: "homologacion" | "produccion"
  providerCuit: string // Provider's CUIT
  cert: string // Master certificate in PEM format
  key: string // Master private key in PEM format
}

/**
 * Tenant AFIP configuration (per tenant, from database)
 */
export interface TenantAfipConfig {
  tenantCuit: string // Client's CUIT
  puntoVenta: number // Client's punto de venta
}

export interface AfipCredentials {
  token: string
  sign: string
  expiresAt: Date
}

export interface AfipInvoiceData {
  tipo: number // Tipo de comprobante: 6=B, 1=A, 11=C
  puntoVenta: number
  numero: number
  fecha: string // YYYYMMDD
  concepto: number // 1=Productos, 2=Servicios, 3=Productos y Servicios
  tipoDoc: number // 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
  nroDoc: string
  importeTotal: number
  importeNeto: number
  importeIVA: number
  importeExento: number
  importeTributos: number
  moneda: string // "PES" para pesos
  cotizacion: number // 1 para pesos
  alicuotas?: Array<{
    id: number // 3=0%, 4=10.5%, 5=21%, 6=27%
    baseImp: number
    importe: number
  }>
}

export interface AfipInvoiceResult {
  cae: string
  caeFchVto: string
  numero: number
  resultado: string
  observaciones?: string[]
  reproceso?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WSAA_URLS = {
  homologacion: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  produccion: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
}

const WSFE_URLS = {
  homologacion: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  produccion: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
}

// ─── Configuration ─────────────────────────────────────────────────────────────

/**
 * Get master AFIP configuration from environment variables
 */
export function getMasterAfipConfig(): MasterAfipConfig {
  const mode = (process.env.AFIP_MODE as "homologacion" | "produccion") || "homologacion"
  const providerCuit = process.env.AFIP_PROVIDER_CUIT || ""
  const cert = process.env.AFIP_MASTER_CERT || ""
  const key = process.env.AFIP_MASTER_KEY || ""

  if (!providerCuit || !cert || !key) {
    throw new Error(
      "Missing AFIP master configuration. Please set AFIP_PROVIDER_CUIT, AFIP_MASTER_CERT, and AFIP_MASTER_KEY environment variables."
    )
  }

  // Replace \n with actual newlines if they're escaped in env vars
  const certPem = cert.replace(/\\n/g, "\n")
  const keyPem = key.replace(/\\n/g, "\n")

  return {
    mode,
    providerCuit,
    cert: certPem,
    key: keyPem,
  }
}

// ─── WSAA: Authentication ─────────────────────────────────────────────────────

/**
 * Generate Login Ticket Request (TRA) for WSAA
 */
function generateTRA(service: string = "wsfe"): string {
  const now = new Date()
  const generationTime = now.toISOString()
  const expirationTime = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString() // 12 hours

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Date.now()}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`

  return tra
}

/**
 * Sign TRA with private key and certificate
 */
function signTRA(tra: string, privateKey: string, certificate: string): string {
  try {
    // Create PKCS#7 signed data
    const sign = createSign("SHA256")
    sign.update(tra)
    sign.end()

    const signature = sign.sign(privateKey, "base64")

    // Create CMS (Cryptographic Message Syntax) structure
    // For AFIP, we need to create a PKCS#7 signed message
    const cms = Buffer.from(
      `-----BEGIN PKCS7-----\n${signature}\n-----END PKCS7-----`
    ).toString("base64")

    return cms
  } catch (error) {
    console.error("Error signing TRA:", error)
    throw new Error("Error al firmar el TRA")
  }
}

/**
 * Call WSAA to get authentication credentials using master certificate
 */
export async function getAfipCredentials(
  masterConfig: MasterAfipConfig
): Promise<AfipCredentials> {
  try {
    const tra = generateTRA("wsfe")
    const cms = signTRA(tra, masterConfig.key, masterConfig.cert)

    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

    const url = WSAA_URLS[masterConfig.mode]
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: soapRequest,
    })

    if (!response.ok) {
      throw new Error(`WSAA HTTP error: ${response.status}`)
    }

    const xmlResponse = await response.text()
    const parsed = await parseStringPromise(xmlResponse)

    const loginCmsReturn =
      parsed["soapenv:Envelope"]["soapenv:Body"][0]["loginCmsReturn"][0]

    const credentials = await parseStringPromise(loginCmsReturn)
    const token = credentials.loginTicketResponse.credentials[0].token[0]
    const sign = credentials.loginTicketResponse.credentials[0].sign[0]
    const expirationTime =
      credentials.loginTicketResponse.header[0].expirationTime[0]

    return {
      token,
      sign,
      expiresAt: new Date(expirationTime),
    }
  } catch (error) {
    console.error("Error getting AFIP credentials:", error)
    throw new Error("Error al obtener credenciales de AFIP")
  }
}

// ─── WSFEv1: Electronic Invoicing ─────────────────────────────────────────────

/**
 * Get last authorized invoice number for a tenant
 */
export async function getLastInvoiceNumber(
  masterConfig: MasterAfipConfig,
  tenantConfig: TenantAfipConfig,
  credentials: AfipCredentials,
  invoiceType: number
): Promise<number> {
  try {
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${credentials.token}</ar:Token>
        <ar:Sign>${credentials.sign}</ar:Sign>
        <ar:Cuit>${tenantConfig.tenantCuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${tenantConfig.puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${invoiceType}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`

    const url = WSFE_URLS[masterConfig.mode]
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
      },
      body: soapRequest,
    })

    if (!response.ok) {
      throw new Error(`WSFEv1 HTTP error: ${response.status}`)
    }

    const xmlResponse = await response.text()
    const parsed = await parseStringPromise(xmlResponse)

    const result =
      parsed["soap:Envelope"]["soap:Body"][0]["FECompUltimoAutorizadoResponse"][0][
        "FECompUltimoAutorizadoResult"
      ][0]

    const lastNumber = parseInt(result.CbteNro[0]) || 0
    return lastNumber
  } catch (error) {
    console.error("Error getting last invoice number:", error)
    return 0 // Si hay error, empezar desde 0
  }
}

/**
 * Generate CAE (Código de Autorización Electrónica) for a tenant's invoice
 */
export async function generateCAE(
  masterConfig: MasterAfipConfig,
  tenantConfig: TenantAfipConfig,
  credentials: AfipCredentials,
  invoice: AfipInvoiceData
): Promise<AfipInvoiceResult> {
  try {
    // Build alicuotas (IVA rates) XML
    let alicuotasXml = ""
    if (invoice.alicuotas && invoice.alicuotas.length > 0) {
      alicuotasXml = "<ar:Iva>"
      invoice.alicuotas.forEach((alicuota) => {
        alicuotasXml += `
          <ar:AlicIva>
            <ar:Id>${alicuota.id}</ar:Id>
            <ar:BaseImp>${alicuota.baseImp.toFixed(2)}</ar:BaseImp>
            <ar:Importe>${alicuota.importe.toFixed(2)}</ar:Importe>
          </ar:AlicIva>`
      })
      alicuotasXml += "</ar:Iva>"
    }

    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${credentials.token}</ar:Token>
        <ar:Sign>${credentials.sign}</ar:Sign>
        <ar:Cuit>${tenantConfig.tenantCuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${invoice.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${invoice.tipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${invoice.concepto}</ar:Concepto>
            <ar:DocTipo>${invoice.tipoDoc}</ar:DocTipo>
            <ar:DocNro>${invoice.nroDoc}</ar:DocNro>
            <ar:CbteDesde>${invoice.numero}</ar:CbteDesde>
            <ar:CbteHasta>${invoice.numero}</ar:CbteHasta>
            <ar:CbteFch>${invoice.fecha}</ar:CbteFch>
            <ar:ImpTotal>${invoice.importeTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${invoice.importeNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${invoice.importeExento.toFixed(2)}</ar:ImpOpEx>
            <ar:ImpTrib>${invoice.importeTributos.toFixed(2)}</ar:ImpTrib>
            <ar:ImpIVA>${invoice.importeIVA.toFixed(2)}</ar:ImpIVA>
            <ar:MonId>${invoice.moneda}</ar:MonId>
            <ar:MonCotiz>${invoice.cotizacion}</ar:MonCotiz>
            ${alicuotasXml}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`

    const url = WSFE_URLS[masterConfig.mode]
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
      },
      body: soapRequest,
    })

    if (!response.ok) {
      throw new Error(`WSFEv1 HTTP error: ${response.status}`)
    }

    const xmlResponse = await response.text()
    const parsed = await parseStringPromise(xmlResponse)

    const result =
      parsed["soap:Envelope"]["soap:Body"][0]["FECAESolicitarResponse"][0][
        "FECAESolicitarResult"
      ][0]

    // Check for errors
    if (result.Errors) {
      const errors = result.Errors[0].Err || []
      const errorMessages = errors.map((err: any) => err.Msg[0]).join(", ")
      throw new Error(`AFIP Error: ${errorMessages}`)
    }

    const detResponse = result.FeDetResp[0].FECAEDetResponse[0]

    return {
      cae: detResponse.CAE[0],
      caeFchVto: detResponse.CAEFchVto[0],
      numero: invoice.numero,
      resultado: detResponse.Resultado[0],
      observaciones: detResponse.Observaciones
        ? detResponse.Observaciones[0].Obs?.map((obs: any) => obs.Msg[0])
        : undefined,
    }
  } catch (error) {
    console.error("Error generating CAE:", error)
    throw error
  }
}

/**
 * Test AFIP connection for a tenant
 */
export async function testAfipConnection(
  masterConfig: MasterAfipConfig,
  tenantConfig: TenantAfipConfig,
  credentials: AfipCredentials
): Promise<boolean> {
  try {
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEDummy/>
  </soapenv:Body>
</soapenv:Envelope>`

    const url = WSFE_URLS[masterConfig.mode]
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FEDummy",
      },
      body: soapRequest,
    })

    return response.ok
  } catch (error) {
    console.error("Error testing AFIP connection:", error)
    return false
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get invoice type code based on letter and customer type
 */
export function getInvoiceTypeCode(letter: "A" | "B" | "C"): number {
  const types: Record<string, number> = {
    A: 1,
    B: 6,
    C: 11,
  }
  return types[letter] || 6
}

/**
 * Get document type code
 */
export function getDocumentTypeCode(docType: string): number {
  const types: Record<string, number> = {
    CUIT: 80,
    CUIL: 86,
    DNI: 96,
    "Consumidor Final": 99,
  }
  return types[docType] || 99
}

/**
 * Get IVA alicuota code
 */
export function getIVACode(rate: number): number {
  const codes: Record<number, number> = {
    0: 3,
    10.5: 4,
    21: 5,
    27: 6,
  }
  return codes[rate] || 5
}

/**
 * Format date for AFIP (YYYYMMDD)
 */
export function formatAfipDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}
