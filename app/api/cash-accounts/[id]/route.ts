import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/cash-accounts/[id]
 * Returns account detail with movement history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  const account = await prisma.cashAccount.findFirst({
    where: { id: params.id, tenantId },
    include: {
      supplier: { select: { id: true, name: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { name: true } },
          movementType: true,
        },
      },
    },
  })

  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 })
  }

  return NextResponse.json(account)
}

/**
 * PATCH /api/cash-accounts/[id]
 * Update account name, description, or active status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = user.tenantId

  try {
    const body = await request.json()
    const { name, description, isActive } = body

    const account = await prisma.cashAccount.update({
      where: { id: params.id, tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(account)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno"
    console.error("Patch cash account error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
