import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import jsPDF from "jspdf"

/**
 * GET /api/sales/[id]/invoice-pdf
 * Generate PDF for sale invoice
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const saleId = params.id

    // Get sale with invoice
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        tenantId: user.tenantId,
      },
      include: {
        invoice: true,
        items: {
          include: {
            product: true,
            ProductVariant: true,
          },
        },
        customer: true,
        tenant: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    if (!sale.invoice) {
      return NextResponse.json(
        { error: "Esta venta no tiene factura electrónica" },
        { status: 404 }
      )
    }

    // Create PDF using jsPDF
    const pdfBuffer = generateInvoicePDF(sale, sale.invoice)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Factura-${sale.invoice.type}-${sale.invoice.puntoVenta.toString().padStart(5, "0")}-${sale.invoice.number.padStart(8, "0")}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("GET /api/sales/[id]/invoice-pdf error:", error)
    return NextResponse.json(
      { error: "Error al generar PDF" },
      { status: 500 }
    )
  }
}

function generateInvoicePDF(sale: any, invoice: any): ArrayBuffer {
  const doc = new jsPDF()
  const tenant = sale.tenant
  let y = 10

  // Top label - ORIGINAL
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text("ORIGINAL", 105, y, { align: "center" })
  y += 8

  // ==================== THREE COLUMN HEADER ====================
  const leftColX = 15
  const centerColX = 105
  const rightColX = 145
  const headerStartY = y

  // LEFT COLUMN - Company info
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(tenant.name || "Comercio", leftColX, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  if (tenant.address) {
    doc.text(tenant.address, leftColX, y)
    y += 5
  }
  doc.text(`CUIT: ${tenant.cuit}`, leftColX, y)
  y += 5
  doc.text("IVA Responsable Inscripto", leftColX, y)
  y += 5
  doc.text("Ingresos Brutos: Exento", leftColX, y)
  y += 5
  doc.text("Inicio de Actividades: 01/01/2024", leftColX, y)

  // CENTER COLUMN - Invoice type in box (7cm x 3cm minimum per AFIP spec)
  const boxWidth = 35
  const boxHeight = 35
  const boxX = centerColX - boxWidth / 2
  const boxY = headerStartY

  // Draw double border box
  doc.setLineWidth(0.5)
  doc.rect(boxX, boxY, boxWidth, boxHeight)
  doc.rect(boxX + 1, boxY + 1, boxWidth - 2, boxHeight - 2)

  // Letter in center
  doc.setFontSize(48)
  doc.setFont("helvetica", "bold")
  doc.text(invoice.type, centerColX, boxY + 22, { align: "center" })

  // Codigo below letter
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`COD. ${invoice.type === "A" ? "01" : invoice.type === "B" ? "06" : "11"}`, centerColX, boxY + 30, {
    align: "center",
  })

  // RIGHT COLUMN - Invoice details
  y = headerStartY
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURA", rightColX, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(
    `Punto de Venta: ${invoice.puntoVenta.toString().padStart(5, "0")}`,
    rightColX,
    y
  )
  y += 5
  doc.text(
    `Comp. Nro: ${invoice.number.padStart(8, "0")}`,
    rightColX,
    y
  )
  y += 5
  doc.text(
    `Fecha: ${new Date(sale.createdAt).toLocaleDateString("es-AR")}`,
    rightColX,
    y
  )
  y += 5
  doc.text(`CUIT: ${tenant.cuit}`, rightColX, y)

  // Move Y position past the header
  y = headerStartY + boxHeight + 10

  // ==================== CUSTOMER SECTION ====================
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("DATOS DEL COMPRADOR", leftColX, y)
  y += 6

  doc.setFont("helvetica", "normal")
  const customerCuit = invoice.customerDocType === "80" ? invoice.customerDocNum : "-"
  const customerDoc =
    invoice.customerDocType === "96"
      ? `DNI ${invoice.customerDocNum}`
      : invoice.customerDocType === "80"
        ? ""
        : "Consumidor Final"

  doc.text(`Apellido y Nombre / Razón Social: ${invoice.customerName}`, leftColX, y)
  y += 5
  doc.text(`CUIT: ${customerCuit}`, leftColX, y)
  y += 5
  doc.text(
    `Condición frente al IVA: ${invoice.customerDocType === "80" ? "Responsable Inscripto" : "Consumidor Final"}`,
    leftColX,
    y
  )
  y += 5
  doc.text(`Domicilio: ${sale.customer?.address || "-"}`, leftColX, y)
  y += 5
  if (customerDoc) {
    doc.text(customerDoc, leftColX, y)
    y += 5
  }

  y += 5

  // ==================== ITEMS TABLE ====================
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")

  // Table header
  const col1 = 15  // Codigo
  const col2 = 35  // Descripcion
  const col3 = 115 // Cantidad
  const col4 = 140 // P. Unit.
  const col5 = 165 // % Bonif.
  const col6 = 185 // Subtotal

  doc.text("Código", col1, y)
  doc.text("Producto / Servicio", col2, y)
  doc.text("Cant.", col3, y)
  doc.text("P. Unit.", col4, y)
  doc.text("% Bonif.", col5, y, { align: "right" })
  doc.text("Subtotal", col6, y, { align: "right" })
  y += 5

  // Horizontal line under header
  doc.setLineWidth(0.3)
  doc.line(15, y, 195, y)
  y += 5

  // Items
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)

  for (const item of sale.items) {
    const productName = item.ProductVariant
      ? `${item.product.name} - ${item.ProductVariant.sku}`
      : item.product.name

    doc.text(item.product.sku || "-", col1, y)
    doc.text(productName.substring(0, 40), col2, y)
    doc.text(item.quantity.toString(), col3, y)
    doc.text(`$${Number(item.unitPrice).toFixed(2)}`, col4, y)
    doc.text("0.00", col5, y, { align: "right" })
    doc.text(`$${Number(item.total).toFixed(2)}`, col6, y, { align: "right" })
    y += 5
  }

  y += 5

  // ==================== TOTALS SECTION ====================
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  // Right-aligned totals
  const totalLabelX = 140
  const totalValueX = 195

  // For Factura C, IVA is included (not itemized separately)
  if (invoice.type === "C") {
    doc.text("Importe Total:", totalLabelX, y)
    doc.text(`$ ${Number(sale.total).toFixed(2)}`, totalValueX, y, { align: "right" })
  } else {
    // For Factura A/B, show IVA breakdown
    doc.text("Subtotal:", totalLabelX, y)
    doc.text(`$ ${Number(sale.subtotal).toFixed(2)}`, totalValueX, y, { align: "right" })
    y += 5

    if (Number(sale.taxAmount) > 0) {
      doc.text("IVA 21%:", totalLabelX, y)
      doc.text(`$ ${Number(sale.taxAmount).toFixed(2)}`, totalValueX, y, { align: "right" })
      y += 5
    }

    if (Number(sale.discountAmount) > 0) {
      doc.text("Descuento:", totalLabelX, y)
      doc.text(`- $ ${Number(sale.discountAmount).toFixed(2)}`, totalValueX, y, { align: "right" })
      y += 5
    }

    doc.setFont("helvetica", "bold")
    doc.text("Importe Total:", totalLabelX, y)
    doc.text(`$ ${Number(sale.total).toFixed(2)}`, totalValueX, y, { align: "right" })
  }

  // ==================== FOOTER - CAE & QR ====================
  y = 260 // Fixed position near bottom

  // Horizontal line above footer
  doc.setLineWidth(0.5)
  doc.line(15, y, 195, y)
  y += 8

  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("COMPROBANTE AUTORIZADO", 105, y, { align: "center" })
  y += 5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)

  if (invoice.cae) {
    // Left side - CAE info
    doc.text(`CAE N°: ${invoice.cae}`, leftColX, y)
    doc.text(
      `Fecha de Vto. de CAE: ${new Date(invoice.caeExpiration).toLocaleDateString("es-AR")}`,
      leftColX,
      y + 5
    )

    // Right side - QR code placeholder
    const qrSize = 25
    const qrX = 165
    const qrY = y - 5

    doc.setLineWidth(0.3)
    doc.rect(qrX, qrY, qrSize, qrSize)
    doc.setFontSize(6)
    doc.text("Código QR", qrX + qrSize / 2, qrY + qrSize / 2, { align: "center" })
    doc.text("AFIP", qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: "center" })
  }

  // Return PDF as ArrayBuffer
  return doc.output("arraybuffer") as ArrayBuffer
}
