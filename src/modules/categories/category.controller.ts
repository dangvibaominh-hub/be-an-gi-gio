import type { RequestHandler } from "express";

import { asyncHandler } from "../../shared/http/async-handler.js";
import type { CategoryRepository } from "./category.repository.js";

export class CategoryController {
  constructor(private readonly repository: CategoryRepository) {}

  list: RequestHandler = asyncHandler(async (_request, response) => {
    const categories = await this.repository.list();
    response.json({ success: true, data: categories });
  });
}
