-- ============================================
-- CATEGORIES SEED DATA MIGRATION
-- ============================================
-- This migration seeds the 11 default product categories.
-- Uses fixed UUIDs for predictable references across environments.
-- Idempotent: safe to run multiple times without creating duplicates.
-- Icon values reference Lucide icons (https://lucide.dev/icons).
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
    ('c1000000-0000-0000-0000-000000000011', 'Toiletries', 'Higiene Personal', 'bath', 11)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_es = EXCLUDED.name_es,
    icon = EXCLUDED.icon,
    default_order = EXCLUDED.default_order;
