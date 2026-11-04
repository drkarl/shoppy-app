import type { Category } from "./index";

/**
 * Bundled categories for initial database seeding.
 * These 11 categories are the default grocery categories used by the app.
 * UUIDs match the Supabase seed data for consistency.
 * @see supabase/migrations/002_seed_categories.sql for the canonical Supabase seed data.
 */
export const BUNDLED_CATEGORIES: Category[] = [
  {
    id: "c1000000-0000-0000-0000-000000000001",
    name: "Produce",
    nameEs: "Frutas y Verduras",
    icon: "carrot",
    defaultOrder: 1,
  },
  {
    id: "c1000000-0000-0000-0000-000000000002",
    name: "Meat & Fish",
    nameEs: "Carne y Pescado",
    icon: "beef",
    defaultOrder: 2,
  },
  {
    id: "c1000000-0000-0000-0000-000000000003",
    name: "Dairy",
    nameEs: "Lácteos",
    icon: "milk",
    defaultOrder: 3,
  },
  {
    id: "c1000000-0000-0000-0000-000000000004",
    name: "Bakery",
    nameEs: "Panadería",
    icon: "bread-slice",
    defaultOrder: 4,
  },
  {
    id: "c1000000-0000-0000-0000-000000000005",
    name: "Pantry",
    nameEs: "Despensa",
    icon: "package",
    defaultOrder: 5,
  },
  {
    id: "c1000000-0000-0000-0000-000000000006",
    name: "Frozen",
    nameEs: "Congelados",
    icon: "snowflake",
    defaultOrder: 6,
  },
  {
    id: "c1000000-0000-0000-0000-000000000007",
    name: "Snacks",
    nameEs: "Snacks",
    icon: "cookie",
    defaultOrder: 7,
  },
  {
    id: "c1000000-0000-0000-0000-000000000008",
    name: "Drinks",
    nameEs: "Bebidas",
    icon: "cup-soda",
    defaultOrder: 8,
  },
  {
    id: "c1000000-0000-0000-0000-000000000009",
    name: "Baby",
    nameEs: "Bebé",
    icon: "baby",
    defaultOrder: 9,
  },
  {
    id: "c1000000-0000-0000-0000-000000000010",
    name: "Household",
    nameEs: "Hogar y Limpieza",
    icon: "spray-can",
    defaultOrder: 10,
  },
  {
    id: "c1000000-0000-0000-0000-000000000011",
    name: "Toiletries",
    nameEs: "Higiene Personal",
    icon: "bath",
    defaultOrder: 11,
  },
];
