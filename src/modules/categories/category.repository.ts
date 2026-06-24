import type { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CategoryModel } from "./category.model.js";

interface CategoryRow {
  id: string;
  slug: string;
  name: CategoryModel["name"];
}

export interface CategoryRepository {
  list(): Promise<CategoryModel[]>;
}

export class PostgresCategoryRepository implements CategoryRepository {
  constructor(private readonly database: Pool) {}

  async list(): Promise<CategoryModel[]> {
    const result = await this.database.query<CategoryRow>(
      `SELECT id, slug, name
       FROM categories
       ORDER BY display_order, name`,
    );

    return result.rows;
  }
}

export class SupabaseCategoryRepository implements CategoryRepository {
  constructor(private readonly database: SupabaseClient) {}

  async list(): Promise<CategoryModel[]> {
    const { data, error } = await this.database
      .from("categories")
      .select("id, slug, name")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .returns<CategoryRow[]>();

    if (error !== null) {
      throw new Error(error.message);
    }

    return data ?? [];
  }
}
