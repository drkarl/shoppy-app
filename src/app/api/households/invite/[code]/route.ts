import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { code: inviteCode } = await context.params;

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!inviteCode || typeof inviteCode !== "string") {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    // Find the household by invite code
    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("id, name, invite_expires_at")
      .eq("invite_code", inviteCode)
      .single();

    if (householdError || !household) {
      return NextResponse.json(
        { error: "Invalid invite code", code: "INVALID_CODE" },
        { status: 404 }
      );
    }

    // Check if the invite has expired
    const expiresAt = new Date(household.invite_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        {
          error:
            "This invite has expired. Ask the household owner for a new link.",
          code: "EXPIRED",
        },
        { status: 410 }
      );
    }

    // Check if user is already a member
    const { data: membership } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", household.id)
      .eq("user_id", user.id)
      .single();

    if (membership) {
      return NextResponse.json(
        {
          error: "You are already a member of this household",
          code: "ALREADY_MEMBER",
          household_id: household.id,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        household_id: household.id,
        household_name: household.name,
        expires_at: household.invite_expires_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/households/invite/[code]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
