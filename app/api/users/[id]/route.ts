import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { z } from "zod"
import bcrypt from "bcryptjs"

const userUpdateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "CASHIER", "STOCK_MANAGER", "VIEWER"]),
  locationId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/users/[id]
 * Get a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view user details or users can view their own details
    if (!["SUPER_ADMIN", "ADMIN"].includes(user.role) && user.id !== params.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        locationId: true,
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        _count: {
          select: {
            sales: true,
            cashRegisters: true,
          },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(targetUser)
  } catch (error) {
    console.error("GET user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/[id]
 * Update a user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can update users or users can update their own profile (limited)
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user.role)
    const isSelfUpdate = user.id === params.id

    if (!isAdmin && !isSelfUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify user belongs to tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()

    // Non-admins can only update their own name and password
    if (!isAdmin) {
      const limitedSchema = z.object({
        name: z.string().min(1),
        password: z.string().min(6).optional(),
      })
      const validatedData = limitedSchema.parse(body)

      const updateData: any = { name: validatedData.name }
      if (validatedData.password) {
        updateData.password = await bcrypt.hash(validatedData.password, 10)
      }

      const updatedUser = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          locationId: true,
          createdAt: true,
        },
      })

      return NextResponse.json(updatedUser)
    }

    // Admin full update
    const validatedData = userUpdateSchema.parse(body)

    // Check if email is being changed and if it already exists
    if (validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        )
      }
    }

    // Verify location belongs to tenant if provided
    if (validatedData.locationId) {
      const location = await prisma.location.findFirst({
        where: {
          id: validatedData.locationId,
          tenantId: user.tenantId,
        },
      })

      if (!location) {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        )
      }
    }

    const updateData: any = {
      name: validatedData.name,
      email: validatedData.email,
      role: validatedData.role,
      locationId: validatedData.locationId,
      isActive: validatedData.isActive,
    }

    // Hash password if provided
    if (validatedData.password) {
      updateData.password = await bcrypt.hash(validatedData.password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        locationId: true,
        createdAt: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("PUT user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SUPER_ADMIN can delete users
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Cannot delete yourself
    if (user.id === params.id) {
      return NextResponse.json(
        { error: "Cannot delete your own user account" },
        { status: 400 }
      )
    }

    // Verify user belongs to tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            sales: true,
            cashRegisters: true,
          },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has related data
    if (targetUser._count.sales > 0 || targetUser._count.cashRegisters > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete user with associated data (${targetUser._count.sales} sales, ${targetUser._count.cashRegisters} cash registers)`,
        },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
