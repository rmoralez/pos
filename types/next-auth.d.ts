import 'next-auth'
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface User {
    role: UserRole
    tenantId: string
    tenantName: string
    locationId: string | null
    locationName: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      role: string
      tenantId: string
      tenantName: string
      locationId: string | null
      locationName: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    tenantId: string
    tenantName: string
    locationId: string | null
    locationName: string | null
  }
}
