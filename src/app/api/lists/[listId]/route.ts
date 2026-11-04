import { NextResponse } from "next/server";

import { PGRST_NOT_FOUND } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { listId } = await params;
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

    // RLS will filter to only lists the user has access to
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select(
        `
        id,
        household_id,
        name,
        status,
        created_at,
        updated_at,
        households (
          id,
          name
        )
      `
      )
      .eq("id", listId)
      .single();

    if (listError) {
      if (listError.code === PGRST_NOT_FOUND) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
      console.error("Error fetching list:", listError);
      return NextResponse.json(
        { error: "Failed to fetch list" },
        { status: 500 }
      );
    }

    return NextResponse.json({ list }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in GET /api/lists/[listId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { listId } = await params;
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, status } = body;
    const updates: Record<string, string> = {};

    if (name !== undefined) {
      if (typeof name !== "string") {
        return NextResponse.json(
          { error: "List name must be a string" },
          { status: 400 }
        );
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        return NextResponse.json(
          { error: "List name cannot be empty" },
          { status: 400 }
        );
      }
      if (trimmedName.length > 100) {
        return NextResponse.json(
          { error: "List name must be 100 characters or less" },
          { status: 400 }
        );
      }
      updates.name = trimmedName;
    }

    if (status !== undefined) {
      if (status !== "active" && status !== "archived") {
        return NextResponse.json(
          { error: "Status must be 'active' or 'archived'" },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // RLS will verify user has access to this list
    const { data: list, error: listError } = await supabase
      .from("lists")
      .update(updates)
      .eq("id", listId)
      .select(
        `
        id,
        household_id,
        name,
        status,
        created_at,
        updated_at,
        households (
          id,
          name
        )
      `
      )
      .single();

    if (listError) {
      if (listError.code === PGRST_NOT_FOUND) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
      console.error("Error updating list:", listError);
      return NextResponse.json(
        { error: "Failed to update list" },
        { status: 500 }
      );
    }

    return NextResponse.json({ list }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in PUT /api/lists/[listId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { listId } = await params;
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

    // First check if the list exists and user has access (via RLS)
    const { data: existingList, error: checkError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (checkError || !existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // RLS will verify user has access to delete this list
    const { error: deleteError } = await supabase
      .from("lists")
      .delete()
      .eq("id", listId);

    if (deleteError) {
      console.error("Error deleting list:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete list" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/lists/[listId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
