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
  condicionIva: number // 1=Responsable Inscripto, 4=Sujeto Exento, 5=Consumidor Final, 6=Monotributo
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

// ─── Token Cache ───────────────────────────────────────────────────────────────

/**
 * In-memory cache for AFIP credentials
 * Key: providerCuit + mode
 * Value: AfipCredentials with expiration
 */
const credentialsCache = new Map<string, AfipCredentials>()

function getCacheKey(providerCuit: string, mode: string): string {
  return `${providerCuit}-${mode}`
}

function getCachedCredentials(providerCuit: string, mode: string): AfipCredentials | null {
  const key = getCacheKey(providerCuit, mode)
  const cached = credentialsCache.get(key)

  if (!cached) {
    return null
  }

  // Check if token is still valid (with 5 minute buffer)
  const now = new Date()
  const expiresAt = new Date(cached.expiresAt)
  const bufferMs = 5 * 60 * 1000 // 5 minutes

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return cached
  }

  // Token expired or about to expire, remove from cache
  credentialsCache.delete(key)
  return null
}

function setCachedCredentials(
  providerCuit: string,
  mode: string,
  credentials: AfipCredentials
): void {
  const key = getCacheKey(providerCuit, mode)
  credentialsCache.set(key, credentials)
}

/**
 * Manually populate the credentials cache (for recovery when AFIP rate-limits us)
 * @param providerCuit The provider's CUIT
 * @param mode The AFIP mode (homologacion or produccion)
 * @param credentials The credentials to cache
 */
export function manuallyPopulateCache(
  providerCuit: string,
  mode: string,
  credentials: AfipCredentials
): void {
  setCachedCredentials(providerCuit, mode, credentials)
  console.log(`✅ AFIP credentials manually cached for ${providerCuit} in ${mode} mode`)
  console.log(`   Expires at: ${credentials.expiresAt}`)
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

  // AFIP requires ISO 8601 format with Argentina timezone: YYYY-MM-DDTHH:MM:SS-03:00
  // We need to convert UTC time to Argentina time (UTC-3)
  const argentinaOffset = -3 * 60 // -180 minutes
  const argentinaTime = new Date(now.getTime() + argentinaOffset * 60 * 1000)
  const generationTime = argentinaTime.toISOString().replace(/\.\d{3}Z$/, '') + '-03:00'

  const expirationDate = new Date(argentinaTime.getTime() + 12 * 60 * 60 * 1000) // 12 hours
  const expirationTime = expirationDate.toISOString().replace(/\.\d{3}Z$/, '') + '-03:00'

  // uniqueId must be unsignedInt (32-bit max: 4,294,967,295)
  // Use Math.floor(Date.now() / 1000) to get seconds instead of milliseconds
  const uniqueId = Math.floor(Date.now() / 1000)

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`

  return tra
}

/**
 * Sign TRA with private key and certificate using OpenSSL
 */
function signTRA(tra: string, privateKey: string, certificate: string): string {
  try {
    const { execSync } = require("child_process")
    const fs = require("fs")
    const path = require("path")
    const os = require("os")

    // Create temp directory for files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "afip-"))
    const traFile = path.join(tmpDir, "tra.xml")
    const keyFile = path.join(tmpDir, "private.key")
    const userCertFile = path.join(tmpDir, "user-cert.pem")
    const chainFile = path.join(tmpDir, "chain.pem")
    const cmsFile = path.join(tmpDir, "tra.cms")

    try {
      // Extract only the user certificate (first cert in chain) for signing
      // AFIP requires signing with only the user cert, not the full chain
      const certMatch = certificate.match(/(-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----)/)
      if (!certMatch) {
        throw new Error("No se pudo extraer el certificado de usuario")
      }
      const userCert = certMatch[1]

      // Extract CA chain (all certs except the first one) for verification
      const allCerts = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || []
      const caChain = allCerts.slice(1).join("\n")

      // Write files
      fs.writeFileSync(traFile, tra, "utf8")
      fs.writeFileSync(keyFile, privateKey, "utf8")
      fs.writeFileSync(userCertFile, userCert, "utf8")
      if (caChain) {
        fs.writeFileSync(chainFile, caChain, "utf8")
      }

      // Sign with OpenSSL to create proper PKCS#7 CMS
      // Use -signer with user cert only, -certfile with CA chain for verification
      const signCmd = caChain
        ? `openssl smime -sign -in "${traFile}" -out "${cmsFile}" -signer "${userCertFile}" -inkey "${keyFile}" -certfile "${chainFile}" -outform DER -nodetach`
        : `openssl smime -sign -in "${traFile}" -out "${cmsFile}" -signer "${userCertFile}" -inkey "${keyFile}" -outform DER -nodetach`

      execSync(signCmd, { stdio: "pipe" })

      // Read CMS and convert to base64
      const cms = fs.readFileSync(cmsFile)
      const cmsBase64 = cms.toString("base64")

      return cmsBase64
    } finally {
      // Cleanup temp files
      try {
        fs.unlinkSync(traFile)
        fs.unlinkSync(keyFile)
        fs.unlinkSync(userCertFile)
        if (fs.existsSync(chainFile)) fs.unlinkSync(chainFile)
        if (fs.existsSync(cmsFile)) fs.unlinkSync(cmsFile)
        fs.rmdirSync(tmpDir)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error("Error signing TRA:", error)
    throw new Error("Error al firmar el TRA con OpenSSL")
  }
}

/**
 * Call WSAA to get authentication credentials using master certificate
 * Uses in-memory cache to avoid unnecessary AFIP requests
 */
export async function getAfipCredentials(
  masterConfig: MasterAfipConfig
): Promise<AfipCredentials> {
  // Check cache first
  const cached = getCachedCredentials(masterConfig.providerCuit, masterConfig.mode)
  if (cached) {
    console.log("Using cached AFIP credentials")
    return cached
  }

  console.log("Requesting new AFIP credentials from WSAA...")

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

    const xmlResponse = await response.text()

    console.log("AFIP WSAA Response status:", response.status)
    console.log("AFIP WSAA Response (first 500 chars):", xmlResponse.substring(0, 500))

    if (!response.ok) {
      console.error("AFIP WSAA Error Response:", xmlResponse)

      // Check if error is "already authenticated" - this means a valid token exists in AFIP's system
      if (xmlResponse.includes("coe.alreadyAuthenticated")) {
        console.warn(
          "AFIP reports certificate already authenticated. Existing token is still valid in AFIP's system."
        )
        // We'll retry in a moment - AFIP tokens last ~12 hours, but sometimes this error clears quickly
        throw new Error(
          "Ya existe una autenticación válida en AFIP. Por favor, intente nuevamente en unos minutos."
        )
      }

      throw new Error(`WSAA HTTP error: ${response.status}`)
    }

    const parsed = await parseStringPromise(xmlResponse)

    // Add validation for parsed structure
    if (!parsed || !parsed["soapenv:Envelope"]) {
      console.error("Invalid WSAA response structure:", JSON.stringify(parsed, null, 2))
      throw new Error("Respuesta WSAA inválida: estructura no reconocida")
    }

    const envelope = parsed["soapenv:Envelope"]
    if (!envelope["soapenv:Body"] || !envelope["soapenv:Body"][0]) {
      console.error("Missing soapenv:Body in response:", JSON.stringify(envelope, null, 2))
      throw new Error("Respuesta WSAA inválida: falta elemento Body")
    }

    const body = envelope["soapenv:Body"][0]

    // AFIP wraps the response in loginCmsResponse
    if (!body["loginCmsResponse"] || !body["loginCmsResponse"][0]) {
      console.error("Missing loginCmsResponse in body:", JSON.stringify(body, null, 2))
      throw new Error("Respuesta WSAA inválida: falta elemento loginCmsResponse")
    }

    const loginCmsResponse = body["loginCmsResponse"][0]

    if (!loginCmsResponse["loginCmsReturn"] || !loginCmsResponse["loginCmsReturn"][0]) {
      console.error("Missing loginCmsReturn in loginCmsResponse:", JSON.stringify(loginCmsResponse, null, 2))
      throw new Error("Respuesta WSAA inválida: falta elemento loginCmsReturn")
    }

    const loginCmsReturn = loginCmsResponse["loginCmsReturn"][0]

    const credentials = await parseStringPromise(loginCmsReturn)

    // Validate credentials structure
    if (!credentials || !credentials.loginTicketResponse) {
      console.error("Invalid credentials structure:", JSON.stringify(credentials, null, 2))
      throw new Error("Respuesta WSAA inválida: estructura de credenciales incorrecta")
    }

    const ticketResponse = credentials.loginTicketResponse
    if (!ticketResponse.credentials || !ticketResponse.credentials[0]) {
      console.error("Missing credentials in ticket:", JSON.stringify(ticketResponse, null, 2))
      throw new Error("Respuesta WSAA inválida: faltan credenciales")
    }

    const creds = ticketResponse.credentials[0]
    if (!creds.token || !creds.token[0] || !creds.sign || !creds.sign[0]) {
      console.error("Missing token or sign:", JSON.stringify(creds, null, 2))
      throw new Error("Respuesta WSAA inválida: falta token o sign")
    }

    if (!ticketResponse.header || !ticketResponse.header[0] || !ticketResponse.header[0].expirationTime || !ticketResponse.header[0].expirationTime[0]) {
      console.error("Missing expiration time:", JSON.stringify(ticketResponse.header, null, 2))
      throw new Error("Respuesta WSAA inválida: falta tiempo de expiración")
    }

    const token = creds.token[0]
    const sign = creds.sign[0]
    const expirationTime = ticketResponse.header[0].expirationTime[0]

    const afipCredentials = {
      token,
      sign,
      expiresAt: new Date(expirationTime),
    }

    // Cache the credentials
    setCachedCredentials(masterConfig.providerCuit, masterConfig.mode, afipCredentials)
    console.log("AFIP credentials cached until:", afipCredentials.expiresAt)

    return afipCredentials
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
    // For Factura C (tipo 11), IVA is not itemized
    // IVA is included in the price and we send ImpOpEx instead
    const isFacturaC = invoice.tipo === 11

    // Build alicuotas (IVA rates) XML - only for Facturas A and B
    let alicuotasXml = ""
    if (!isFacturaC && invoice.alicuotas && invoice.alicuotas.length > 0) {
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

    // For Factura C: IVA is included in price, so:
    // - ImpNeto = Total (price with IVA included)
    // - ImpOpEx = 0 (must be zero for type C)
    // - ImpIVA = 0 (IVA is not itemized)
    // For Factura A/B: Normal breakdown with IVA
    const impNeto = isFacturaC ? invoice.importeTotal : invoice.importeNeto
    const impOpEx = 0 // Always 0
    const impIVA = isFacturaC ? 0 : invoice.importeIVA

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
            <ar:ImpNeto>${impNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${impOpEx.toFixed(2)}</ar:ImpOpEx>
            <ar:ImpTrib>${invoice.importeTributos.toFixed(2)}</ar:ImpTrib>
            <ar:ImpIVA>${impIVA.toFixed(2)}</ar:ImpIVA>
            <ar:MonId>${invoice.moneda}</ar:MonId>
            <ar:MonCotiz>${invoice.cotizacion}</ar:MonCotiz>
            <ar:CondicionIVAReceptorId>${invoice.condicionIva}</ar:CondicionIVAReceptorId>
            ${alicuotasXml}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`

    console.log("[AFIP] Sending SOAP request (first 1000 chars):", soapRequest.substring(0, 1000))

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
    console.log("[AFIP] Full SOAP response:", xmlResponse.substring(0, 2000))

    const parsed = await parseStringPromise(xmlResponse)

    const result =
      parsed["soap:Envelope"]["soap:Body"][0]["FECAESolicitarResponse"][0][
        "FECAESolicitarResult"
      ][0]

    console.log("[AFIP] Parsed result:", JSON.stringify(result, null, 2).substring(0, 1500))

    // Check for errors
    if (result.Errors) {
      const errors = result.Errors[0].Err || []
      const errorMessages = errors.map((err: any) => `Code ${err.Code[0]}: ${err.Msg[0]}`).join(", ")
      console.error("[AFIP] Errors:", JSON.stringify(errors, null, 2))
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
