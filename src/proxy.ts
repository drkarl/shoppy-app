import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Routes that require authentication
const PROTECTED_ROUTES = ["/list", "/onboarding", "/settings", "/join"];

// Routes that should redirect authenticated users away (e.g., to /list)
// Note: /callback is excluded from middleware via the matcher pattern to avoid circular auth checks
const AUTH_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // When Supabase is not configured (e.g., E2E tests with mock auth),
  // skip server-side auth checks and allow all routes through.
  // Client-side auth will be handled by mock localStorage in tests.
  if (!supabase) {
    return supabaseResponse;
  }

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users from protected routes to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users from auth routes (login) to list
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/list";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - Static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
