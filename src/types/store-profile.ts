/**
 * Store profile type for representing a store's custom category ordering.
 * Used for optimizing shopping trips by ordering items based on store layout.
 */
export interface StoreProfile {
  id: string;
  household_id: string;
  store_name: string;
  category_order: string[]; // Array of category UUIDs in preferred order
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new store profile.
 */
export interface CreateStoreProfileInput {
  household_id: string;
  store_name: string;
  category_order: string[];
  is_default?: boolean;
}

/**
 * Input for updating an existing store profile.
 */
export interface UpdateStoreProfileInput {
  store_name?: string;
  category_order?: string[];
  is_default?: boolean;
}
