import type { Pool } from "pg";

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
