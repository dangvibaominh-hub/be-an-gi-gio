import { Router } from "express";

import { CategoryController } from "./category.controller.js";
import type { CategoryRepository } from "./category.repository.js";

export function createCategoryRouter(repository: CategoryRepository) {
  const router = Router();
  const controller = new CategoryController(repository);

  router.get("/", controller.list);

  return router;
}
