import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"

const variantAttributeSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  displayName: z.string().min(1, "El nombre para mostrar es requerido"),
  sortOrder: z.number().int().min(0).optional(),
})

// GET /api/variant-attributes - List all variant attributes for tenant
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const attributes = await prisma.variantAttribute.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    })

    return NextResponse.json(attributes)
  } catch (error: any) {
    console.error("GET variant-attributes error:", error)
    return NextResponse.json(
      { error: "Error al obtener atributos de variantes" },
      { status: 500 }
    )
  }
}

// POST /api/variant-attributes - Create a new variant attribute
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can manage variant attributes
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar atributos de variantes" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validatedData = variantAttributeSchema.parse(body)

    // Check if attribute with same name already exists for this tenant
    const existing = await prisma.variantAttribute.findFirst({
      where: {
        tenantId: user.tenantId,
        name: validatedData.name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un atributo con ese nombre" },
        { status: 400 }
      )
    }

    const attribute = await prisma.variantAttribute.create({
      data: {
        tenantId: user.tenantId,
        name: validatedData.name,
        displayName: validatedData.displayName,
        sortOrder: validatedData.sortOrder ?? 0,
      },
    })

    return NextResponse.json(attribute, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      )
    }

    console.error("POST variant-attribute error:", error)
    return NextResponse.json(
      { error: "Error al crear atributo de variante" },
      { status: 500 }
    )
  }
}
