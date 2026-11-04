import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isLocalOnlyMode, shouldUseMockMode } from "./mock-mode";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function updateSession(request: NextRequest): Promise<{
  supabaseResponse: NextResponse;
  user: { id: string; email?: string } | null;
  supabase: SupabaseClient | null;
}> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow local-only mode (dev without Supabase) or explicit E2E mock mode
  if (!supabaseUrl || !supabaseKey) {
    if (isLocalOnlyMode() || shouldUseMockMode()) {
      return { supabaseResponse, user: null, supabase: null };
    }
    // In production or without explicit flag, throw to prevent silent auth bypass
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "or enable ENABLE_E2E_MOCK_MODE=true for E2E testing (non-production only)."
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session and get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user, supabase };
}
