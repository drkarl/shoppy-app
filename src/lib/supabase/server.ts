import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isLocalOnlyMode, shouldUseMockMode } from "./mock-mode";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase server client.
 * Returns null if running in local-only mode (dev without Supabase) or
 * E2E mock mode. In production, this will throw if Supabase is not configured.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Allow null return in local-only mode or E2E mock mode
    if (isLocalOnlyMode() || shouldUseMockMode()) {
      return null;
    }
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "or enable ENABLE_E2E_MOCK_MODE=true for E2E testing (non-production only)."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
