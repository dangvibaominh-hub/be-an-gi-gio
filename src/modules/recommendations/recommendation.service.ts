import { randomUUID } from "node:crypto";

import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/http/app-error.js";
import {
  hasVietnameseMarks,
  normalizeIngredientName,
  normalizeIngredientNameStrict,
  tokenizeIngredientNameStrict,
} from "./ingredient-normalizer.js";
import type {
  GeneratedRecipeRepository,
  RecommendationCandidate,
  RecommendationCandidateIngredient,
  RecommendationRepository,
} from "./recommendation.repository.js";
import type {
  PersonalizationInsightModel,
} from "../feedback/feedback.model.js";
import type {
  PersonalizationRepository,
} from "../feedback/feedback.repository.js";
import type { SavedRecipeRepository } from "../saved-recipes/saved-recipe.repository.js";
import type { RecipeGenerationAdapter } from "./gemini-recipe.adapter.js";
import type {
  PaginatedRecommendations,
  RecommendationQuery,
  RecipeRecommendationModel,
} from "./recommendation.types.js";

interface NormalizedInput {
  original: string;
  normalized: string;
  strictNormalized: string;
  strictTokens: string[];
  hasMarks: boolean;
}

export class RecommendationService {
  constructor(
    private readonly repository: RecommendationRepository,
    private readonly matchThreshold: number,
    private readonly savedRecipeRepository?: SavedRecipeRepository,
    private readonly recipeGenerationAdapter?: RecipeGenerationAdapter,
    private readonly generatedRecipeRepository?: GeneratedRecipeRepository,
    private readonly personalizationRepository?: PersonalizationRepository,
  ) {}

  async recommend(
    query: RecommendationQuery,
    userId?: string,
  ): Promise<PaginatedRecommendations> {
    const inputs = query.ingredients.map((ingredient) => ({
      original: ingredient,
      normalized: normalizeIngredientName(ingredient),
      strictNormalized: normalizeIngredientNameStrict(ingredient),
      strictTokens: tokenizeIngredientNameStrict(ingredient),
      hasMarks: hasVietnameseMarks(ingredient),
    }));
    const savedRecipePromise =
      userId === undefined || this.savedRecipeRepository === undefined
        ? Promise.resolve([])
        : this.savedRecipeRepository.list(userId);
    const personalizationPromise =
      userId === undefined || this.personalizationRepository === undefined
        ? Promise.resolve(undefined)
        : this.personalizationRepository.getInsight(userId);
    const [savedRecipes, personalization, ingredientVocabulary, candidates] =
      await Promise.all([
        savedRecipePromise,
        personalizationPromise,
        this.repository.listIngredientVocabulary(),
        this.repository.listCandidates(query.filters),
      ]);
    const savedRecipeSlugs = new Set(savedRecipes.map((recipe) => recipe.slug));

    assertKnownIngredients(inputs, ingredientVocabulary);

    const scoredCandidates = candidates
      .map((candidate) =>
        scoreCandidate(
          candidate,
          inputs,
          savedRecipeSlugs.has(candidate.slug),
          personalization,
        ),
      )
      .filter((candidate) => candidate.match.score >= this.matchThreshold)
      .sort(compareRecommendations);

    const total = scoredCandidates.length;

    if (total > 0) {
      const offset = (query.page - 1) * query.limit;
      const items = scoredCandidates.slice(offset, offset + query.limit);

      return {
        items,
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        source: "database",
      };
    }

    const generatedCandidate = await this.createGeneratedFallback(
      query,
      inputs,
      userId,
    );

    if (generatedCandidate === null) {
      return emptyRecommendations(query);
    }

    const generatedRecommendation = scoreCandidate(
      generatedCandidate,
      inputs,
      false,
      personalization,
    );

    return {
      items: query.page === 1 ? [generatedRecommendation] : [],
      page: query.page,
      limit: query.limit,
      total: 1,
      totalPages: 1,
      source: "gemini",
    };
  }

  private async createGeneratedFallback(
    query: RecommendationQuery,
    inputs: NormalizedInput[],
    userId: string | undefined,
  ) {
    if (
      this.recipeGenerationAdapter === undefined ||
      this.generatedRecipeRepository === undefined
    ) {
      return null;
    }

    try {
      const recipe = await this.recipeGenerationAdapter.generateRecipe({
        ingredients: inputs.map((input) => input.original),
        filters: query.filters,
      });

      if (recipe === null) {
        return null;
      }

      return await this.generatedRecipeRepository.save({
        recipe,
        slug: createGeneratedRecipeSlug(recipe.title),
        aiModel: this.recipeGenerationAdapter.model,
        ...(userId === undefined ? {} : { createdBy: userId }),
      });
    } catch (error) {
      logger.warn(
        {
          error: serializeGeminiError(error),
          feature: "recommendations.generated_fallback",
          userId: userId ?? null,
        },
        "Gemini recommendation fallback generation failed; returning empty recommendations.",
      );
      return null;
    }
  }
}

function scoreCandidate(
  candidate: RecommendationCandidate,
  inputs: NormalizedInput[],
  isSavedRecipe: boolean,
  personalization: PersonalizationInsightModel | undefined,
): RecipeRecommendationModel {
  const matchedInputIndexes = new Set<number>();
  const matchedIngredientIds = new Set<string>();

  for (const [inputIndex, input] of inputs.entries()) {
    for (const ingredient of candidate.ingredients) {
      if (!ingredientMatchesInput(ingredient, input)) {
        continue;
      }

      matchedInputIndexes.add(inputIndex);
      matchedIngredientIds.add(ingredient.id);
    }
  }

  const inputCoverage = matchedInputIndexes.size / inputs.length;
  const recipeCoverage =
    candidate.ingredients.length === 0
      ? 0
      : matchedIngredientIds.size / candidate.ingredients.length;
  const missingIngredients = candidate.ingredients
    .filter((ingredient) => !matchedIngredientIds.has(ingredient.id))
    .map((ingredient) => ingredient.name);
  const baseScore =
    inputCoverage * 0.7 + recipeCoverage * 0.3 + (isSavedRecipe ? 0.05 : 0);
  const score = roundScore(
    clampScore(
      baseScore +
        personalizationAdjustment(candidate, missingIngredients, personalization),
    ),
  );

  return {
    id: candidate.id,
    slug: candidate.slug,
    title: candidate.title,
    description: candidate.description,
    image: candidate.image,
    imageAlt: candidate.imageAlt,
    difficulty: candidate.difficulty,
    cookTimeMinutes: candidate.cookTimeMinutes,
    baseServings: candidate.baseServings,
    category: candidate.category,
    ...(candidate.ingredientDetails === undefined
      ? {}
      : { ingredients: candidate.ingredientDetails }),
    ...(candidate.steps === undefined ? {} : { steps: candidate.steps }),
    ...(candidate.cookingTerms === undefined
      ? {}
      : { cookingTerms: candidate.cookingTerms }),
    match: {
      score,
      matchedIngredients: inputs
        .filter((_input, index) => matchedInputIndexes.has(index))
        .map((input) => input.original),
      missingIngredients,
    },
  };
}

function personalizationAdjustment(
  candidate: RecommendationCandidate,
  missingIngredients: string[],
  personalization: PersonalizationInsightModel | undefined,
) {
  if (personalization === undefined || personalization.confidence === 0) {
    return 0;
  }

  const confidence = personalization.confidence;
  const signals = personalization.signals;
  let adjustment = 0;

  const easySignal = signals.preferEasyRecipes * confidence;
  if (candidate.difficulty === "de") {
    adjustment += easySignal;
  } else if (candidate.difficulty === "trung-binh") {
    adjustment += easySignal / 2;
  } else {
    adjustment -= easySignal;
  }

  const quickSignal = signals.preferQuickRecipes * confidence;
  if (candidate.cookTimeMinutes <= 20) {
    adjustment += quickSignal;
  } else if (candidate.cookTimeMinutes <= 30) {
    adjustment += quickSignal / 2;
  } else if (candidate.cookTimeMinutes > 45) {
    adjustment -= quickSignal;
  }

  const fitSignal = signals.preferIngredientFit * confidence;
  adjustment +=
    missingIngredients.length === 0
      ? fitSignal
      : -Math.min(fitSignal, missingIngredients.length * 0.02);

  const techniqueSignal = signals.preferTechniqueGuidance * confidence;
  adjustment += isFryHeavy(candidate) ? -techniqueSignal : techniqueSignal / 2;

  return adjustment;
}

function isFryHeavy(candidate: RecommendationCandidate) {
  const normalizedCategory = normalizeIngredientName(candidate.category);

  return normalizedCategory.includes("chien");
}

function ingredientMatchesInput(
  ingredient: RecommendationCandidateIngredient,
  input: NormalizedInput,
) {
  const values = createIngredientMatchValues(ingredient);

  if (!input.hasMarks) {
    return values.some((candidate) => candidate.normalized === input.normalized);
  }

  if (
    values.some((candidate) => candidate.strictNormalized === input.strictNormalized)
  ) {
    return true;
  }

  const hasFoldedExactMatch = values.some(
    (candidate) => candidate.normalized === input.normalized,
  );

  if (!hasFoldedExactMatch) {
    return false;
  }

  if (input.strictTokens.length > 1) {
    return true;
  }

  const [onlyToken] = input.strictTokens;

  return (
    onlyToken !== undefined &&
    tokenizeIngredientNameStrict(ingredient.name).includes(onlyToken)
  );
}

function createIngredientMatchValues(ingredient: RecommendationCandidateIngredient) {
  return [ingredient.name, ingredient.normalizedName, ...ingredient.aliases]
    .map((value) => ({
      normalized: normalizeIngredientName(value),
      strictNormalized: normalizeIngredientNameStrict(value),
    }))
    .filter(
      (value) =>
        value.normalized.length > 0 && value.strictNormalized.length > 0,
    );
}

function assertKnownIngredients(
  inputs: NormalizedInput[],
  ingredientVocabulary: RecommendationCandidateIngredient[],
) {
  const unknownIngredients = inputs
    .filter(
      (input) =>
        input.normalized.length === 0 ||
        !ingredientVocabulary.some((ingredient) =>
          ingredientMatchesInput(ingredient, input),
        ),
    )
    .map((input) => input.original);

  if (unknownIngredients.length === 0) {
    return;
  }

  throw new AppError(
    422,
    "UNKNOWN_INGREDIENTS",
    "Có thành phần không xác định.",
    { unknownIngredients },
  );
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function compareRecommendations(
  left: RecipeRecommendationModel,
  right: RecipeRecommendationModel,
) {
  return (
    right.match.score - left.match.score ||
    left.match.missingIngredients.length - right.match.missingIngredients.length ||
    left.cookTimeMinutes - right.cookTimeMinutes ||
    left.title.localeCompare(right.title, "vi")
  );
}

function emptyRecommendations(query: RecommendationQuery): PaginatedRecommendations {
  return {
    items: [],
    page: query.page,
    limit: query.limit,
    total: 0,
    totalPages: 0,
    source: "empty",
  };
}

export function createGeneratedRecipeSlug(title: string) {
  const normalizedTitle = normalizeIngredientName(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = randomUUID().slice(0, 8);
  const maxBaseLength = 180 - "gemini--".length - suffix.length;
  const base = (normalizedTitle || "cong-thuc").slice(0, maxBaseLength);

  return `gemini-${base}-${suffix}`;
}

function serializeGeminiError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
