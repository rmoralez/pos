import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

// Schema for opening a cash register
const openCashRegisterSchema = z.object({
  openingBalance: z.number().min(0),
  locationId: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/cash-registers
 * List cash registers with filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const locationId = searchParams.get("locationId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      tenantId: user.tenantId,
    }

    if (status === "OPEN" || status === "CLOSED") {
      where.status = status
    }

    if (locationId) {
      where.locationId = locationId
    }

    // Get cash registers
    const [cashRegisters, total] = await Promise.all([
      prisma.cashRegister.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              sales: true,
              transactions: true,
            },
          },
        },
        orderBy: {
          openedAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.cashRegister.count({ where }),
    ])

    return NextResponse.json({
      cashRegisters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching cash registers:", error)
    return NextResponse.json(
      { error: "Failed to fetch cash registers" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cash-registers
 * Open a new cash register
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getCurrentUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate user still exists in DB (JWT may be stale)
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, tenantId: true, locationId: true, isActive: true },
    })

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: "User not found or inactive" }, { status: 401 })
    }

    // Use DB values, not JWT values (JWT may be stale after DB changes)
    const user = {
      ...sessionUser,
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      locationId: dbUser.locationId,
    }

    const body = await request.json()
    const data = openCashRegisterSchema.parse(body)

    // Determine location - get or create default location if needed
    let locationId = data.locationId || user.locationId

    if (!locationId) {
      // Create or find default location for this tenant
      const defaultLocation = await prisma.location.findFirst({
        where: {
          tenantId: user.tenantId,
        },
      })

      if (!defaultLocation) {
        // Create a default location
        const newLocation = await prisma.location.create({
          data: {
            tenantId: user.tenantId,
            name: "Sucursal Principal",
            address: "",
          },
        })
        locationId = newLocation.id
      } else {
        locationId = defaultLocation.id
      }
    }

    // Check if there's already an open cash register for this location
    const existingOpen = await prisma.cashRegister.findFirst({
      where: {
        tenantId: user.tenantId,
        locationId,
        status: "OPEN",
      },
    })

    if (existingOpen) {
      return NextResponse.json(
        { error: "There is already an open cash register for this location" },
        { status: 400 }
      )
    }

    // Create new cash register and deduct from treasury account
    const cashRegister = await prisma.$transaction(async (tx) => {
      // Create cash register
      const register = await tx.cashRegister.create({
        data: {
          tenantId: user.tenantId,
          locationId,
          userId: user.id,
          openingBalance: data.openingBalance,
          status: "OPEN",
          notes: data.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // If there's an opening balance, deduct from main cash account
      if (data.openingBalance > 0) {
        // Find main cash account (Efectivo)
        const mainCashAccount = await tx.cashAccount.findFirst({
          where: {
            tenantId: user.tenantId,
            type: { in: ["CASH", "OPERATIONAL"] },
            name: { contains: "Efectivo", mode: "insensitive" },
            isActive: true,
          },
        })

        if (!mainCashAccount) {
          throw new Error("No se encontró la cuenta de efectivo en tesorería")
        }

        // Check if there's enough balance
        const currentBalance = Number(mainCashAccount.currentBalance)
        if (currentBalance < data.openingBalance) {
          throw new Error(
            `Saldo insuficiente en cuenta de efectivo. Disponible: $${currentBalance}, Requerido: $${data.openingBalance}`
          )
        }

        // Calculate new balance
        const balanceBefore = mainCashAccount.currentBalance
        const balanceAfter = Number(balanceBefore) - data.openingBalance

        // Create movement to deduct from cash account
        await tx.cashAccountMovement.create({
          data: {
            type: "TRANSFER_OUT",
            amount: data.openingBalance,
            concept: `Apertura de caja #${register.id.slice(-8)}`,
            balanceBefore,
            balanceAfter,
            reference: register.id,
            cashAccountId: mainCashAccount.id,
            tenantId: user.tenantId,
            userId: user.id,
          },
        })

        // Update cash account balance
        await tx.cashAccount.update({
          where: { id: mainCashAccount.id },
          data: { currentBalance: balanceAfter },
        })
      }

      return register
    })

    return NextResponse.json(cashRegister, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error opening cash register:", error)
    return NextResponse.json(
      { error: "Failed to open cash register" },
      { status: 500 }
    )
  }
}
