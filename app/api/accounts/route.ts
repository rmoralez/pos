import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

/**
 * GET /api/accounts
 * List customer accounts with their balances and movements
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") // "active" | "overdue" | "all"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      tenantId: user.tenantId,
      account: {
        isNot: null, // Only customers with accounts
      },
    }

    // Search by customer name, email, phone, document
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    // Filter by status
    if (status === "active") {
      where.account = {
        ...where.account,
        isActive: true,
      }
    } else if (status === "overdue") {
      where.account = {
        ...where.account,
        isActive: true,
        balance: {
          lt: 0, // Negative balance = customer owes money
        },
      }
    }

    // Get customers with accounts
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          account: {
            include: {
              movements: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 10, // Last 10 movements
                include: {
                  sale: {
                    select: {
                      id: true,
                      saleNumber: true,
                      total: true,
                    },
                  },
                  user: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          name: "asc",
        },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching accounts:", error)
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    )
  }
}
