# Collaborative Smart Shopping List (ES/EN) — Product & Technical Design Brief

## 1) Summary

A shared shopping-list app for two users that:

- Lets both users add items collaboratively in real time.
- Detects duplicates (including Spanish/English mixed language, brand vs generic names).
- Suggests merging quantities or warns an item is already present.
- Groups items the way you’d walk a supermarket (aisle-style categories and store-specific ordering).
- Learns from historical purchases to suggest likely-needed items (“cadence” / replenishment) and improves matching over time.
- _Later_ can attempt online fulfillment / store optimization (e.g., “best store to: Tesco vs Lidl”).

The design is intentionally layered so the first version is genuinely useful quickly, and advanced features are added without rework.

---

## 2) Target Users & Context

- Primary users: a single household (2 members initially).
- Languages: Spanish + English mixed input.
- Shopping modes:
  1. In-person shopping (needs aisle grouping and offline reliability).
  2. Optional later: online ordering / fulfillment optimization.

---

## 3) Product Goals

### Core goals (must-have)

1. **Fast add**: Add items with minimal friction.
2. **Collaborative**: Two users see updates in near real time.
3. **Duplicate detection**: Detect duplicates and propose merge.
4. **Grouping**: Present list grouped by supermarket categories with a sensible order.

### Advanced goals (later)

5. **Learning**: Learn household vocabulary (aliases) and shopping cadence.
6. **Suggestions**: “Due soon” and “often bought together” suggestions.
7. **Fulfillment / store optimization**: Match items to store products and propose where to buy.

### Non-goals for MVP

- Recipe planning, nutrition tracking, receipts scanning.
- Full price comparison across retailers (requires reliable product/price data sources).

---

## 4) MVP Scope (Phased)

### Phase 0 — MVP (high value quickly)

- Shared household + authentication
- One active shopping list
- Add item: text input (+ optional quantity)
- Basic de-dup:
  - Strong match → warn + “merge quantities” CTA

- Category grouping:
  - Default categories
  - User can reassign item category

- In-store mode:
  - Group + show categories in a chosen order

### Phase 1 — Better matching (bilingual + household learning)

- Improved normalization + bilingual semantic matching
- Alias learning (if users merge A with B, store as alias)
- Better unit parsing (“2x”, “two”, etc.)

### Phase 2 — Learning & suggestions

- Purchase history (checked-off events)
- Cadence model (“you buy eggs weekly; due soon”)
- Co-occurrence suggestions (“tortillas often with guacamole”)

### Phase 3 — Store mode polish

- Store selection (Tesco / Lidl / etc.)
- Store-specific category order
- Favorites and frequent items

### Phase 4 — Online fulfillment / optimization (research-heavy)

- Item → product matching per store
- “Deep-link” to store search/cart when possible
- Optimization logic: “buy these at Tesco, those at Lidl” (only if legal + reliable data sources exist)

---

## 5) Key UX Flows

### 5.1 Add Item

1. User types: `leche 2` or `milk` or `coca cola`.
2. App parses quantity/unit if present.
3. App runs duplicate check against current list.
4. If duplicate probable:
   - Show prompt: “Already on list: Milk. Merge quantities?”

5. If not duplicate:
   - Create new item, auto-category.

### 5.2 Shopping (In-person)

- “Shopping mode” screen:
  - Items grouped by category
  - Categories ordered for the selected store
  - One-tap to check off

### 5.3 Suggestions (later)

- “Suggested” section:
  - Due-soon items
  - Co-occurrence items
  - One-tap add

---

## 6) Data Model (Future-proof but simple)

### Entities

**Household**

- `id`
- `name`
- `members[]`
- `preferred_languages` (e.g., ["es", "en"])
- `preferred_stores[]`

**List**

- `id`
- `household_id`
- `status` (active/archived)
- timestamps

**ListItem**

- `id`
- `list_id`
- `raw_text` (original user input)
- `canonical_item_id` (nullable initially)
- `quantity` (nullable)
- `unit` (nullable)
- `note` (nullable)
- `category_id` (nullable; may be inferred)
- `status` (active/checked)
- `added_by_user_id`
- timestamps

**CanonicalItem** (the “concept”)

- `id`
- `household_id` (household-specific learning)
- `display_name` (e.g., “Milk”)
- `default_category_id`
- `aliases[]` (e.g., leche, milk, semi-skimmed milk)
- optional: `brand_tokens[]`
- optional: embedding vector

**Category**

- `id`
- `name` (Produce, Dairy, Bakery, etc.)

**StoreProfile**

- `id`
- `household_id`
- `store_name` (Tesco, Lidl, etc.)
- `category_order[]` (ordered list of category IDs)

**PurchaseEvent**

- `id`
- `household_id`
- `canonical_item_id`
- `timestamp_checked`
- `quantity`, `unit` (optional)

---

## 7) Duplicate Detection & Bilingual Understanding

### 7.1 Two-stage matching approach

**Stage A — Normalization + rules (fast, local)**

- Lowercase
- Remove accents (jamón → jamon)
- Remove punctuation
- Basic stemming/plurals heuristic (tomatoes→tomato; huevos→huevo)
- Unit and quantity parsing ("2x", "2", "two")
- Brand hinting: recognize common brand tokens used by the household

**Stage B — Semantic similarity (bilingual, robust)**

- Convert input text into a multilingual embedding vector.
- Compare against:
  1. Active list items (to detect duplicates now)
  2. Household canonical items + aliases (to map to a concept)

- Use cosine similarity (or nearest-neighbor search) with thresholds:
  - High confidence (auto-suggest merge)
  - Medium confidence (show “possible duplicate”)
  - Low confidence (no warning)

### 7.2 Household learning loop

- When users confirm a merge or mapping, store it:
  - Add the merged term to `CanonicalItem.aliases`
  - Optionally store a “confirmed mapping” record

- Over time, the household builds a personalized bilingual vocabulary.

### 7.3 Brand vs generic

- If user adds “Coca-Cola” but list has “cola”:
  - Treat as likely same concept unless a rule indicates otherwise.

- Offer UI choice when ambiguous:
  - “Same item” vs “keep separate”

---

## 8) Categorization (Supermarket grouping)

### 8.1 Default categories

- Produce
- Meat/Fish
- Dairy
- Bakery
- Pantry
- Frozen
- Snacks
- Drinks
- Baby
- Household/Cleaning
- Toiletries/Pharmacy

### 8.2 Store-specific ordering

- User selects store: Tesco / Lidl / etc.
- Each store has a saved category order (drag/drop once).
- Shopping mode uses that order.

---

## 9) Learning & Suggestions (Phase 2+)

### 9.1 Cadence model (replenishment)

For each canonical item:

- Track intervals between purchase events.
- Compute an estimated repurchase interval.
- Score items as “due soon” if elapsed time ≈ interval.

Example copy:

- “You usually buy eggs every ~7 days. Last bought 8 days ago.”

### 9.2 Co-occurrence model

- Track items purchased in the same shopping session.
- Suggest complementary items when one is added.

---

## 10) Online Fulfillment / Store Optimization (Phase 4)

### Reality constraints

- Reliable store pricing/product availability data can be difficult to access legally/consistently.
- Design should support multiple approaches:
  1. **Deep-link** to store search results
  2. Partner/approved APIs (if available)
  3. Licensed datasets or third-party aggregator services

### Desired future behavior

- For each canonical item, attempt to match to store products.
- Optimize based on:
  - availability
  - price (if reliable)
  - delivery constraints

- Output:
  - “Buy these at Tesco” / “Buy these at Lidl”

---

## 11) Tech Stack Recommendations

### Option A — Fastest MVP: PWA + Supabase

**Why:** fastest time-to-use for two people; installable on phones; easy iteration.

- Frontend: Next.js (TypeScript) or SvelteKit
- Offline: Service Worker + IndexedDB (Dexie)
- Backend: Supabase (Postgres + Auth + Realtime)
- Backend logic: Supabase Edge Functions
- Deploy: Vercel/Netlify

### Option B — Best long-term native feel: Flutter + Supabase

**Why:** best offline + store-shopping UX; easy path to iOS/Android stores.

- App: Flutter
- Local DB: SQLite (Drift) or Isar
- Backend: Supabase (Postgres + Realtime)
- Edge functions for matching/suggestions
- Notifications: FCM/APNs (later)

### Option C — React Native (Expo) + Supabase

**Why:** productive JS/TS flow for mobile.

- App: React Native + Expo
- Local DB: SQLite or WatermelonDB
- Backend: Supabase + Edge functions

### Suggested default choice

- If the goal is “usable in 1–2 weeks”: **Option A**.
- If the goal is “real app soon”: **Option B**.

---

## 12) Architecture (Conceptual)

### 12.1 Core components

- **Client app (PWA/Flutter/RN)**
  - Offline local store (items, pending edits)
  - Sync engine (push/pull)
  - UI for list, add, shopping mode

- **Backend (Supabase)**
  - Postgres tables for households, lists, items, canonical items, purchase events
  - Realtime subscriptions for list updates
  - Edge functions:
    - `match_item()` duplicate detection + canonical mapping
    - `suggest_items()` cadence + co-occurrence suggestions

- **Embedding provider** (Phase 1)
  - Hosted embeddings API OR self-hosted multilingual model
  - Store vectors in Postgres (pgvector)

### 12.2 Realtime collaboration

- Clients subscribe to list changes via Supabase Realtime.
- Edits are written as atomic item updates.
- Conflict policy for MVP: last-write-wins per field.

---

## 13) Implementation Notes / Open Decisions

1. **Input method**: start with text; add voice later.
2. **Matching thresholds**: tune with household feedback; store confirmations.
3. **Privacy**: keep data minimal; consider encryption-at-rest and private project settings.
4. **Fulfillment**: treat as an optional research track; do not block MVP.

---

## 14) MVP Acceptance Criteria

- Two users can log in and share one active list.
- Adding an item shows up on the other device quickly.
- Duplicate detection catches common cases (same language, mixed ES/EN basics).
- User can merge quantities in 1 tap.
- List displays grouped by categories with a configurable store order.
- Shopping mode allows checking off items quickly even with poor connectivity (offline-first behavior).
