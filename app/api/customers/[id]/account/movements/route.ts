import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

// GET /api/customers/[id]/account/movements — list movements
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const take = parseInt(searchParams.get("limit") ?? "50")
    const skip = parseInt(searchParams.get("offset") ?? "0")

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Get account
    const account = await prisma.customerAccount.findUnique({
      where: { customerId: params.id },
    })

    if (!account) {
      return NextResponse.json({ movements: [], total: 0 })
    }

    const [movements, total] = await Promise.all([
      prisma.customerAccountMovement.findMany({
        where: { customerAccountId: account.id },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          user: { select: { id: true, name: true, email: true } },
          sale: { select: { id: true, saleNumber: true } },
        },
      }),
      prisma.customerAccountMovement.count({
        where: { customerAccountId: account.id },
      }),
    ])

    return NextResponse.json({ movements, total })
  } catch (error) {
    console.error("GET account movements error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
