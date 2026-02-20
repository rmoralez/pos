import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const movementTypes = await prisma.movementType.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      include: {
        _count: {
          select: {
            cashTransactions: true,
          },
        },
      },
      orderBy: [
        { transactionType: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(movementTypes)
  } catch (error) {
    console.error("Error fetching movement types:", error)
    return NextResponse.json(
      { error: "Error al obtener tipos de movimiento" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, transactionType } = body

    // Validar campos requeridos
    if (!name || !transactionType) {
      return NextResponse.json(
        { error: "Nombre y tipo de transacción son requeridos" },
        { status: 400 }
      )
    }

    // Validar que el tipo de transacción sea válido
    if (transactionType !== "INCOME" && transactionType !== "EXPENSE") {
      return NextResponse.json(
        { error: "Tipo de transacción inválido" },
        { status: 400 }
      )
    }

    // Verificar que no exista un tipo de movimiento con el mismo nombre
    const existing = await prisma.movementType.findFirst({
      where: {
        tenantId: session.user.tenantId,
        name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un tipo de movimiento con ese nombre" },
        { status: 400 }
      )
    }

    const movementType = await prisma.movementType.create({
      data: {
        name,
        description,
        transactionType,
        tenantId: session.user.tenantId,
        isSystem: false,
        isActive: true,
      },
    })

    return NextResponse.json(movementType, { status: 201 })
  } catch (error) {
    console.error("Error creating movement type:", error)
    return NextResponse.json(
      { error: "Error al crear tipo de movimiento" },
      { status: 500 }
    )
  }
}
