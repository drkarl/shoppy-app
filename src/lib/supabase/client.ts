import { createBrowserClient } from "@supabase/ssr";

import { isLocalOnlyMode, shouldUseMockMode } from "./mock-mode";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase browser client.
 * Returns null if running in local-only mode (dev without Supabase) or
 * E2E mock mode. In production, this will throw if Supabase is not configured.
 */
export function createClient(): SupabaseClient | null {
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

  return createBrowserClient(supabaseUrl, supabaseKey);
}
