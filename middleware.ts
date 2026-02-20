import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Middleware is running, user is authenticated
    console.log('[MIDDLEWARE] Authorized request to:', req.nextUrl.pathname)
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Return true if user has a valid token
        const hasToken = !!token
        console.log('[MIDDLEWARE] Auth check for:', req.nextUrl.pathname, 'hasToken:', hasToken)
        return hasToken
      },
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match dashboard and all its sub-paths
     */
    "/dashboard/:path*",
  ],
}
