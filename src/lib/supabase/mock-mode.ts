/**
 * Checks if E2E mock mode is allowed.
 *
 * Mock mode allows the app to run without Supabase for E2E testing.
 * It requires BOTH:
 * 1. NOT being in production environment
 * 2. Explicit opt-in via NEXT_PUBLIC_ENABLE_E2E_MOCK_MODE=true
 *
 * This prevents accidental security bypass in production if env vars are misconfigured.
 *
 * Note: Uses NEXT_PUBLIC_ prefix so it's available on both client and server.
 */
export function isE2EMockModeAllowed(): boolean {
  // NEVER allow mock mode in production
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  // Require explicit opt-in via feature flag
  // Check both variants for backwards compatibility
  return (
    process.env.NEXT_PUBLIC_ENABLE_E2E_MOCK_MODE === "true" ||
    process.env.ENABLE_E2E_MOCK_MODE === "true"
  );
}

/**
 * Checks if the app should run in mock mode.
 * Returns true if mock mode is allowed AND Supabase is not configured.
 */
export function shouldUseMockMode(): boolean {
  if (!isE2EMockModeAllowed()) {
    return false;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return !supabaseUrl || !supabaseKey;
}

/**
 * Checks if the app should run in local-only mode.
 * Returns true if:
 * 1. NOT in production environment
 * 2. Supabase credentials are not configured
 *
 * This allows developers to run the app locally without Supabase,
 * using Dexie/IndexedDB for all storage. Data stays local only.
 *
 * Note: In production, this always returns false for safety.
 */
export function isLocalOnlyMode(): boolean {
  // NEVER allow local-only mode in production
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return !supabaseUrl || !supabaseKey;
}
