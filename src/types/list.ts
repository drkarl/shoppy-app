export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  raw_text: string;
  display_name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  category_id: string | null;
  status: "pending" | "checked";
  added_by: string;
  checked_by: string | null;
  checked_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  categories: Category | null;
}

export interface List {
  id: string;
  household_id: string;
  name: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  households?: {
    id: string;
    name: string;
  };
}

export interface CategoryGroup {
  category: Category | null;
  items: ListItem[];
}
