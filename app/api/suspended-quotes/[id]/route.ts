import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"

// GET - Get specific suspended quote
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const suspended = await prisma.suspendedQuote.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        customer: true,
      },
    })

    if (!suspended) {
      return NextResponse.json(
        { error: "Suspended quote not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(suspended)
  } catch (error) {
    console.error("Error fetching suspended quote:", error)
    return NextResponse.json(
      { error: "Failed to fetch suspended quote" },
      { status: 500 }
    )
  }
}

// DELETE - Cancel suspended quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.suspendedQuote.delete({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting suspended quote:", error)
    return NextResponse.json(
      { error: "Failed to delete suspended quote" },
      { status: 500 }
    )
  }
}
