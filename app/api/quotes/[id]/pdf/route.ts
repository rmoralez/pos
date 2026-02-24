import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quote = await prisma.quote.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        tenant: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Generate simple HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Presupuesto ${quote.quoteNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .info-block {
      width: 48%;
    }
    .info-block h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
    }
    .info-block p {
      margin: 3px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead {
      background-color: #f5f5f5;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
    }
    .text-right {
      text-align: right;
    }
    .totals {
      float: right;
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .totals-row.total {
      font-size: 18px;
      font-weight: bold;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
      margin-top: 10px;
    }
    .notes {
      margin-top: 40px;
      padding: 15px;
      background-color: #f9f9f9;
      border-left: 4px solid #333;
    }
    .notes h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
      margin-left: 10px;
    }
    .status-DRAFT { background-color: #e0e0e0; color: #666; }
    .status-SENT { background-color: #2196F3; color: white; }
    .status-APPROVED { background-color: #4CAF50; color: white; }
    .status-REJECTED { background-color: #f44336; color: white; }
    .status-CONVERTED { background-color: #9C27B0; color: white; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${quote.tenant.name}</h1>
    <p>CUIT: ${quote.tenant.cuit}</p>
    ${quote.tenant.address ? `<p>${quote.tenant.address}</p>` : ''}
    ${quote.tenant.phone ? `<p>Tel: ${quote.tenant.phone}</p>` : ''}
  </div>

  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="margin: 0;">PRESUPUESTO
      <span class="status-badge status-${quote.status}">
        ${quote.status === 'DRAFT' ? 'BORRADOR' :
          quote.status === 'SENT' ? 'ENVIADO' :
          quote.status === 'APPROVED' ? 'APROBADO' :
          quote.status === 'REJECTED' ? 'RECHAZADO' : 'CONVERTIDO'}
      </span>
    </h2>
    <p style="font-size: 18px; margin: 10px 0;">${quote.quoteNumber}</p>
    <p style="color: #666;">Fecha: ${new Date(quote.createdAt).toLocaleDateString('es-AR')}</p>
    ${quote.validUntil ? `<p style="color: #666;">Válido hasta: ${new Date(quote.validUntil).toLocaleDateString('es-AR')}</p>` : ''}
  </div>

  <div class="info-section">
    <div class="info-block">
      <h3>Cliente</h3>
      ${quote.customer ? `
        <p><strong>${quote.customer.name}</strong></p>
        ${quote.customer.email ? `<p>${quote.customer.email}</p>` : ''}
        ${quote.customer.phone ? `<p>Tel: ${quote.customer.phone}</p>` : ''}
        ${quote.customer.documentNumber ? `<p>${quote.customer.documentType || 'DNI'}: ${quote.customer.documentNumber}</p>` : ''}
      ` : '<p>Cliente final</p>'}
    </div>
    <div class="info-block">
      <h3>Generado por</h3>
      <p>${quote.user.name || quote.user.email}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="text-right">Precio Unit.</th>
        <th class="text-right">Cantidad</th>
        <th class="text-right">Descuento</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${quote.items.map(item => `
        <tr>
          <td>${item.product?.name || 'Unknown Product'}</td>
          <td class="text-right">$${Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${Number(item.discount) > 0 ? Number(item.discount).toFixed(0) + '%' : '-'}</td>
          <td class="text-right">$${Number(item.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>$${Number(quote.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="totals-row">
      <span>IVA:</span>
      <span>$${Number(quote.taxAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
    ${Number(quote.discountAmount) > 0 ? `
    <div class="totals-row">
      <span>Descuento:</span>
      <span>-$${Number(quote.discountAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
    ` : ''}
    <div class="totals-row total">
      <span>TOTAL:</span>
      <span>$${Number(quote.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
  </div>

  ${quote.notes ? `
  <div class="notes">
    <h3>Notas</h3>
    <p>${quote.notes.replace(/\n/g, '<br>')}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Este presupuesto no constituye un comprobante fiscal válido.</p>
    <p>Generado el ${new Date().toLocaleString('es-AR')}</p>
  </div>
</body>
</html>
    `

    // Return HTML as PDF (browsers can handle printing to PDF)
    // For actual PDF generation, you would use a library like puppeteer or similar
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="presupuesto-${quote.quoteNumber}.html"`,
      },
    })
  } catch (error) {
    console.error("GET quote PDF error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
