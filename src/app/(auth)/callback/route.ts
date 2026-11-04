import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function buildRedirectUrl(
  origin: string,
  path: string,
  forwardedHost: string | null,
  isLocalEnv: boolean
): string {
  if (isLocalEnv) {
    return `${origin}${path}`;
  } else if (forwardedHost) {
    return `https://${forwardedHost}${path}`;
  }
  return `${origin}${path}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (!code) {
    console.error("Auth callback error: No code provided");
    return NextResponse.redirect(
      buildRedirectUrl(
        origin,
        "/login?error=auth_callback_error",
        forwardedHost,
        isLocalEnv
      )
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    console.error("Auth callback error: Supabase not configured");
    return NextResponse.redirect(
      buildRedirectUrl(
        origin,
        "/login?error=service_unavailable",
        forwardedHost,
        isLocalEnv
      )
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(
      buildRedirectUrl(
        origin,
        "/login?error=auth_callback_error",
        forwardedHost,
        isLocalEnv
      )
    );
  }

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("Auth callback error: No user after session exchange");
    return NextResponse.redirect(
      buildRedirectUrl(
        origin,
        "/login?error=auth_callback_error",
        forwardedHost,
        isLocalEnv
      )
    );
  }

  // Check if user has a household membership
  // Using maybeSingle() to return null without error when no row found
  const { data: membership } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Redirect to onboarding if no household, otherwise to list
  const redirectPath = membership ? "/list" : "/onboarding";

  return NextResponse.redirect(
    buildRedirectUrl(origin, redirectPath, forwardedHost, isLocalEnv)
  );
}
