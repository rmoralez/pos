import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { writeFile } from "fs/promises"
import { join } from "path"
import { existsSync, mkdirSync } from "fs"

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type DocumentType = "purchase-order" | "supplier-invoice"

/**
 * POST /api/upload
 * Upload a file (scanned invoice, remito, etc.)
 * Query params: type (purchase-order | supplier-invoice), id (record ID), documentType (invoice | remito)
 * Body: FormData with file
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") as DocumentType | null
    const id = searchParams.get("id")
    const documentType = searchParams.get("documentType") || "invoice" // invoice | remito

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing required parameters: type and id" },
        { status: 400 }
      )
    }

    if (type !== "purchase-order" && type !== "supplier-invoice") {
      return NextResponse.json(
        { error: "Invalid type. Must be 'purchase-order' or 'supplier-invoice'" },
        { status: 400 }
      )
    }

    // Verify record exists and belongs to tenant
    if (type === "purchase-order") {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id,
          tenantId: user.tenantId,
        },
      })

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: "Purchase order not found" },
          { status: 404 }
        )
      }
    } else if (type === "supplier-invoice") {
      const supplierInvoice = await prisma.supplierInvoice.findFirst({
        where: {
          id,
          tenantId: user.tenantId,
        },
      })

      if (!supplierInvoice) {
        return NextResponse.json(
          { error: "Supplier invoice not found" },
          { status: 404 }
        )
      }
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF, PNG, and JPEG files are allowed" },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = file.name.split(".").pop()
    const prefix = type === "purchase-order" ? "po" : "si"
    const filename = `${prefix}-${id}-${documentType}-${timestamp}.${fileExtension}`

    // Determine directory
    const directory = type === "purchase-order" ? "purchase-orders" : "supplier-invoices"
    const uploadDir = join(process.cwd(), "documents", directory)

    // Ensure directory exists
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true })
    }

    // Save file
    const filePath = join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Return relative path for database storage
    const relativePath = `documents/${directory}/${filename}`

    return NextResponse.json({
      success: true,
      filePath: relativePath,
      filename,
    })
  } catch (error) {
    console.error("POST upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
