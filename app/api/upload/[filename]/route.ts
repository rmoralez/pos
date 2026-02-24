import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

/**
 * GET /api/upload/[filename]
 * Download/view an uploaded file
 * Validates user has access to the file based on tenant ownership
 */
export async function GET(
  req: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const filename = params.filename

    // Determine document type from filename
    let directory: string
    let recordId: string | null = null

    if (filename.startsWith("po-")) {
      directory = "purchase-orders"
      // Extract ID from filename (format: po-{id}-{documentType}-{timestamp}.ext)
      const parts = filename.split("-")
      if (parts.length >= 2) {
        recordId = parts[1]
      }
    } else if (filename.startsWith("si-")) {
      directory = "supplier-invoices"
      // Extract ID from filename (format: si-{id}-{timestamp}.ext)
      const parts = filename.split("-")
      if (parts.length >= 2) {
        recordId = parts[1]
      }
    } else {
      return NextResponse.json(
        { error: "Invalid filename format" },
        { status: 400 }
      )
    }

    // Verify user has access to the record
    if (recordId) {
      if (directory === "purchase-orders") {
        const purchaseOrder = await prisma.purchaseOrder.findFirst({
          where: {
            id: recordId,
            tenantId: user.tenantId,
          },
        })

        if (!purchaseOrder) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          )
        }
      } else if (directory === "supplier-invoices") {
        const supplierInvoice = await prisma.supplierInvoice.findFirst({
          where: {
            id: recordId,
            tenantId: user.tenantId,
          },
        })

        if (!supplierInvoice) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          )
        }
      }
    }

    // Read file
    const filePath = join(process.cwd(), "documents", directory, filename)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    const fileBuffer = await readFile(filePath)

    // Determine content type from extension
    const extension = filename.split(".").pop()?.toLowerCase()
    let contentType = "application/octet-stream"

    switch (extension) {
      case "pdf":
        contentType = "application/pdf"
        break
      case "png":
        contentType = "image/png"
        break
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg"
        break
    }

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("GET upload/[filename] error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    )
  }
}
