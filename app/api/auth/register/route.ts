import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  tenantName: z.string().min(1, "Tenant name is required"),
  cuit: z.string().min(1, "CUIT is required"),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validatedData = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Check if tenant with CUIT already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { cuit: validatedData.cuit },
    })

    if (existingTenant) {
      return NextResponse.json(
        { message: "A business with this CUIT already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create tenant, location, and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: validatedData.tenantName,
          cuit: validatedData.cuit,
          email: validatedData.email,
        },
      })

      // Create default location
      const location = await tx.location.create({
        data: {
          name: "Sucursal Principal",
          tenantId: tenant.id,
        },
      })

      // Create admin user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          password: hashedPassword,
          role: "SUPER_ADMIN",
          tenantId: tenant.id,
          locationId: location.id,
        },
      })

      // Create default movement types for the new tenant
      await tx.movementType.createMany({
        data: [
          {
            name: "Ingreso General",
            description: "Ingreso de efectivo",
            transactionType: "INCOME",
            isSystem: true,
            isActive: true,
            tenantId: tenant.id,
          },
          {
            name: "Egreso General",
            description: "Egreso de efectivo",
            transactionType: "EXPENSE",
            isSystem: true,
            isActive: true,
            tenantId: tenant.id,
          },
        ],
      })

      return { tenant, location, user }
    })

    return NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.errors },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
