import { describe, expect, it } from "vitest";

import {
  createIngredientAliasSet,
  normalizeIngredientName,
  tokenizeIngredientName,
} from "../src/modules/recommendations/ingredient-normalizer.js";

describe("ingredient normalizer", () => {
  it("normalizes Vietnamese ingredient names for matching", () => {
    expect(normalizeIngredientName("  Thịt Bò, Hành Tím!! ")).toBe(
      "thit bo hanh tim",
    );
    expect(normalizeIngredientName("Đậu hũ non")).toBe("dau hu non");
  });

  it("tokenizes normalized names", () => {
    expect(tokenizeIngredientName("Nước mắm ngon")).toEqual([
      "nuoc",
      "mam",
      "ngon",
    ]);
  });

  it("deduplicates normalized aliases", () => {
    expect(
      createIngredientAliasSet([
        "Cà chua",
        "ca chua",
        "  CÀ   CHUA  ",
        "hành lá",
      ]),
    ).toEqual(["ca chua", "hanh la"]);
  });
});
