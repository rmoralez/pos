import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const alternativeCodeSchema = z.object({
  code: z.string().min(1),
  label: z.string().optional(),
  supplierId: z.string().optional(),
})

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the product belongs to this tenant
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const codes = await prisma.productAlternativeCode.findMany({
      where: { productId: params.id },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(codes)
  } catch (error) {
    console.error("GET alternative-codes error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
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

    const body = await req.json()
    const validatedData = alternativeCodeSchema.parse(body)

    const code = await prisma.productAlternativeCode.create({
      data: {
        productId: params.id,
        code: validatedData.code,
        label: validatedData.label,
        supplierId: validatedData.supplierId,
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(code, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST alternative-code error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
