# Shoppy Architecture Design

## 1. Problem Overview

Shoppy is a collaborative smart shopping list application designed for a two-person household. The app enables real-time collaboration on a shared shopping list with intelligent duplicate detection supporting both English and Spanish terms.

### Core Challenges

1. **Offline-First Operation**: Users frequently shop in stores with poor connectivity. The app must work seamlessly offline and sync when connectivity returns.

2. **Real-Time Collaboration**: When both users are online, changes must propagate within seconds so neither adds duplicates or misses updates.

3. **Bilingual Duplicate Detection**: The household uses both English and Spanish. Adding "leche" when "milk" exists should trigger a duplicate warning.

4. **Store-Specific Organization**: Different stores have different layouts. Categories should reorder based on the selected store to optimize the shopping route.

---

## 2. Requirements & Constraints

### Functional Requirements

| ID   | Requirement                                                                                |
| ---- | ------------------------------------------------------------------------------------------ |
| FR-1 | Two users can share and collaborate on a single active shopping list                       |
| FR-2 | Changes sync between devices in real-time when online (< 3 seconds)                        |
| FR-3 | App works fully offline; changes queue and sync on reconnect                               |
| FR-4 | Duplicate detection works across English and Spanish terms                                 |
| FR-5 | Items grouped by category; category order configurable per store                           |
| FR-6 | Users can check off items while shopping; checked items remain visible until list archived |
| FR-7 | Second user joins household via shareable invite link                                      |
| FR-8 | Multiple authentication options: Magic Link and Google OAuth                               |

### Non-Functional Requirements

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| NFR-1 | PWA installable on phone and desktop                         |
| NFR-2 | Add item perceived latency < 1 second                        |
| NFR-3 | Works on 3G connection (graceful degradation)                |
| NFR-4 | Supports 500+ items per list without performance degradation |
| NFR-5 | Battery-efficient background sync                            |

### Out of Scope (MVP)

- Recipe planning and meal prep features
- Nutrition tracking or dietary restrictions
- Price comparison or budget tracking
- Voice input for adding items
- Embedding-based semantic matching (dictionary + fuzzy only)
- More than one active list per household
- More than 2 users per household

### Assumptions

1. Users have modern browsers supporting Service Workers and IndexedDB
2. Supabase free tier sufficient for 2-user household usage patterns
3. ~200 dictionary terms cover 80%+ of common grocery items
4. Users willing to manually resolve rare sync conflicts

---

## 3. High-Level Architecture

### System Context Diagram

```
+------------------+     +------------------+
|   User A         |     |   User B         |
|   (Phone PWA)    |     |   (Desktop PWA)  |
+--------+---------+     +--------+---------+
         |                        |
         |    HTTPS/WSS           |
         +----------+-------------+
                    |
                    v
         +----------+-----------+
         |      Vercel CDN      |
         |   (Next.js Frontend) |
         +----------+-----------+
                    |
                    v
         +----------+-----------+
         |      Supabase        |
         |  +----------------+  |
         |  | PostgreSQL DB  |  |
         |  +----------------+  |
         |  | Realtime WS    |  |
         |  +----------------+  |
         |  | Auth (GoTrue)  |  |
         |  +----------------+  |
         |  | Edge Functions |  |
         |  +----------------+  |
         +----------------------+
```

### Client Architecture

```
+----------------------------------------------------------+
|                    Next.js PWA Client                     |
+----------------------------------------------------------+
|  UI Layer (React Components + shadcn/ui + Tailwind)      |
+----------------------------------------------------------+
|  State Layer                                              |
|  +------------------+  +-----------------------------+   |
|  | React Context    |  | Dexie.js liveQuery()        |   |
|  | (Auth, Settings) |  | (Reactive data binding)     |   |
|  +------------------+  +-----------------------------+   |
+----------------------------------------------------------+
|  Data Layer                                               |
|  +------------------+  +-----------------------------+   |
|  | Dexie.js         |  | Supabase Client             |   |
|  | (IndexedDB)      |  | (Realtime + REST)           |   |
|  | PRIMARY STORE    |  | SYNC TARGET                 |   |
|  +------------------+  +-----------------------------+   |
+----------------------------------------------------------+
|  Sync Layer                                               |
|  +--------------------------------------------------+   |
|  | SyncEngine: Queue management, conflict resolution |   |
|  | Service Worker: Background sync, offline caching  |   |
|  +--------------------------------------------------+   |
+----------------------------------------------------------+
```

### Data Flow Overview

```
User Action (Add Item)
        |
        v
+-------+--------+
| Duplicate Check |  <-- Dictionary + Fuzzy Match (local)
+-------+--------+
        |
        v (no duplicate or user confirms)
+-------+--------+
| Write to Dexie |  <-- Immediate, optimistic
+-------+--------+
        |
        +---------------+
        |               |
        v               v
+-------+--------+ +----+----+
| UI Updates     | | Sync    |
| (liveQuery)    | | Queue   |
+----------------+ +----+----+
                       |
                       v (when online)
                  +----+----+
                  | Supabase|
                  | INSERT  |
                  +----+----+
                       |
                       v
                  +----+----+
                  | Realtime|
                  | Broadcast|
                  +----+----+
                       |
                       v
                  +----+----+
                  | Other   |
                  | Client  |
                  +----+----+
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
+-------------+       +-------------------+       +-------------+
| auth.users  |       | household_members |       | households  |
+-------------+       +-------------------+       +-------------+
| id (PK)     |<------| user_id (FK)      |------>| id (PK)     |
| email       |       | household_id (FK) |       | name        |
| ...         |       | role              |       | invite_code |
+-------------+       | joined_at         |       | created_at  |
                      +-------------------+       +------+------+
                                                         |
                      +----------------------------------+
                      |
                      v
+-------------+       +-------------------+
| lists       |       | store_profiles    |
+-------------+       +-------------------+
| id (PK)     |       | id (PK)           |
| household_id|<------| household_id (FK) |
| name        |       | store_name        |
| status      |       | category_order    |
| created_at  |       +-------------------+
+------+------+
       |
       v
+-------------+       +-------------------+
| list_items  |       | categories        |
+-------------+       +-------------------+
| id (PK)     |       | id (PK)           |
| list_id (FK)|       | name              |
| display_name|------>| name_es           |
| category_id |       | icon              |
| quantity    |       | default_order     |
| status      |       +-------------------+
| version     |
+-------------+
```

### SQL Schema

```sql
-- ============================================
-- HOUSEHOLDS
-- ============================================
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'My Household',
    invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
    invite_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for invite code lookups
CREATE INDEX idx_households_invite_code ON households(invite_code)
    WHERE invite_expires_at > NOW();

-- ============================================
-- HOUSEHOLD MEMBERS
-- ============================================
CREATE TABLE household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(household_id, user_id)
);

CREATE INDEX idx_household_members_user ON household_members(user_id);
CREATE INDEX idx_household_members_household ON household_members(household_id);

-- ============================================
-- CATEGORIES (Static reference data)
-- ============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_es TEXT NOT NULL,
    icon TEXT NOT NULL,
    default_order INT NOT NULL,

    UNIQUE(name)
);

-- ============================================
-- LISTS
-- ============================================
CREATE TABLE lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Shopping List',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lists_household_status ON lists(household_id, status);

-- ============================================
-- LIST ITEMS
-- ============================================
CREATE TABLE list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,

    -- Item details
    raw_text TEXT NOT NULL,           -- Original user input
    display_name TEXT NOT NULL,       -- Normalized display name
    quantity DECIMAL(10,2) DEFAULT 1,
    unit TEXT,                        -- kg, g, L, ml, pack, etc.
    note TEXT,

    -- Categorization
    category_id UUID REFERENCES categories(id),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked')),
    added_by UUID REFERENCES auth.users(id),
    checked_by UUID REFERENCES auth.users(id),
    checked_at TIMESTAMPTZ,

    -- Sync metadata
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_list_items_list_status ON list_items(list_id, status);
CREATE INDEX idx_list_items_list_category ON list_items(list_id, category_id);
CREATE INDEX idx_list_items_updated ON list_items(updated_at);

-- ============================================
-- STORE PROFILES
-- ============================================
CREATE TABLE store_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    category_order UUID[] NOT NULL,   -- Ordered array of category IDs
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(household_id, store_name)
);

CREATE INDEX idx_store_profiles_household ON store_profiles(household_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER households_updated_at
    BEFORE UPDATE ON households
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lists_updated_at
    BEFORE UPDATE ON lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER list_items_updated_at
    BEFORE UPDATE ON list_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER store_profiles_updated_at
    BEFORE UPDATE ON store_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-increment version on list_items update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER list_items_version
    BEFORE UPDATE ON list_items
    FOR EACH ROW EXECUTE FUNCTION increment_version();
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get user's household IDs
-- ============================================
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS SETOF UUID AS $$
    SELECT household_id
    FROM household_members
    WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HOUSEHOLDS POLICIES
-- ============================================

-- Users can view households they belong to
CREATE POLICY "Users can view own households"
    ON households FOR SELECT
    USING (id IN (SELECT get_user_household_ids()));

-- Users can create new households (becomes owner)
CREATE POLICY "Users can create households"
    ON households FOR INSERT
    WITH CHECK (true);

-- Only owners can update household
CREATE POLICY "Owners can update household"
    ON households FOR UPDATE
    USING (
        id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- ============================================
-- HOUSEHOLD MEMBERS POLICIES
-- ============================================

-- Users can view members of their households
CREATE POLICY "Users can view household members"
    ON household_members FOR SELECT
    USING (household_id IN (SELECT get_user_household_ids()));

-- Users can join a household (via invite)
CREATE POLICY "Users can join household"
    ON household_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Owners can remove members
CREATE POLICY "Owners can remove members"
    ON household_members FOR DELETE
    USING (
        household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- ============================================
-- LISTS POLICIES
-- ============================================

-- Users can view lists in their households
CREATE POLICY "Users can view household lists"
    ON lists FOR SELECT
    USING (household_id IN (SELECT get_user_household_ids()));

-- Users can create lists in their households
CREATE POLICY "Users can create lists"
    ON lists FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_household_ids()));

-- Users can update lists in their households
CREATE POLICY "Users can update lists"
    ON lists FOR UPDATE
    USING (household_id IN (SELECT get_user_household_ids()));

-- Users can delete lists in their households
CREATE POLICY "Users can delete lists"
    ON lists FOR DELETE
    USING (household_id IN (SELECT get_user_household_ids()));

-- ============================================
-- LIST ITEMS POLICIES
-- ============================================

-- Users can view items in their household's lists
CREATE POLICY "Users can view list items"
    ON list_items FOR SELECT
    USING (
        list_id IN (
            SELECT l.id FROM lists l
            WHERE l.household_id IN (SELECT get_user_household_ids())
        )
    );

-- Users can add items to their household's lists
CREATE POLICY "Users can add list items"
    ON list_items FOR INSERT
    WITH CHECK (
        list_id IN (
            SELECT l.id FROM lists l
            WHERE l.household_id IN (SELECT get_user_household_ids())
        )
    );

-- Users can update items in their household's lists
CREATE POLICY "Users can update list items"
    ON list_items FOR UPDATE
    USING (
        list_id IN (
            SELECT l.id FROM lists l
            WHERE l.household_id IN (SELECT get_user_household_ids())
        )
    );

-- Users can delete items from their household's lists
CREATE POLICY "Users can delete list items"
    ON list_items FOR DELETE
    USING (
        list_id IN (
            SELECT l.id FROM lists l
            WHERE l.household_id IN (SELECT get_user_household_ids())
        )
    );

-- ============================================
-- STORE PROFILES POLICIES
-- ============================================

-- Users can view store profiles in their households
CREATE POLICY "Users can view store profiles"
    ON store_profiles FOR SELECT
    USING (household_id IN (SELECT get_user_household_ids()));

-- Users can create store profiles in their households
CREATE POLICY "Users can create store profiles"
    ON store_profiles FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_household_ids()));

-- Users can update store profiles in their households
CREATE POLICY "Users can update store profiles"
    ON store_profiles FOR UPDATE
    USING (household_id IN (SELECT get_user_household_ids()));

-- Users can delete store profiles in their households
CREATE POLICY "Users can delete store profiles"
    ON store_profiles FOR DELETE
    USING (household_id IN (SELECT get_user_household_ids()));

-- ============================================
-- CATEGORIES POLICIES (Public read-only)
-- ============================================

CREATE POLICY "Anyone can view categories"
    ON categories FOR SELECT
    USING (true);
```

### Seed Data

```sql
-- ============================================
-- CATEGORIES SEED DATA
-- ============================================
INSERT INTO categories (id, name, name_es, icon, default_order) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Produce', 'Frutas y Verduras', 'carrot', 1),
    ('c1000000-0000-0000-0000-000000000002', 'Meat & Fish', 'Carne y Pescado', 'beef', 2),
    ('c1000000-0000-0000-0000-000000000003', 'Dairy', 'Lacteos', 'milk', 3),
    ('c1000000-0000-0000-0000-000000000004', 'Bakery', 'Panaderia', 'bread-slice', 4),
    ('c1000000-0000-0000-0000-000000000005', 'Pantry', 'Despensa', 'package', 5),
    ('c1000000-0000-0000-0000-000000000006', 'Frozen', 'Congelados', 'snowflake', 6),
    ('c1000000-0000-0000-0000-000000000007', 'Snacks', 'Snacks', 'cookie', 7),
    ('c1000000-0000-0000-0000-000000000008', 'Drinks', 'Bebidas', 'cup-soda', 8),
    ('c1000000-0000-0000-0000-000000000009', 'Baby', 'Bebe', 'baby', 9),
    ('c1000000-0000-0000-0000-000000000010', 'Household', 'Hogar y Limpieza', 'spray-can', 10),
    ('c1000000-0000-0000-0000-000000000011', 'Toiletries', 'Higiene Personal', 'bath', 11);
```

---

## 5. API Design

### Supabase Client Operations

#### Authentication

```typescript
// Magic Link
const { error } = await supabase.auth.signInWithOtp({
  email: "user@example.com",
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});

// Google OAuth
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

#### Household Operations

```typescript
// Create household (new user)
const { data: household } = await supabase
  .from("households")
  .insert({ name: "Our Home" })
  .select()
  .single();

// Add creator as owner
await supabase.from("household_members").insert({
  household_id: household.id,
  user_id: userId,
  role: "owner",
});

// Create initial list
await supabase.from("lists").insert({
  household_id: household.id,
  name: "Shopping List",
});

// Join household via invite code
const { data: household } = await supabase
  .from("households")
  .select("id")
  .eq("invite_code", inviteCode)
  .gt("invite_expires_at", new Date().toISOString())
  .single();

if (household) {
  await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: userId,
    role: "member",
  });
}

// Regenerate invite code
const { data } = await supabase.rpc("regenerate_invite_code", {
  p_household_id: householdId,
});
```

#### List Item Operations

```typescript
// Add item
const { data, error } = await supabase
  .from("list_items")
  .insert({
    list_id: listId,
    raw_text: rawInput,
    display_name: parsedName,
    quantity: parsedQuantity,
    unit: parsedUnit,
    category_id: categoryId,
    added_by: userId,
  })
  .select()
  .single();

// Check/uncheck item
const { error } = await supabase
  .from("list_items")
  .update({
    status: newStatus,
    checked_by: newStatus === "checked" ? userId : null,
    checked_at: newStatus === "checked" ? new Date().toISOString() : null,
  })
  .eq("id", itemId);

// Update item
const { error } = await supabase
  .from("list_items")
  .update({
    display_name: newName,
    quantity: newQuantity,
    note: newNote,
    category_id: newCategoryId,
  })
  .eq("id", itemId);

// Delete item
const { error } = await supabase.from("list_items").delete().eq("id", itemId);

// Fetch list with items grouped by category
const { data } = await supabase
  .from("list_items")
  .select(
    `
    *,
    category:categories(*),
    added_by_user:added_by(email),
    checked_by_user:checked_by(email)
  `
  )
  .eq("list_id", listId)
  .order("created_at", { ascending: true });
```

### Edge Functions

#### `match_item` - Duplicate Detection

**Endpoint:** `POST /functions/v1/match_item`

**Request:**

```typescript
interface MatchItemRequest {
  household_id: string;
  list_id: string;
  input_text: string;
}
```

**Response:**

```typescript
interface MatchItemResponse {
  parsed: {
    display_name: string;
    quantity: number;
    unit: string | null;
  };
  category_suggestion: {
    id: string;
    name: string;
  } | null;
  duplicate: {
    found: boolean;
    confidence: number; // 0.0 - 1.0
    existing_item: ListItem | null;
    match_reason: "exact" | "dictionary" | "fuzzy" | "contains" | null;
  };
}
```

**Implementation (Edge Function):**

```typescript
// supabase/functions/match_item/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeText,
  parseQuantity,
  fuzzyMatch,
} from "../_shared/matching.ts";
import { DICTIONARY } from "../_shared/dictionary.ts";

serve(async (req) => {
  const { household_id, list_id, input_text } = await req.json();

  // 1. Parse quantity and unit
  const parsed = parseQuantity(input_text);

  // 2. Normalize text
  const normalized = normalizeText(parsed.text);

  // 3. Dictionary lookup for category suggestion
  const dictEntry = DICTIONARY.find(
    (d) =>
      normalizeText(d.term_en) === normalized ||
      normalizeText(d.term_es) === normalized ||
      d.variants?.some((v) => normalizeText(v) === normalized)
  );

  // 4. Fetch active items from list
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: activeItems } = await supabase
    .from("list_items")
    .select("id, display_name, quantity, unit, category_id")
    .eq("list_id", list_id)
    .eq("status", "pending");

  // 5. Check for duplicates
  let duplicate = {
    found: false,
    confidence: 0,
    existing_item: null,
    match_reason: null,
  };

  for (const item of activeItems || []) {
    const itemNormalized = normalizeText(item.display_name);

    // Exact match
    if (itemNormalized === normalized) {
      duplicate = {
        found: true,
        confidence: 1.0,
        existing_item: item,
        match_reason: "exact",
      };
      break;
    }

    // Dictionary match (e.g., "leche" matches "milk")
    if (dictEntry) {
      const itemDictEntry = DICTIONARY.find(
        (d) =>
          normalizeText(d.term_en) === itemNormalized ||
          normalizeText(d.term_es) === itemNormalized
      );
      if (itemDictEntry && itemDictEntry.canonical === dictEntry.canonical) {
        duplicate = {
          found: true,
          confidence: 0.95,
          existing_item: item,
          match_reason: "dictionary",
        };
        break;
      }
    }

    // Fuzzy match
    const distance = fuzzyMatch(normalized, itemNormalized);
    if (distance <= 2 && normalized.length > 3) {
      duplicate = {
        found: true,
        confidence: 0.8,
        existing_item: item,
        match_reason: "fuzzy",
      };
    }

    // Contains match
    if (
      normalized.length > 4 &&
      (itemNormalized.includes(normalized) ||
        normalized.includes(itemNormalized))
    ) {
      if (duplicate.confidence < 0.7) {
        duplicate = {
          found: true,
          confidence: 0.7,
          existing_item: item,
          match_reason: "contains",
        };
      }
    }
  }

  return new Response(
    JSON.stringify({
      parsed: {
        display_name: dictEntry?.canonical || parsed.text,
        quantity: parsed.quantity,
        unit: parsed.unit,
      },
      category_suggestion: dictEntry
        ? { id: dictEntry.category_id, name: dictEntry.category }
        : null,
      duplicate,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
});
```

#### `merge_items` - Combine Duplicate Items

**Endpoint:** `POST /functions/v1/merge_items`

**Request:**

```typescript
interface MergeItemsRequest {
  keep_item_id: string;
  delete_item_id: string;
  combined_quantity?: number;
}
```

**Response:**

```typescript
interface MergeItemsResponse {
  success: boolean;
  merged_item: ListItem;
}
```

### Realtime Subscriptions

```typescript
// Subscribe to list changes
const channel = supabase
  .channel(`list:${listId}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "list_items",
      filter: `list_id=eq.${listId}`,
    },
    (payload) => {
      switch (payload.eventType) {
        case "INSERT":
          handleRemoteInsert(payload.new as ListItem);
          break;
        case "UPDATE":
          handleRemoteUpdate(payload.new as ListItem);
          break;
        case "DELETE":
          handleRemoteDelete(payload.old as ListItem);
          break;
      }
    }
  )
  .subscribe();

// Cleanup on unmount
return () => {
  supabase.removeChannel(channel);
};
```

### RPC Functions

```sql
-- Regenerate invite code
CREATE OR REPLACE FUNCTION regenerate_invite_code(p_household_id UUID)
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    -- Verify caller is owner
    IF NOT EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = p_household_id
        AND user_id = auth.uid()
        AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Only household owner can regenerate invite code';
    END IF;

    new_code := encode(gen_random_bytes(6), 'hex');

    UPDATE households
    SET invite_code = new_code,
        invite_expires_at = NOW() + INTERVAL '7 days'
    WHERE id = p_household_id;

    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get changes since timestamp (for sync)
CREATE OR REPLACE FUNCTION get_list_changes(
    p_list_id UUID,
    p_since TIMESTAMPTZ
)
RETURNS SETOF list_items AS $$
BEGIN
    -- Verify access
    IF NOT EXISTS (
        SELECT 1 FROM lists l
        JOIN household_members hm ON hm.household_id = l.household_id
        WHERE l.id = p_list_id AND hm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT * FROM list_items
    WHERE list_id = p_list_id
    AND updated_at > p_since
    ORDER BY updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

---

## 6. Frontend Architecture

### App Router Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # Login form (magic link + Google)
│   ├── callback/
│   │   └── route.ts              # OAuth callback handler
│   └── join/
│       └── [code]/
│           └── page.tsx          # Join household via invite
├── (app)/
│   ├── layout.tsx                # Auth guard, offline indicator, nav
│   ├── page.tsx                  # Redirect to /list or onboarding
│   ├── list/
│   │   ├── page.tsx              # Main shopping list view
│   │   └── shopping/
│   │       └── page.tsx          # Shopping mode (store-optimized)
│   ├── settings/
│   │   ├── page.tsx              # General settings
│   │   ├── stores/
│   │   │   └── page.tsx          # Store profile management
│   │   └── invite/
│   │       └── page.tsx          # Invite link management
│   └── onboarding/
│       └── page.tsx              # First-time setup
├── manifest.ts                   # PWA manifest
├── globals.css                   # Tailwind + custom styles
└── layout.tsx                    # Root layout, providers
```

### Component Architecture

```
components/
├── ui/                           # shadcn/ui components
│   ├── button.tsx
│   ├── input.tsx
│   ├── sheet.tsx
│   ├── checkbox.tsx
│   └── ...
├── list/
│   ├── AddItemBar.tsx            # Sticky input for adding items
│   ├── DuplicateWarning.tsx      # Sheet showing potential duplicate
│   ├── CategoryGroup.tsx         # Collapsible category section
│   ├── ListItem.tsx              # Individual item row
│   ├── ItemCheckbox.tsx          # Check/uncheck control
│   ├── ItemActions.tsx           # Edit, delete menu
│   └── EmptyState.tsx            # No items illustration
├── shopping/
│   ├── StoreSelector.tsx         # Dropdown to pick store
│   ├── ProgressBar.tsx           # X of Y items checked
│   └── ShoppingCategoryGroup.tsx # Optimized for checking off
├── settings/
│   ├── StoreProfileCard.tsx      # Store with drag-drop categories
│   ├── CategoryOrderList.tsx     # Sortable category list
│   └── InviteCodeCard.tsx        # Show/regenerate invite
├── layout/
│   ├── AppHeader.tsx             # Logo, settings link
│   ├── OfflineIndicator.tsx      # Banner when offline
│   ├── SyncStatus.tsx            # Syncing/synced indicator
│   └── BottomNav.tsx             # Mobile navigation
└── providers/
    ├── AuthProvider.tsx          # Supabase auth context
    ├── HouseholdProvider.tsx     # Current household context
    └── SyncProvider.tsx          # Sync engine context
```

### Key Component Specifications

#### AddItemBar

```typescript
interface AddItemBarProps {
  listId: string;
  onItemAdded?: (item: ListItem) => void;
}

// Features:
// - Sticky positioning at top
// - Auto-focus on mount
// - Debounced duplicate check while typing (300ms)
// - Shows inline category suggestion
// - Handles Enter to add, Escape to clear
// - Quantity parsing preview ("2x milk" shows "Milk x2")
```

#### DuplicateWarning

```typescript
interface DuplicateWarningProps {
  isOpen: boolean;
  onClose: () => void;
  newItem: ParsedItem;
  existingItem: ListItem;
  confidence: number;
  onMerge: () => void;
  onAddAnyway: () => void;
}

// Features:
// - Bottom sheet on mobile, dialog on desktop
// - Shows both items side by side
// - "Merge" adds quantities together
// - "Add anyway" creates separate item
// - Confidence indicator (high/medium)
```

#### CategoryGroup

```typescript
interface CategoryGroupProps {
  category: Category;
  items: ListItem[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Features:
// - Collapsible header with item count
// - Category icon and name
// - Badge showing pending vs checked count
// - Sorted items within group
```

### State Management

```typescript
// lib/store/index.ts
import { create } from "zustand";

interface AppState {
  // UI state (not persisted)
  isAddingItem: boolean;
  selectedStoreId: string | null;
  collapsedCategories: Set<string>;

  // Actions
  setIsAddingItem: (value: boolean) => void;
  setSelectedStore: (storeId: string | null) => void;
  toggleCategoryCollapse: (categoryId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAddingItem: false,
  selectedStoreId: null,
  collapsedCategories: new Set(),

  setIsAddingItem: (value) => set({ isAddingItem: value }),
  setSelectedStore: (storeId) => set({ selectedStoreId: storeId }),
  toggleCategoryCollapse: (categoryId) =>
    set((state) => {
      const next = new Set(state.collapsedCategories);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { collapsedCategories: next };
    }),
}));
```

### Data Hooks

```typescript
// hooks/useListItems.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function useListItems(listId: string) {
  const items = useLiveQuery(
    () => db.listItems.where("listId").equals(listId).toArray(),
    [listId]
  );

  const categories = useLiveQuery(() =>
    db.categories.orderBy("defaultOrder").toArray()
  );

  const itemsByCategory = useMemo(() => {
    if (!items || !categories) return [];

    return categories
      .map((cat) => ({
        category: cat,
        items: items.filter((item) => item.categoryId === cat.id),
        pendingCount: items.filter(
          (item) => item.categoryId === cat.id && item.status === "pending"
        ).length,
      }))
      .filter((group) => group.items.length > 0);
  }, [items, categories]);

  return { items, itemsByCategory, isLoading: items === undefined };
}
```

---

## 7. Offline/Sync Layer Design

### Dexie.js Database Schema

```typescript
// lib/db/index.ts
import Dexie, { Table } from "dexie";

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  householdId: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  rawText: string;
  displayName: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  categoryId: string | null;
  status: "pending" | "checked";
  addedBy: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  nameEs: string;
  icon: string;
  defaultOrder: number;
}

export interface StoreProfile {
  id: string;
  householdId: string;
  storeName: string;
  categoryOrder: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueEntry {
  id?: number;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  recordId: string;
  payload: any;
  timestamp: number;
  retries: number;
}

export interface SyncMeta {
  key: string;
  value: any;
}

class ShoppyDatabase extends Dexie {
  households!: Table<Household>;
  lists!: Table<List>;
  listItems!: Table<ListItem>;
  categories!: Table<Category>;
  storeProfiles!: Table<StoreProfile>;
  syncQueue!: Table<SyncQueueEntry>;
  syncMeta!: Table<SyncMeta>;

  constructor() {
    super("ShoppyDB");

    this.version(1).stores({
      households: "id",
      lists: "id, householdId, status",
      listItems: "id, listId, status, categoryId, [listId+status]",
      categories: "id, defaultOrder",
      storeProfiles: "id, householdId",
      syncQueue: "++id, table, recordId, timestamp",
      syncMeta: "key",
    });
  }
}

export const db = new ShoppyDatabase();

// Initialize categories on first load
export async function initializeDatabase() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(BUNDLED_CATEGORIES);
  }
}
```

### Sync Engine

```typescript
// lib/sync/SyncEngine.ts
import { db, ListItem, SyncQueueEntry } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export class SyncEngine {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    window.addEventListener("online", () => this.handleOnline());
    window.addEventListener("offline", () => this.handleOffline());
  }

  // Queue a change for sync
  async queueChange(
    table: string,
    operation: "INSERT" | "UPDATE" | "DELETE",
    recordId: string,
    payload: any
  ) {
    await db.syncQueue.add({
      table,
      operation,
      recordId,
      payload,
      timestamp: Date.now(),
      retries: 0,
    });

    // Try immediate sync if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  // Process pending sync queue
  async processQueue() {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    this.notifyListeners({ status: "syncing" });

    try {
      const entries = await db.syncQueue.orderBy("timestamp").toArray();

      for (const entry of entries) {
        try {
          await this.syncEntry(entry);
          await db.syncQueue.delete(entry.id!);
        } catch (error) {
          // Increment retry count, remove if too many retries
          if (entry.retries >= 3) {
            console.error("Sync entry failed after 3 retries:", entry);
            await db.syncQueue.delete(entry.id!);
          } else {
            await db.syncQueue.update(entry.id!, {
              retries: entry.retries + 1,
            });
          }
        }
      }

      // Pull remote changes
      await this.pullRemoteChanges();

      this.notifyListeners({ status: "synced", lastSync: new Date() });
    } catch (error) {
      console.error("Sync failed:", error);
      this.notifyListeners({ status: "error", error });
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncEntry(entry: SyncQueueEntry) {
    const { table, operation, recordId, payload } = entry;

    switch (operation) {
      case "INSERT":
        const { error: insertError } = await supabase
          .from(table)
          .insert(this.toSnakeCase(payload));
        if (insertError) throw insertError;
        break;

      case "UPDATE":
        const { error: updateError } = await supabase
          .from(table)
          .update(this.toSnakeCase(payload))
          .eq("id", recordId);
        if (updateError) throw updateError;
        break;

      case "DELETE":
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq("id", recordId);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async pullRemoteChanges() {
    const lastSync = await db.syncMeta.get("lastSyncTimestamp");
    const since = lastSync?.value || "1970-01-01T00:00:00Z";

    // Get current list ID
    const activeList = await db.lists.where("status").equals("active").first();

    if (!activeList) return;

    // Fetch changes
    const { data: remoteItems, error } = await supabase.rpc(
      "get_list_changes",
      {
        p_list_id: activeList.id,
        p_since: since,
      }
    );

    if (error) throw error;

    // Apply changes with conflict resolution
    for (const remoteItem of remoteItems || []) {
      const localItem = await db.listItems.get(remoteItem.id);

      if (!localItem || localItem.version <= remoteItem.version) {
        await db.listItems.put(this.toCamelCase(remoteItem));
      }
      // If local version > remote, local wins (already queued for sync)
    }

    // Update last sync timestamp
    await db.syncMeta.put({
      key: "lastSyncTimestamp",
      value: new Date().toISOString(),
    });
  }

  private handleOnline() {
    this.isOnline = true;
    this.processQueue();
  }

  private handleOffline() {
    this.isOnline = false;
    this.notifyListeners({ status: "offline" });
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus) {
    this.listeners.forEach((l) => l(status));
  }

  private toSnakeCase(obj: any): any {
    // Convert camelCase to snake_case for Supabase
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        value,
      ])
    );
  }

  private toCamelCase(obj: any): any {
    // Convert snake_case to camelCase for local DB
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
        value,
      ])
    );
  }
}

export type SyncStatus =
  | { status: "synced"; lastSync: Date }
  | { status: "syncing" }
  | { status: "offline" }
  | { status: "error"; error: any };
```

### Realtime Handler

```typescript
// lib/sync/RealtimeHandler.ts
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export class RealtimeHandler {
  private channel: RealtimeChannel | null = null;

  subscribeToList(listId: string) {
    // Unsubscribe from previous
    this.unsubscribe();

    this.channel = supabase
      .channel(`list:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        async (payload) => {
          // Skip if this is our own change (already in local DB)
          const localItem = await db.listItems.get(
            payload.new?.id || payload.old?.id
          );

          switch (payload.eventType) {
            case "INSERT":
              if (!localItem) {
                await db.listItems.add(this.toCamelCase(payload.new));
              }
              break;

            case "UPDATE":
              if (!localItem || localItem.version < payload.new.version) {
                await db.listItems.put(this.toCamelCase(payload.new));
              }
              break;

            case "DELETE":
              if (localItem) {
                await db.listItems.delete(payload.old.id);
              }
              break;
          }
        }
      )
      .subscribe();
  }

  unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private toCamelCase(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
        value,
      ])
    );
  }
}
```

### Service Worker

```typescript
// public/sw.js
const CACHE_NAME = "shoppy-v1";
const STATIC_ASSETS = [
  "/",
  "/list",
  "/list/shopping",
  "/settings",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Install - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API requests (handled by sync engine)
  if (
    event.request.url.includes("/rest/") ||
    event.request.url.includes("/functions/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});

// Background sync
self.addEventListener("sync", (event) => {
  if (event.tag === "shoppy-sync") {
    event.waitUntil(
      // Notify main thread to process sync queue
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_REQUESTED" });
        });
      })
    );
  }
});
```

---

## 8. Duplicate Detection Algorithm

### Normalization Pipeline

```typescript
// lib/matching/normalize.ts

export interface ParsedInput {
  text: string;
  quantity: number;
  unit: string | null;
  original: string;
}

// Step 1: Extract quantity and unit
export function parseQuantity(input: string): ParsedInput {
  const original = input.trim();
  let text = original;
  let quantity = 1;
  let unit: string | null = null;

  // Patterns to match
  const patterns = [
    // "2x milk", "3x eggs"
    /^(\d+)\s*x\s+(.+)$/i,
    // "milk x2", "eggs x3"
    /^(.+)\s+x\s*(\d+)$/i,
    // "2 milk", "3 eggs" (number at start)
    /^(\d+)\s+(.+)$/,
    // "500g cheese", "1kg rice"
    /^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|lb|oz)\s+(.+)$/i,
    // "cheese 500g", "rice 1kg"
    /^(.+)\s+(\d+(?:\.\d+)?)\s*(kg|g|ml|l|lb|oz)$/i,
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match) {
      if (pattern.source.includes("kg|g|ml")) {
        // Unit pattern
        if (match[3]) {
          // Unit at start: "500g cheese"
          quantity = parseFloat(match[1]);
          unit = match[2].toLowerCase();
          text = match[3];
        } else {
          // Unit at end: "cheese 500g"
          text = match[1];
          quantity = parseFloat(match[2]);
          unit = match[3].toLowerCase();
        }
      } else if (pattern.source.startsWith("^(\\d+)")) {
        // Quantity at start
        quantity = parseInt(match[1]);
        text = match[2];
      } else {
        // Quantity at end
        text = match[1];
        quantity = parseInt(match[2]);
      }
      break;
    }
  }

  // Handle word numbers
  const wordNumbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
  };

  const wordMatch = text.match(
    /^(one|two|three|four|five|six|seven|eight|nine|ten|un|una|dos|tres|cuatro|cinco)\s+(.+)$/i
  );
  if (wordMatch) {
    quantity = wordNumbers[wordMatch[1].toLowerCase()];
    text = wordMatch[2];
  }

  return { text: text.trim(), quantity, unit, original };
}

// Step 2-5: Normalize text for matching
export function normalizeText(text: string): string {
  return (
    text
      // Lowercase
      .toLowerCase()
      // Remove accents
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Remove punctuation (keep alphanumeric and spaces)
      .replace(/[^\w\s]/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

// For display: capitalize first letter
export function toDisplayName(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
```

### Fuzzy Matching

```typescript
// lib/matching/fuzzy.ts

// Levenshtein distance
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if strings are similar
export function isSimilar(
  a: string,
  b: string,
  maxDistance: number = 2
): boolean {
  // Don't fuzzy match very short strings
  if (a.length < 4 || b.length < 4) {
    return a === b;
  }

  // If length difference is too big, not similar
  if (Math.abs(a.length - b.length) > maxDistance) {
    return false;
  }

  return levenshteinDistance(a, b) <= maxDistance;
}

// Check if one contains the other (for partial matches)
export function containsMatch(a: string, b: string): boolean {
  // Require minimum length for contains matching
  if (a.length < 5 || b.length < 5) {
    return false;
  }

  return a.includes(b) || b.includes(a);
}
```

### Bilingual Dictionary

```typescript
// lib/matching/dictionary.ts

export interface DictionaryEntry {
  termEn: string;
  termEs: string;
  canonical: string;
  categoryId: string;
  variants?: string[];
}

// Bundled dictionary (~200 common grocery items)
export const DICTIONARY: DictionaryEntry[] = [
  // Produce
  {
    termEn: "apple",
    termEs: "manzana",
    canonical: "apple",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["apples", "manzanas"],
  },
  {
    termEn: "banana",
    termEs: "platano",
    canonical: "banana",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["bananas", "platanos"],
  },
  {
    termEn: "orange",
    termEs: "naranja",
    canonical: "orange",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["oranges", "naranjas"],
  },
  {
    termEn: "tomato",
    termEs: "tomate",
    canonical: "tomato",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["tomatoes", "tomates"],
  },
  {
    termEn: "potato",
    termEs: "patata",
    canonical: "potato",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["potatoes", "patatas", "papa", "papas"],
  },
  {
    termEn: "onion",
    termEs: "cebolla",
    canonical: "onion",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["onions", "cebollas"],
  },
  {
    termEn: "garlic",
    termEs: "ajo",
    canonical: "garlic",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["ajos"],
  },
  {
    termEn: "lettuce",
    termEs: "lechuga",
    canonical: "lettuce",
    categoryId: "c1000000-0000-0000-0000-000000000001",
  },
  {
    termEn: "carrot",
    termEs: "zanahoria",
    canonical: "carrot",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["carrots", "zanahorias"],
  },
  {
    termEn: "pepper",
    termEs: "pimiento",
    canonical: "pepper",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["peppers", "pimientos"],
  },
  {
    termEn: "cucumber",
    termEs: "pepino",
    canonical: "cucumber",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["cucumbers", "pepinos"],
  },
  {
    termEn: "avocado",
    termEs: "aguacate",
    canonical: "avocado",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["avocados", "aguacates"],
  },
  {
    termEn: "lemon",
    termEs: "limon",
    canonical: "lemon",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["lemons", "limones"],
  },
  {
    termEn: "strawberry",
    termEs: "fresa",
    canonical: "strawberry",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["strawberries", "fresas"],
  },
  {
    termEn: "grape",
    termEs: "uva",
    canonical: "grape",
    categoryId: "c1000000-0000-0000-0000-000000000001",
    variants: ["grapes", "uvas"],
  },

  // Meat & Fish
  {
    termEn: "chicken",
    termEs: "pollo",
    canonical: "chicken",
    categoryId: "c1000000-0000-0000-0000-000000000002",
  },
  {
    termEn: "beef",
    termEs: "carne de res",
    canonical: "beef",
    categoryId: "c1000000-0000-0000-0000-000000000002",
    variants: ["ternera"],
  },
  {
    termEn: "pork",
    termEs: "cerdo",
    canonical: "pork",
    categoryId: "c1000000-0000-0000-0000-000000000002",
  },
  {
    termEn: "fish",
    termEs: "pescado",
    canonical: "fish",
    categoryId: "c1000000-0000-0000-0000-000000000002",
  },
  {
    termEn: "salmon",
    termEs: "salmon",
    canonical: "salmon",
    categoryId: "c1000000-0000-0000-0000-000000000002",
  },
  {
    termEn: "ham",
    termEs: "jamon",
    canonical: "ham",
    categoryId: "c1000000-0000-0000-0000-000000000002",
  },
  {
    termEn: "bacon",
    termEs: "bacon",
    canonical: "bacon",
    categoryId: "c1000000-0000-0000-0000-000000000002",
    variants: ["tocino"],
  },
  {
    termEn: "sausage",
    termEs: "salchicha",
    canonical: "sausage",
    categoryId: "c1000000-0000-0000-0000-000000000002",
    variants: ["sausages", "salchichas"],
  },

  // Dairy
  {
    termEn: "milk",
    termEs: "leche",
    canonical: "milk",
    categoryId: "c1000000-0000-0000-0000-000000000003",
  },
  {
    termEn: "cheese",
    termEs: "queso",
    canonical: "cheese",
    categoryId: "c1000000-0000-0000-0000-000000000003",
  },
  {
    termEn: "butter",
    termEs: "mantequilla",
    canonical: "butter",
    categoryId: "c1000000-0000-0000-0000-000000000003",
  },
  {
    termEn: "yogurt",
    termEs: "yogur",
    canonical: "yogurt",
    categoryId: "c1000000-0000-0000-0000-000000000003",
  },
  {
    termEn: "cream",
    termEs: "nata",
    canonical: "cream",
    categoryId: "c1000000-0000-0000-0000-000000000003",
    variants: ["crema"],
  },
  {
    termEn: "eggs",
    termEs: "huevos",
    canonical: "eggs",
    categoryId: "c1000000-0000-0000-0000-000000000003",
    variants: ["egg", "huevo"],
  },

  // Bakery
  {
    termEn: "bread",
    termEs: "pan",
    canonical: "bread",
    categoryId: "c1000000-0000-0000-0000-000000000004",
  },
  {
    termEn: "croissant",
    termEs: "cruasan",
    canonical: "croissant",
    categoryId: "c1000000-0000-0000-0000-000000000004",
    variants: ["croissants"],
  },
  {
    termEn: "bagel",
    termEs: "bagel",
    canonical: "bagel",
    categoryId: "c1000000-0000-0000-0000-000000000004",
    variants: ["bagels"],
  },
  {
    termEn: "tortilla",
    termEs: "tortilla",
    canonical: "tortilla",
    categoryId: "c1000000-0000-0000-0000-000000000004",
    variants: ["tortillas"],
  },

  // Pantry
  {
    termEn: "rice",
    termEs: "arroz",
    canonical: "rice",
    categoryId: "c1000000-0000-0000-0000-000000000005",
  },
  {
    termEn: "pasta",
    termEs: "pasta",
    canonical: "pasta",
    categoryId: "c1000000-0000-0000-0000-000000000005",
  },
  {
    termEn: "flour",
    termEs: "harina",
    canonical: "flour",
    categoryId: "c1000000-0000-0000-0000-000000000005",
  },
  {
    termEn: "sugar",
    termEs: "azucar",
    canonical: "sugar",
    categoryId: "c1000000-0000-0000-0000-000000000005",
  },
  {
    termEn: "salt",
    termEs: "sal",
    canonical: "salt",
    categoryId: "c1000000-0000-0000-0000-000000000005",
  },
  {
    termEn: "oil",
    termEs: "aceite",
    canonical: "oil",
    categoryId: "c1000000-0000-0000-0000-000000000005",
    variants: ["olive oil", "aceite de oliva"],
  },
  {
    termEn: "beans",
    termEs: "frijoles",
    canonical: "beans",
    categoryId: "c1000000-0000-0000-0000-000000000005",
    variants: ["bean", "judias", "alubias"],
  },
  {
    termEn: "soup",
    termEs: "sopa",
    canonical: "soup",
    categoryId: "c1000000-0000-0000-0000-000000000005",
  },
  {
    termEn: "cereal",
    termEs: "cereal",
    canonical: "cereal",
    categoryId: "c1000000-0000-0000-0000-000000000005",
    variants: ["cereales"],
  },

  // Frozen
  {
    termEn: "ice cream",
    termEs: "helado",
    canonical: "ice cream",
    categoryId: "c1000000-0000-0000-0000-000000000006",
  },
  {
    termEn: "frozen pizza",
    termEs: "pizza congelada",
    canonical: "frozen pizza",
    categoryId: "c1000000-0000-0000-0000-000000000006",
  },
  {
    termEn: "frozen vegetables",
    termEs: "verduras congeladas",
    canonical: "frozen vegetables",
    categoryId: "c1000000-0000-0000-0000-000000000006",
  },

  // Snacks
  {
    termEn: "chips",
    termEs: "patatas fritas",
    canonical: "chips",
    categoryId: "c1000000-0000-0000-0000-000000000007",
    variants: ["crisps"],
  },
  {
    termEn: "chocolate",
    termEs: "chocolate",
    canonical: "chocolate",
    categoryId: "c1000000-0000-0000-0000-000000000007",
  },
  {
    termEn: "cookies",
    termEs: "galletas",
    canonical: "cookies",
    categoryId: "c1000000-0000-0000-0000-000000000007",
    variants: ["cookie", "biscuits", "galleta"],
  },
  {
    termEn: "nuts",
    termEs: "frutos secos",
    canonical: "nuts",
    categoryId: "c1000000-0000-0000-0000-000000000007",
    variants: ["nueces"],
  },

  // Drinks
  {
    termEn: "water",
    termEs: "agua",
    canonical: "water",
    categoryId: "c1000000-0000-0000-0000-000000000008",
  },
  {
    termEn: "juice",
    termEs: "zumo",
    canonical: "juice",
    categoryId: "c1000000-0000-0000-0000-000000000008",
    variants: ["jugo"],
  },
  {
    termEn: "coffee",
    termEs: "cafe",
    canonical: "coffee",
    categoryId: "c1000000-0000-0000-0000-000000000008",
  },
  {
    termEn: "tea",
    termEs: "te",
    canonical: "tea",
    categoryId: "c1000000-0000-0000-0000-000000000008",
  },
  {
    termEn: "soda",
    termEs: "refresco",
    canonical: "soda",
    categoryId: "c1000000-0000-0000-0000-000000000008",
    variants: ["cola", "soft drink"],
  },
  {
    termEn: "beer",
    termEs: "cerveza",
    canonical: "beer",
    categoryId: "c1000000-0000-0000-0000-000000000008",
  },
  {
    termEn: "wine",
    termEs: "vino",
    canonical: "wine",
    categoryId: "c1000000-0000-0000-0000-000000000008",
  },

  // Baby
  {
    termEn: "diapers",
    termEs: "panales",
    canonical: "diapers",
    categoryId: "c1000000-0000-0000-0000-000000000009",
    variants: ["nappies", "panal"],
  },
  {
    termEn: "baby food",
    termEs: "comida de bebe",
    canonical: "baby food",
    categoryId: "c1000000-0000-0000-0000-000000000009",
    variants: ["papilla"],
  },
  {
    termEn: "formula",
    termEs: "formula",
    canonical: "formula",
    categoryId: "c1000000-0000-0000-0000-000000000009",
    variants: ["baby formula", "leche de formula"],
  },

  // Household
  {
    termEn: "detergent",
    termEs: "detergente",
    canonical: "detergent",
    categoryId: "c1000000-0000-0000-0000-000000000010",
  },
  {
    termEn: "dish soap",
    termEs: "jabon para platos",
    canonical: "dish soap",
    categoryId: "c1000000-0000-0000-0000-000000000010",
    variants: ["lavavajillas"],
  },
  {
    termEn: "bleach",
    termEs: "lejia",
    canonical: "bleach",
    categoryId: "c1000000-0000-0000-0000-000000000010",
  },
  {
    termEn: "paper towels",
    termEs: "papel de cocina",
    canonical: "paper towels",
    categoryId: "c1000000-0000-0000-0000-000000000010",
    variants: ["kitchen roll"],
  },
  {
    termEn: "trash bags",
    termEs: "bolsas de basura",
    canonical: "trash bags",
    categoryId: "c1000000-0000-0000-0000-000000000010",
    variants: ["garbage bags", "bin bags"],
  },
  {
    termEn: "sponge",
    termEs: "esponja",
    canonical: "sponge",
    categoryId: "c1000000-0000-0000-0000-000000000010",
    variants: ["sponges", "esponjas"],
  },

  // Toiletries
  {
    termEn: "shampoo",
    termEs: "champu",
    canonical: "shampoo",
    categoryId: "c1000000-0000-0000-0000-000000000011",
  },
  {
    termEn: "conditioner",
    termEs: "acondicionador",
    canonical: "conditioner",
    categoryId: "c1000000-0000-0000-0000-000000000011",
  },
  {
    termEn: "soap",
    termEs: "jabon",
    canonical: "soap",
    categoryId: "c1000000-0000-0000-0000-000000000011",
  },
  {
    termEn: "toothpaste",
    termEs: "pasta de dientes",
    canonical: "toothpaste",
    categoryId: "c1000000-0000-0000-0000-000000000011",
    variants: ["dentifrico"],
  },
  {
    termEn: "toilet paper",
    termEs: "papel higienico",
    canonical: "toilet paper",
    categoryId: "c1000000-0000-0000-0000-000000000011",
  },
  {
    termEn: "deodorant",
    termEs: "desodorante",
    canonical: "deodorant",
    categoryId: "c1000000-0000-0000-0000-000000000011",
  },
];

// Build lookup maps for fast access
export const DICTIONARY_BY_EN = new Map(
  DICTIONARY.flatMap((entry) => {
    const terms = [entry.termEn, ...(entry.variants || [])];
    return terms.map((term) => [term.toLowerCase(), entry]);
  })
);

export const DICTIONARY_BY_ES = new Map(
  DICTIONARY.flatMap((entry) => {
    const terms = [entry.termEs, ...(entry.variants || [])];
    return terms.map((term) => [term.toLowerCase(), entry]);
  })
);
```

### Duplicate Detection Service

```typescript
// lib/matching/DuplicateDetector.ts
import { normalizeText, parseQuantity, ParsedInput } from "./normalize";
import { isSimilar, containsMatch } from "./fuzzy";
import {
  DICTIONARY_BY_EN,
  DICTIONARY_BY_ES,
  DictionaryEntry,
} from "./dictionary";
import { db, ListItem } from "@/lib/db";

export interface MatchResult {
  parsed: ParsedInput & { displayName: string };
  categorySuggestion: { id: string; name: string } | null;
  duplicate: {
    found: boolean;
    confidence: number;
    existingItem: ListItem | null;
    matchReason: "exact" | "dictionary" | "fuzzy" | "contains" | null;
  };
}

export async function checkForDuplicate(
  listId: string,
  inputText: string
): Promise<MatchResult> {
  // 1. Parse input
  const parsed = parseQuantity(inputText);
  const normalized = normalizeText(parsed.text);

  // 2. Dictionary lookup
  const dictEntry =
    DICTIONARY_BY_EN.get(normalized) || DICTIONARY_BY_ES.get(normalized);

  // 3. Determine display name and category
  const displayName = dictEntry
    ? dictEntry.canonical.charAt(0).toUpperCase() + dictEntry.canonical.slice(1)
    : parsed.text.charAt(0).toUpperCase() + parsed.text.slice(1);

  const categorySuggestion = dictEntry
    ? { id: dictEntry.categoryId, name: dictEntry.termEn }
    : null;

  // 4. Fetch active items from list
  const activeItems = await db.listItems
    .where("[listId+status]")
    .equals([listId, "pending"])
    .toArray();

  // 5. Check for duplicates
  let bestMatch: MatchResult["duplicate"] = {
    found: false,
    confidence: 0,
    existingItem: null,
    matchReason: null,
  };

  for (const item of activeItems) {
    const itemNormalized = normalizeText(item.displayName);

    // Exact match
    if (itemNormalized === normalized) {
      bestMatch = {
        found: true,
        confidence: 1.0,
        existingItem: item,
        matchReason: "exact",
      };
      break;
    }

    // Dictionary match
    if (dictEntry) {
      const itemDictEntry =
        DICTIONARY_BY_EN.get(itemNormalized) ||
        DICTIONARY_BY_ES.get(itemNormalized);
      if (itemDictEntry && itemDictEntry.canonical === dictEntry.canonical) {
        bestMatch = {
          found: true,
          confidence: 0.95,
          existingItem: item,
          matchReason: "dictionary",
        };
        break;
      }
    }

    // Fuzzy match (only if no better match found)
    if (bestMatch.confidence < 0.8 && isSimilar(normalized, itemNormalized)) {
      bestMatch = {
        found: true,
        confidence: 0.8,
        existingItem: item,
        matchReason: "fuzzy",
      };
    }

    // Contains match
    if (
      bestMatch.confidence < 0.7 &&
      containsMatch(normalized, itemNormalized)
    ) {
      bestMatch = {
        found: true,
        confidence: 0.7,
        existingItem: item,
        matchReason: "contains",
      };
    }
  }

  return {
    parsed: { ...parsed, displayName },
    categorySuggestion,
    duplicate: bestMatch,
  };
}
```

---

## 9. Data Flow Diagrams

### Add Item Flow

```
                                    ADD ITEM FLOW

    User                  AddItemBar              DuplicateDetector         Dexie           SyncEngine
      |                       |                          |                    |                  |
      |  types "leche 2"      |                          |                    |                  |
      |---------------------->|                          |                    |                  |
      |                       |                          |                    |                  |
      |                       |  checkForDuplicate()     |                    |                  |
      |                       |------------------------->|                    |                  |
      |                       |                          |                    |                  |
      |                       |                          |  query active items|                  |
      |                       |                          |------------------->|                  |
      |                       |                          |<-------------------|                  |
      |                       |                          |                    |                  |
      |                       |   MatchResult            |                    |                  |
      |                       |   (found: true,          |                    |                  |
      |                       |    confidence: 0.95,     |                    |                  |
      |                       |    existingItem: "Milk") |                    |                  |
      |                       |<-------------------------|                    |                  |
      |                       |                          |                    |                  |
      |  show duplicate sheet |                          |                    |                  |
      |<----------------------|                          |                    |                  |
      |                       |                          |                    |                  |
      |  user taps "Merge"    |                          |                    |                  |
      |---------------------->|                          |                    |                  |
      |                       |                          |                    |                  |
      |                       |  update existing item (qty: 1+2=3)           |                  |
      |                       |-------------------------------------------- >|                  |
      |                       |                          |                    |                  |
      |                       |                          |                    |  queueChange()   |
      |                       |                          |                    |----------------->|
      |                       |                          |                    |                  |
      |  UI updates via       |                          |                    |                  |
      |  liveQuery            |                          |                    |                  |
      |<--------------------------------------------------------------- -----|                  |
      |                       |                          |                    |                  |
      |                       |                          |                    |  (if online)     |
      |                       |                          |                    |  push to Supabase|
      |                       |                          |                    |                  |
```

### Real-Time Sync Flow

```
                              REALTIME SYNC FLOW

    User A                Dexie A         Supabase         Realtime          Dexie B            User B
      |                      |               |                |                 |                  |
      |  add "Bread"         |               |                |                 |                  |
      |--------------------->|               |                |                 |                  |
      |                      |               |                |                 |                  |
      |  UI update           |               |                |                 |                  |
      |<---------------------|               |                |                 |                  |
      |                      |               |                |                 |                  |
      |                      |  INSERT       |                |                 |                  |
      |                      |-------------->|                |                 |                  |
      |                      |               |                |                 |                  |
      |                      |               |  broadcast     |                 |                  |
      |                      |               |  INSERT event  |                 |                  |
      |                      |               |--------------->|                 |                  |
      |                      |               |                |                 |                  |
      |                      |               |                |  postgres_changes                  |
      |                      |               |                |  (INSERT, "Bread")                 |
      |                      |               |                |---------------->|                  |
      |                      |               |                |                 |                  |
      |                      |               |                |                 |  UI update       |
      |                      |               |                |                 |----------------->|
      |                      |               |                |                 |                  |
      |                      |               |                |                 |   sees "Bread"   |
      |                      |               |                |                 |                  |

    Latency: typically < 1 second when both clients online
```

### Offline Reconciliation Flow

```
                        OFFLINE -> ONLINE RECONCILIATION

    User                SyncEngine           Dexie              Supabase
      |                     |                  |                    |
      |  [OFFLINE]          |                  |                    |
      |  add "Eggs"         |                  |                    |
      |-------------------->|                  |                    |
      |                     |  write item      |                    |
      |                     |----------------->|                    |
      |                     |                  |                    |
      |                     |  queue change    |                    |
      |                     |----------------->|                    |
      |                     |                  |                    |
      |  add "Bacon"        |                  |                    |
      |-------------------->|                  |                    |
      |                     |  write + queue   |                    |
      |                     |----------------->|                    |
      |                     |                  |                    |
      |  [COMES ONLINE]     |                  |                    |
      |-------------------->|                  |                    |
      |                     |                  |                    |
      |                     |  processQueue()  |                    |
      |                     |                  |                    |
      |                     |  read queue      |                    |
      |                     |----------------->|                    |
      |                     |<-----------------|                    |
      |                     |                  |                    |
      |                     |  INSERT "Eggs"   |                    |
      |                     |----------------------------------------->|
      |                     |                  |                    |
      |                     |  INSERT "Bacon"  |                    |
      |                     |----------------------------------------->|
      |                     |                  |                    |
      |                     |  clear queue     |                    |
      |                     |----------------->|                    |
      |                     |                  |                    |
      |                     |  pullRemoteChanges()                  |
      |                     |                  |                    |
      |                     |  get_list_changes(since: lastSync)   |
      |                     |----------------------------------------->|
      |                     |<-----------------------------------------|
      |                     |                  |                    |
      |                     |  apply remote    |                    |
      |                     |  changes to      |                    |
      |                     |  local DB        |                    |
      |                     |----------------->|                    |
      |                     |                  |                    |
      |                     |  update lastSync |                    |
      |                     |----------------->|                    |
      |                     |                  |                    |
      |  sync complete      |                  |                    |
      |<--------------------|                  |                    |
```

---

## 10. Risks, Open Questions & Trade-offs

### Risks

| Risk                                   | Likelihood                    | Impact | Mitigation                                                                           |
| -------------------------------------- | ----------------------------- | ------ | ------------------------------------------------------------------------------------ |
| **Sync conflicts lose data**           | Low (2 users, same household) | High   | Version tracking; if versions diverge significantly, prompt user to resolve manually |
| **Dictionary coverage insufficient**   | Medium                        | Medium | Start with 200 common terms; add user-requested terms in future releases             |
| **Fuzzy matching false positives**     | Medium                        | Low    | Conservative thresholds (Levenshtein <= 2); easy dismiss in UI                       |
| **IndexedDB quota exceeded**           | Very Low                      | Medium | Prune archived lists older than 3 months; monitor storage usage                      |
| **Supabase Realtime connection drops** | Medium                        | Low    | Automatic reconnection with exponential backoff; sync queue catches up               |
| **Service Worker caching issues**      | Low                           | Medium | Versioned cache names; clear on version bump                                         |

### Open Questions

| Question                                 | Options                           | Recommendation                                    |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------- |
| How long to keep archived lists locally? | 30/60/90 days, forever, on-demand | **90 days default**, allow manual clear           |
| Should item notes support rich text?     | Plain text, Markdown, Rich        | **Plain text for MVP** - simple, works offline    |
| How to handle timezone differences?      | UTC everywhere, local times       | **UTC storage, local display** - standard pattern |
| Max items per list before UX degrades?   | 100, 250, 500, unlimited          | **Test at 500**; virtualize list if needed        |

### Trade-offs & Alternatives

| Decision                | Chosen                    | Alternative Considered | Rationale                                                                                         |
| ----------------------- | ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Data Source**         | Dexie (offline-first)     | Supabase with cache    | Critical for in-store use with poor connectivity; Dexie provides reactive queries                 |
| **Conflict Resolution** | Last-write-wins + version | CRDT                   | Simpler implementation; conflicts rare with 2-user household; version tracking catches edge cases |
| **Duplicate Matching**  | Dictionary + fuzzy        | Embeddings/ML          | Works offline, fast, predictable; embeddings add latency, cost, and complexity                    |
| **State Management**    | Zustand + Dexie liveQuery | Redux, React Query     | Lightweight; liveQuery already reactive; Zustand for UI-only state                                |
| **Real-time Protocol**  | Supabase Realtime         | WebSockets + custom    | Integrated with Supabase; handles reconnection; no extra infrastructure                           |
| **Auth Provider**       | Supabase Auth             | Auth0, Firebase Auth   | Single vendor for MVP simplicity; magic link + OAuth sufficient                                   |

---

## 11. Testing Strategy

### Unit Tests

| Component               | Test Cases                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **parseQuantity()**     | "2x milk" -> {qty:2, text:"milk"}, "leche 500g" -> {qty:500, unit:"g"}, "three eggs" -> {qty:3} |
| **normalizeText()**     | Accents removed, lowercase, punctuation handled                                                 |
| **isSimilar()**         | "tomato"/"tomate" (false, different languages), "tomato"/"tomatto" (true, typo)                 |
| **containsMatch()**     | "whole milk"/"milk" (true), "ham"/"hamburger" (false, too short)                                |
| **Dictionary lookup**   | "leche" -> milk entry, "Milk" -> milk entry (case insensitive)                                  |
| **checkForDuplicate()** | Returns correct confidence levels for each match type                                           |

### Integration Tests

| Scenario                               | Test Steps                                                                  | Expected Result                                  |
| -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| **RLS: Access own household**          | Create user A, household, list; query as user A                             | Returns list                                     |
| **RLS: Cannot access other household** | Create users A and B with separate households; user A queries user B's list | Empty result or error                            |
| **Realtime receives events**           | Subscribe to list; insert item via Supabase client                          | Subscription callback fires with correct payload |
| **Sync queue processes on reconnect**  | Add items offline; go online                                                | Items appear in Supabase                         |
| **Version conflict resolution**        | Modify same item on two clients offline; reconnect both                     | Higher version wins                              |

### E2E Tests (Playwright)

| Test Name                             | Steps                                          | Assertions                                       |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| **Add item appears on second device** | Device A adds "Bread"; Device B waits          | Device B sees "Bread" within 5s                  |
| **Duplicate detection merge flow**    | Add "Milk"; Add "leche"                        | Warning sheet appears; merge combines quantities |
| **Duplicate detection dismiss flow**  | Add "Milk"; Add "leche"; tap "Add anyway"      | Both items appear separately                     |
| **Offline add syncs**                 | Go offline; add item; go online                | Item appears in Supabase; other device sees it   |
| **Shopping mode check persists**      | Enter shopping mode; check item; refresh       | Item still checked                               |
| **Invite flow**                       | User A generates invite; User B joins via link | Both see shared list                             |
| **Category reorder**                  | Drag category in store profile settings        | List view reflects new order                     |

### Performance Tests

| Metric                    | Target     | Test Method                           |
| ------------------------- | ---------- | ------------------------------------- |
| Add item latency (local)  | < 50ms     | Performance.now() around Dexie insert |
| List render (100 items)   | < 100ms    | React DevTools Profiler               |
| Initial sync (cold start) | < 3s on 3G | Lighthouse throttling                 |
| Realtime propagation      | < 2s       | Timestamp comparison between devices  |

---

## 12. Implementation Phases

### Phase 0: Foundation (Week 1-2)

**Goal:** Working authentication, household setup, basic list operations.

- [ ] Next.js project setup with TypeScript, Tailwind, shadcn/ui
- [ ] Supabase project with schema migration
- [ ] Auth flow (magic link + Google OAuth)
- [ ] Household creation and invite link flow
- [ ] Basic list page: add, check, delete items
- [ ] Categories display (default order)
- [ ] Dexie.js setup and initial sync
- [ ] PWA manifest and service worker

### Phase 1: Duplicate Detection (Week 3)

**Goal:** Smart duplicate detection working end-to-end.

- [ ] Quantity/unit parsing
- [ ] Normalization pipeline
- [ ] Bundled dictionary (~200 terms)
- [ ] Fuzzy matching
- [ ] Duplicate warning UI
- [ ] Merge flow

### Phase 2: Offline & Sync (Week 4)

**Goal:** Full offline capability with reliable sync.

- [ ] Sync queue implementation
- [ ] Conflict resolution (version-based)
- [ ] Realtime subscriptions
- [ ] Offline indicator
- [ ] Background sync via service worker
- [ ] Reconnection handling

### Phase 3: Store Profiles (Week 5)

**Goal:** Store-specific category ordering.

- [ ] Store profile CRUD
- [ ] Drag-drop category ordering
- [ ] Shopping mode with store selector
- [ ] Progress indicator

### Phase 4: Polish & Launch (Week 6)

**Goal:** Production-ready with good UX.

- [ ] Error handling and edge cases
- [ ] Loading states and skeletons
- [ ] Empty states
- [ ] Onboarding flow for new users
- [ ] E2E test suite
- [ ] Performance optimization
- [ ] Production deployment

---

## Appendix A: TypeScript Interfaces

```typescript
// types/index.ts

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  inviteExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  user?: User;
}

export interface List {
  id: string;
  householdId: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  rawText: string;
  displayName: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  categoryId: string | null;
  status: "pending" | "checked";
  addedBy: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface Category {
  id: string;
  name: string;
  nameEs: string;
  icon: string;
  defaultOrder: number;
}

export interface StoreProfile {
  id: string;
  householdId: string;
  storeName: string;
  categoryOrder: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedInput {
  text: string;
  quantity: number;
  unit: string | null;
  original: string;
}

export interface MatchResult {
  parsed: ParsedInput & { displayName: string };
  categorySuggestion: { id: string; name: string } | null;
  duplicate: {
    found: boolean;
    confidence: number;
    existingItem: ListItem | null;
    matchReason: "exact" | "dictionary" | "fuzzy" | "contains" | null;
  };
}

export type SyncStatus =
  | { status: "synced"; lastSync: Date }
  | { status: "syncing" }
  | { status: "offline" }
  | { status: "error"; error: unknown };
```

---

## Appendix B: Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Only needed for Edge Functions (server-side)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Appendix C: File Structure

```
shoppy/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── callback/route.ts
│   │   └── join/[code]/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── list/
│   │   │   ├── page.tsx
│   │   │   └── shopping/page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   ├── stores/page.tsx
│   │   │   └── invite/page.tsx
│   │   └── onboarding/page.tsx
│   ├── manifest.ts
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                    # shadcn/ui
│   ├── list/
│   ├── shopping/
│   ├── settings/
│   ├── layout/
│   └── providers/
├── hooks/
│   ├── useListItems.ts
│   ├── useHousehold.ts
│   ├── useSyncStatus.ts
│   └── useOnlineStatus.ts
├── lib/
│   ├── db/
│   │   └── index.ts           # Dexie setup
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── sync/
│   │   ├── SyncEngine.ts
│   │   └── RealtimeHandler.ts
│   ├── matching/
│   │   ├── normalize.ts
│   │   ├── fuzzy.ts
│   │   ├── dictionary.ts
│   │   └── DuplicateDetector.ts
│   └── store/
│       └── index.ts           # Zustand
├── public/
│   ├── sw.js
│   ├── icon-192x192.png
│   └── icon-512x512.png
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       ├── match_item/index.ts
│       └── merge_items/index.ts
├── types/
│   └── index.ts
├── next.config.js
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```
