import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface JoinRequestBody {
  invite_code: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

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

    let body: JoinRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { invite_code } = body;

    if (!invite_code || typeof invite_code !== "string") {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    const trimmedCode = invite_code.trim();
    if (trimmedCode.length === 0) {
      return NextResponse.json(
        { error: "Invite code cannot be empty" },
        { status: 400 }
      );
    }

    // Use the RPC function that handles all validation atomically
    const { data: householdId, error: joinError } = await supabase.rpc(
      "join_household_with_code",
      { p_invite_code: trimmedCode }
    );

    if (joinError) {
      // Parse the error message from the RPC function
      const errorMessage = joinError.message || "Failed to join household";

      if (errorMessage.includes("Invalid or expired")) {
        return NextResponse.json(
          { error: "This invite link has expired or is invalid" },
          { status: 400 }
        );
      }

      if (errorMessage.includes("already a member")) {
        return NextResponse.json(
          { error: "You are already a member of this household" },
          { status: 409 }
        );
      }

      console.error("Error joining household:", joinError);
      return NextResponse.json(
        { error: "Failed to join household" },
        { status: 500 }
      );
    }

    // Fetch the household details to return
    const { data: household, error: fetchError } = await supabase
      .from("households")
      .select("id, name")
      .eq("id", householdId)
      .single();

    if (fetchError) {
      console.error("Error fetching household:", fetchError);
      // Join was successful, just return the ID
      return NextResponse.json({ household_id: householdId }, { status: 200 });
    }

    return NextResponse.json({ household }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/households/join:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
