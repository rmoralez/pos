import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/payment-methods/accounts
 * List all payment method account mappings for the tenant.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const mappings = await prisma.paymentMethodAccount.findMany({
      where: {
        tenantId: user.tenantId,
      },
      include: {
        CashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        paymentMethod: "asc",
      },
    })

    return NextResponse.json(mappings)
  } catch (error) {
    console.error("Error fetching payment method accounts:", error)
    return NextResponse.json(
      { error: "Error al obtener mapeos de métodos de pago" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payment-methods/accounts
 * Create a new payment method account mapping.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is ADMIN or SUPER_ADMIN
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden crear mapeos" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { paymentMethod, cashAccountId } = body

    // Validate required fields
    if (!paymentMethod || !cashAccountId) {
      return NextResponse.json(
        { error: "Método de pago y cuenta son requeridos" },
        { status: 400 }
      )
    }

    // Validate payment method
    const validMethods = ["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "QR", "CHECK", "ACCOUNT", "OTHER"]
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Método de pago inválido" },
        { status: 400 }
      )
    }

    // Check if cash account exists and belongs to tenant
    const cashAccount = await prisma.cashAccount.findFirst({
      where: {
        id: cashAccountId,
        tenantId: user.tenantId,
      },
    })

    if (!cashAccount) {
      return NextResponse.json(
        { error: "La cuenta de efectivo no existe o no pertenece al tenant" },
        { status: 404 }
      )
    }

    if (!cashAccount.isActive) {
      return NextResponse.json(
        { error: "La cuenta de efectivo no está activa" },
        { status: 400 }
      )
    }

    // Check for duplicate mapping (same payment method for this tenant)
    const existing = await prisma.paymentMethodAccount.findUnique({
      where: {
        tenantId_paymentMethod: {
          tenantId: user.tenantId,
          paymentMethod,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un mapeo para este método de pago" },
        { status: 400 }
      )
    }

    // Create the mapping
    const mapping = await prisma.paymentMethodAccount.create({
      data: {
        id: `pma_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        paymentMethod,
        cashAccountId,
        tenantId: user.tenantId,
        updatedAt: new Date(),
      },
      include: {
        CashAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json(mapping, { status: 201 })
  } catch (error) {
    console.error("Error creating payment method account:", error)
    return NextResponse.json(
      { error: "Error al crear mapeo de método de pago" },
      { status: 500 }
    )
  }
}
