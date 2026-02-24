import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/cash-accounts
 * List all cash accounts for the tenant.
 * Query params: active=false to include inactive ones.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get("active") !== "false"

  const accounts = await prisma.cashAccount.findMany({
    where: {
      tenantId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      _count: { select: { movements: true } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(accounts)
}

/**
 * POST /api/cash-accounts
 * Create a new cash account (envelope/fund) for the tenant.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  try {
    const body = await request.json()
    const { name, type, description, supplierId } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: "Nombre y tipo son requeridos" },
        { status: 400 }
      )
    }

    const validTypes = ["SUPPLIER", "OWNER", "OPERATIONAL", "BANK", "CASH", "OTHER"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo de cuenta inválido" }, { status: 400 })
    }

    const account = await prisma.cashAccount.create({
      data: {
        name,
        type,
        description: description || null,
        supplierId: supplierId || null,
        tenantId,
        currentBalance: 0,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Create cash account error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
