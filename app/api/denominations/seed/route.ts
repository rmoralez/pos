import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

const DEFAULT_DENOMINATIONS = [
  { value: 1000, label: "$1.000", sortOrder: 1 },
  { value: 500, label: "$500", sortOrder: 2 },
  { value: 200, label: "$200", sortOrder: 3 },
  { value: 100, label: "$100", sortOrder: 4 },
  { value: 50, label: "$50", sortOrder: 5 },
  { value: 20, label: "$20", sortOrder: 6 },
  { value: 10, label: "$10", sortOrder: 7 },
  { value: 5, label: "$5", sortOrder: 8 },
  { value: 2, label: "$2", sortOrder: 9 },
  { value: 1, label: "$1", sortOrder: 10 },
  { value: 0.50, label: "$0,50", sortOrder: 11 },
  { value: 0.25, label: "$0,25", sortOrder: 12 },
  { value: 0.10, label: "$0,10", sortOrder: 13 },
  { value: 0.05, label: "$0,05", sortOrder: 14 },
]

// POST /api/denominations/seed - Seed default denominations
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Only ADMIN can seed denominations
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para inicializar denominaciones" },
        { status: 403 }
      )
    }

    // Check if tenant already has denominations
    const existingCount = await prisma.cashDenomination.count({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
    })

    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Ya existen denominaciones configuradas para este tenant" },
        { status: 400 }
      )
    }

    // Create all default denominations
    const created = await prisma.cashDenomination.createMany({
      data: DEFAULT_DENOMINATIONS.map((denom) => ({
        ...denom,
        tenantId: user.tenantId,
      })),
    })

    return NextResponse.json({
      message: `${created.count} denominaciones creadas exitosamente`,
      count: created.count,
    })
  } catch (error: any) {
    console.error("Seed denominations error:", error)
    return NextResponse.json(
      { error: "Error al inicializar denominaciones" },
      { status: 500 }
    )
  }
}
