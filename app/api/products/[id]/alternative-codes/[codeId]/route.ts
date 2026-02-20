import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  label: z.string().optional().nullable(),
})

export async function PUT(
  req: Request,
  { params }: { params: { id: string; codeId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the product belongs to this tenant
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Verify the code belongs to this product
    const existing = await prisma.productAlternativeCode.findFirst({
      where: { id: params.codeId, productId: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = updateSchema.parse(body)

    const updated = await prisma.productAlternativeCode.update({
      where: { id: params.codeId },
      data: validatedData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT alternative-code error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; codeId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["SUPER_ADMIN", "ADMIN", "STOCK_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the product belongs to this tenant
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Verify the code belongs to this product
    const existing = await prisma.productAlternativeCode.findFirst({
      where: { id: params.codeId, productId: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 })
    }

    await prisma.productAlternativeCode.delete({
      where: { id: params.codeId },
    })

    return NextResponse.json({ message: "Code deleted successfully" })
  } catch (error) {
    console.error("DELETE alternative-code error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
