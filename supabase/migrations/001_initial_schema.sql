-- ============================================
-- SHOPPY INITIAL SCHEMA MIGRATION
-- ============================================
-- This migration creates the complete database schema for Shoppy,
-- a collaborative shopping list application.
--
-- Tables: households, household_members, categories, lists, list_items, store_profiles
-- Features: RLS policies, triggers, helper functions, RPC functions
-- ============================================

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

-- invite_code lookups are served by the UNIQUE constraint's index; a partial
-- index cannot filter on NOW() because index predicates must be IMMUTABLE.

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

-- Auto-create owner membership when household is created
-- This ensures household creation + owner membership is atomic at the database level
CREATE OR REPLACE FUNCTION create_household_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER households_create_owner
    AFTER INSERT ON households
    FOR EACH ROW EXECUTE FUNCTION create_household_owner();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

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

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Regenerate invite code (owner only)
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

-- Join household with invite code validation
-- This function validates the invite code atomically before adding the user
CREATE OR REPLACE FUNCTION join_household_with_code(p_invite_code TEXT)
RETURNS UUID AS $$
DECLARE
    v_household_id UUID;
BEGIN
    -- Find household with valid (non-expired) invite code
    SELECT id INTO v_household_id
    FROM households
    WHERE invite_code = p_invite_code
    AND invite_expires_at > NOW();

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invite code';
    END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = v_household_id
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'You are already a member of this household';
    END IF;

    -- Add user as member
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (v_household_id, auth.uid(), 'member');

    RETURN v_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

