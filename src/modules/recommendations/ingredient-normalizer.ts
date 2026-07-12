export function normalizeIngredientName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIngredientNameStrict(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

export function tokenizeIngredientName(value: string) {
  const normalized = normalizeIngredientName(value);

  return normalized.length === 0 ? [] : normalized.split(" ");
}

export function tokenizeIngredientNameStrict(value: string) {
  const normalized = normalizeIngredientNameStrict(value);

  return normalized.length === 0 ? [] : normalized.split(" ");
}

export function hasVietnameseMarks(value: string) {
  return /[\u0300-\u036f\u0111\u0110]/u.test(value.normalize("NFD"));
}

export function createIngredientAliasSet(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeIngredientName(value))
        .filter((value) => value.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right, "vi"));
}
