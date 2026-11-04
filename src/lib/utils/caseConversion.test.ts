import { describe, expect, it } from "vitest";

import { toCamelCase, toSnakeCase } from "./caseConversion";

describe("toSnakeCase", () => {
  it("converts camelCase keys to snake_case", () => {
    const input = { displayName: "Milk", categoryId: "123" };
    const expected = { display_name: "Milk", category_id: "123" };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("handles multiple uppercase letters in sequence", () => {
    const input = { userID: "abc", itemURLPath: "/items" };
    const expected = { user_i_d: "abc", item_u_r_l_path: "/items" };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("handles keys starting with lowercase", () => {
    const input = { id: "1", createdAt: "2024-01-01" };
    const expected = { id: "1", created_at: "2024-01-01" };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("converts nested objects recursively", () => {
    const input = {
      userId: "1",
      userData: {
        firstName: "John",
        lastName: "Doe",
        contactInfo: {
          emailAddress: "john@example.com",
          phoneNumber: "123-456-7890",
        },
      },
    };
    const expected = {
      user_id: "1",
      user_data: {
        first_name: "John",
        last_name: "Doe",
        contact_info: {
          email_address: "john@example.com",
          phone_number: "123-456-7890",
        },
      },
    };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("converts arrays of objects", () => {
    const input = [
      { itemId: "1", displayName: "Apple" },
      { itemId: "2", displayName: "Banana" },
    ];
    const expected = [
      { item_id: "1", display_name: "Apple" },
      { item_id: "2", display_name: "Banana" },
    ];
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("handles nested arrays within objects", () => {
    const input = {
      listId: "1",
      items: [
        { itemName: "Milk", quantity: 2 },
        { itemName: "Bread", quantity: 1 },
      ],
    };
    const expected = {
      list_id: "1",
      items: [
        { item_name: "Milk", quantity: 2 },
        { item_name: "Bread", quantity: 1 },
      ],
    };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("returns null for null input", () => {
    expect(toSnakeCase(null)).toBeNull();
  });

  it("returns undefined for undefined input", () => {
    expect(toSnakeCase(undefined)).toBeUndefined();
  });

  it("returns empty object for empty object input", () => {
    expect(toSnakeCase({})).toEqual({});
  });

  it("returns empty array for empty array input", () => {
    expect(toSnakeCase([])).toEqual([]);
  });

  it("preserves primitive values in arrays", () => {
    const input = { tags: ["red", "green", "blue"], counts: [1, 2, 3] };
    const expected = { tags: ["red", "green", "blue"], counts: [1, 2, 3] };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("handles null and undefined values within objects", () => {
    const input = { firstName: "John", middleName: null, lastName: undefined };
    const expected = {
      first_name: "John",
      middle_name: null,
      last_name: undefined,
    };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("preserves boolean values", () => {
    const input = { isActive: true, hasCompleted: false };
    const expected = { is_active: true, has_completed: false };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("preserves number values", () => {
    const input = { itemCount: 42, priceInCents: 999 };
    const expected = { item_count: 42, price_in_cents: 999 };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it("preserves Date objects", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const input = { createdAt: date, userName: "John" };
    const result = toSnakeCase(input);
    expect(result).toEqual({ created_at: date, user_name: "John" });
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at).toBe(date);
  });

  it("preserves Date objects in nested structures", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const input = {
      userData: {
        lastLogin: date,
        profile: {
          updatedAt: date,
        },
      },
    };
    const result = toSnakeCase(input);
    expect(result.user_data.last_login).toBe(date);
    expect(result.user_data.profile.updated_at).toBe(date);
  });
});

describe("toCamelCase", () => {
  it("converts snake_case keys to camelCase", () => {
    const input = { display_name: "Milk", category_id: "123" };
    const expected = { displayName: "Milk", categoryId: "123" };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("handles multiple underscores", () => {
    const input = { user_first_name: "John", item_category_id: "abc" };
    const expected = { userFirstName: "John", itemCategoryId: "abc" };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("handles keys without underscores", () => {
    const input = { id: "1", name: "Test" };
    const expected = { id: "1", name: "Test" };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("converts nested objects recursively", () => {
    const input = {
      user_id: "1",
      user_data: {
        first_name: "John",
        last_name: "Doe",
        contact_info: {
          email_address: "john@example.com",
          phone_number: "123-456-7890",
        },
      },
    };
    const expected = {
      userId: "1",
      userData: {
        firstName: "John",
        lastName: "Doe",
        contactInfo: {
          emailAddress: "john@example.com",
          phoneNumber: "123-456-7890",
        },
      },
    };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("converts arrays of objects", () => {
    const input = [
      { item_id: "1", display_name: "Apple" },
      { item_id: "2", display_name: "Banana" },
    ];
    const expected = [
      { itemId: "1", displayName: "Apple" },
      { itemId: "2", displayName: "Banana" },
    ];
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("handles nested arrays within objects", () => {
    const input = {
      list_id: "1",
      items: [
        { item_name: "Milk", quantity: 2 },
        { item_name: "Bread", quantity: 1 },
      ],
    };
    const expected = {
      listId: "1",
      items: [
        { itemName: "Milk", quantity: 2 },
        { itemName: "Bread", quantity: 1 },
      ],
    };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("returns null for null input", () => {
    expect(toCamelCase(null)).toBeNull();
  });

  it("returns undefined for undefined input", () => {
    expect(toCamelCase(undefined)).toBeUndefined();
  });

  it("returns empty object for empty object input", () => {
    expect(toCamelCase({})).toEqual({});
  });

  it("returns empty array for empty array input", () => {
    expect(toCamelCase([])).toEqual([]);
  });

  it("preserves primitive values in arrays", () => {
    const input = { tags: ["red", "green", "blue"], counts: [1, 2, 3] };
    const expected = { tags: ["red", "green", "blue"], counts: [1, 2, 3] };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("handles null and undefined values within objects", () => {
    const input = {
      first_name: "John",
      middle_name: null,
      last_name: undefined,
    };
    const expected = {
      firstName: "John",
      middleName: null,
      lastName: undefined,
    };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("preserves boolean values", () => {
    const input = { is_active: true, has_completed: false };
    const expected = { isActive: true, hasCompleted: false };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("preserves number values", () => {
    const input = { item_count: 42, price_in_cents: 999 };
    const expected = { itemCount: 42, priceInCents: 999 };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it("preserves Date objects", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const input = { created_at: date, user_name: "John" };
    const result = toCamelCase(input);
    expect(result).toEqual({ createdAt: date, userName: "John" });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt).toBe(date);
  });

  it("preserves Date objects in nested structures", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const input = {
      user_data: {
        last_login: date,
        profile: {
          updated_at: date,
        },
      },
    };
    const result = toCamelCase(input);
    expect(result.userData.lastLogin).toBe(date);
    expect(result.userData.profile.updatedAt).toBe(date);
  });
});

describe("round-trip conversion", () => {
  it("converts camelCase to snake_case and back", () => {
    const original = {
      userId: "1",
      displayName: "Test Item",
      createdAt: "2024-01-01",
      metadata: {
        lastModified: "2024-01-02",
        modifiedBy: "user-1",
      },
    };
    const snakeCase = toSnakeCase(original);
    const backToCamel = toCamelCase(snakeCase);
    expect(backToCamel).toEqual(original);
  });

  it("converts snake_case to camelCase and back", () => {
    const original = {
      user_id: "1",
      display_name: "Test Item",
      created_at: "2024-01-01",
      metadata: {
        last_modified: "2024-01-02",
        modified_by: "user-1",
      },
    };
    const camelCase = toCamelCase(original);
    const backToSnake = toSnakeCase(camelCase);
    expect(backToSnake).toEqual(original);
  });
});
