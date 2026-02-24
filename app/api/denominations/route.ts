import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

// GET /api/denominations - Get all active denominations for the tenant
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const denominations = await prisma.cashDenomination.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    })

    return NextResponse.json(denominations)
  } catch (error: any) {
    console.error("Get denominations error:", error)
    return NextResponse.json(
      { error: "Error al obtener denominaciones" },
      { status: 500 }
    )
  }
}

// POST /api/denominations - Create a new denomination
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can manage denominations
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar denominaciones" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { value, label } = body

    if (!value || !label) {
      return NextResponse.json(
        { error: "Valor y etiqueta son requeridos" },
        { status: 400 }
      )
    }

    // Check if denomination already exists
    const existing = await prisma.cashDenomination.findFirst({
      where: {
        tenantId: user.tenantId,
        value: parseFloat(value),
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Esta denominación ya existe" },
        { status: 400 }
      )
    }

    // Get the next sort order
    const maxSortOrder = await prisma.cashDenomination.findFirst({
      where: {
        tenantId: user.tenantId,
      },
      orderBy: {
        sortOrder: "desc",
      },
      select: {
        sortOrder: true,
      },
    })

    const denomination = await prisma.cashDenomination.create({
      data: {
        value: parseFloat(value),
        label,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
        tenantId: user.tenantId,
      },
    })

    return NextResponse.json(denomination, { status: 201 })
  } catch (error: any) {
    console.error("Create denomination error:", error)
    return NextResponse.json(
      { error: "Error al crear denominación" },
      { status: 500 }
    )
  }
}
