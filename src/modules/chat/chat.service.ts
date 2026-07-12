import { AppError } from "../../shared/http/app-error.js";
import { logger } from "../../config/logger.js";
import type {
  ChatMessageModel,
  ChatRecipeCandidateModel,
  ChatRecipeReferenceModel,
} from "./chat.model.js";
import type { ChatRepository } from "./chat.repository.js";
import type {
  ChatAssistantAdapter,
  ChatAssistantReply,
} from "./gemini-chat.adapter.js";
import type {
  FeedbackIssue,
  PersonalizationInsightModel,
} from "../feedback/feedback.model.js";
import type {
  PersonalizationRepository,
} from "../feedback/feedback.repository.js";
import type { RecipeGenerationAdapter } from "../recommendations/gemini-recipe.adapter.js";
import type { GeneratedRecipe } from "../recommendations/generated-recipe.schema.js";
import { normalizeIngredientName } from "../recommendations/ingredient-normalizer.js";
import type {
  GeneratedRecipeRepository,
} from "../recommendations/recommendation.repository.js";
import { createGeneratedRecipeSlug } from "../recommendations/recommendation.service.js";
import type { RecommendationFilters } from "../recommendations/recommendation.types.js";
import type {
  CreateChatConversationInput,
  SendChatMessageInput,
} from "./chat.types.js";

interface ChatServiceOptions {
  recipeCandidateLimit: number;
  recipeDraftTimeoutMs: number;
}

interface AssistantDraft {
  content: string;
  recipeReferences: ChatRecipeReferenceModel[];
  model: string | null;
  latencyMs: number | null;
  tokenCount: number | null;
}

const fallbackModel = null;

type GeneratedRecipeDraftResult =
  | { status: "not-requested" }
  | { status: "created"; draft: AssistantDraft }
  | { status: "unavailable"; latencyMs: number | null };

export class ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly assistantAdapter: ChatAssistantAdapter | undefined,
    private readonly options: ChatServiceOptions,
    private readonly personalizationRepository?: PersonalizationRepository,
    private readonly recipeGenerationAdapter?: RecipeGenerationAdapter,
    private readonly generatedRecipeRepository?: GeneratedRecipeRepository,
  ) {}

  createConversation(userId: string, input: CreateChatConversationInput) {
    return this.repository.createConversation(
      userId,
      input.title ?? "Phụ Bếp",
    );
  }

  async listMessages(userId: string, conversationId: string) {
    await this.ensureConversation(userId, conversationId);
    return this.repository.listMessagesForUser(conversationId, userId);
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    input: SendChatMessageInput,
  ) {
    const conversation = await this.ensureConversation(userId, conversationId);
    const previousMessages = await this.repository.listMessagesForUser(
      conversationId,
      userId,
    );
    const userMessage = await this.repository.addMessage({
      conversationId,
      role: "user",
      content: input.content,
    });
    const recipeCandidates = await this.repository.listRecipeCandidates(
      input.content,
      this.options.recipeCandidateLimit,
    );
    const personalization = await this.getPersonalization(userId);
    const generatedRecipeDraft = await this.createGeneratedRecipeDraft(
      input.content,
      personalization,
      userId,
    );
    let assistantDraft: AssistantDraft;

    if (generatedRecipeDraft.status === "created") {
      assistantDraft = generatedRecipeDraft.draft;
    } else if (generatedRecipeDraft.status === "unavailable") {
      assistantDraft = createRecipeGenerationUnavailableDraft(
        recipeCandidates,
        generatedRecipeDraft.latencyMs,
      );
    } else {
      assistantDraft = await this.createAssistantDraft(
        input.content,
        [...previousMessages, userMessage],
        recipeCandidates,
        personalization,
      );
    }
    const assistantMessage = await this.repository.addMessage({
      conversationId,
      role: "assistant",
      content: assistantDraft.content,
      recipeReferences: assistantDraft.recipeReferences,
      model: assistantDraft.model,
      latencyMs: assistantDraft.latencyMs,
      tokenCount: assistantDraft.tokenCount,
    });
    const updatedConversation =
      (await this.repository.findConversationForUser(conversationId, userId)) ??
      conversation;

    return {
      conversation: updatedConversation,
      userMessage,
      assistantMessage,
    };
  }

  private async ensureConversation(userId: string, conversationId: string) {
    const conversation = await this.repository.findConversationForUser(
      conversationId,
      userId,
    );

    if (conversation === null) {
      throw new AppError(
        404,
        "CHAT_CONVERSATION_NOT_FOUND",
        "Không tìm thấy cuộc trò chuyện.",
      );
    }

    return conversation;
  }

  private async createGeneratedRecipeDraft(
    message: string,
    personalization: PersonalizationInsightModel | undefined,
    userId: string,
  ) {
    if (!shouldCreateGeneratedRecipeDraft(message)) {
      return { status: "not-requested" } satisfies GeneratedRecipeDraftResult;
    }

    const recipeGenerationAdapter = this.recipeGenerationAdapter;
    const generatedRecipeRepository = this.generatedRecipeRepository;

    if (
      recipeGenerationAdapter === undefined ||
      generatedRecipeRepository === undefined
    ) {
      logger.warn(
        { feature: "chat.recipe_generation.adapter_missing", userId },
        "Gemini recipe draft generation is not configured.",
      );
      return {
        status: "unavailable",
        latencyMs: null,
      } satisfies GeneratedRecipeDraftResult;
    }

    const startedAt = Date.now();
    const request = buildChatRecipeGenerationRequest(message);

    try {
      const recipe = await runWithTimeout(
        (signal) =>
          recipeGenerationAdapter.generateRecipe(
            {
              ingredients: request.ingredients,
              filters: request.filters,
              request: message,
              userContext: buildPersonalizationContext(personalization),
            },
            { signal },
          ),
        this.options.recipeDraftTimeoutMs,
        "Gemini recipe draft generation timed out.",
      );

      if (recipe === null) {
        logger.warn(
          {
            feature: "chat.recipe_generation.empty",
            model: recipeGenerationAdapter.model,
            userId,
          },
          "Gemini recipe draft generation returned no usable recipe.",
        );
        return {
          status: "unavailable",
          latencyMs: Date.now() - startedAt,
        } satisfies GeneratedRecipeDraftResult;
      }

      await generatedRecipeRepository.save({
        recipe,
        slug: createGeneratedRecipeSlug(recipe.title),
        aiModel: recipeGenerationAdapter.model,
        createdBy: userId,
      });

      return {
        status: "created",
        draft: {
          content: formatGeneratedRecipeDraft(recipe),
          recipeReferences: [],
          model: recipeGenerationAdapter.model,
          latencyMs: Date.now() - startedAt,
          tokenCount: null,
        },
      } satisfies GeneratedRecipeDraftResult;
    } catch (error) {
      logger.warn(
        {
          error: serializeGeminiError(error),
          feature: "chat.recipe_generation",
          userId,
        },
        "Gemini recipe draft generation failed; returning draft-generation fallback.",
      );
      return {
        status: "unavailable",
        latencyMs: Date.now() - startedAt,
      } satisfies GeneratedRecipeDraftResult;
    }
  }

  private async createAssistantDraft(
    message: string,
    history: ChatMessageModel[],
    recipeCandidates: ChatRecipeCandidateModel[],
    personalization: PersonalizationInsightModel | undefined,
  ) {
    if (this.assistantAdapter === undefined) {
      logger.warn(
        { feature: "chat.reply.adapter_missing" },
        "Gemini chat assistant adapter is not configured; using fallback assistant draft.",
      );
      return createFallbackDraft(recipeCandidates);
    }

    const startedAt = Date.now();

    try {
      const reply = await this.assistantAdapter.generateReply({
        message,
        history: history.slice(-8).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        recipeCandidates,
        userContext: buildPersonalizationContext(personalization),
      });

      if (reply === null) {
        logger.warn(
          {
            feature: "chat.reply.empty",
            model: this.assistantAdapter.model,
          },
          "Gemini chat assistant returned no usable reply; using fallback assistant draft.",
        );
        return createFallbackDraft(recipeCandidates, Date.now() - startedAt);
      }

      const recipeReferences = await this.resolveRecipeReferences(reply);

      return {
        content: reply.content,
        recipeReferences,
        model: reply.model ?? this.assistantAdapter.model,
        latencyMs: Date.now() - startedAt,
        tokenCount: reply.tokenCount ?? null,
      };
    } catch (error) {
      logger.warn(
        {
          error: serializeGeminiError(error),
          feature: "chat.reply",
        },
        "Gemini chat reply failed; using fallback assistant draft.",
      );
      return createFallbackDraft(recipeCandidates, Date.now() - startedAt);
    }
  }

  private async resolveRecipeReferences(reply: ChatAssistantReply) {
    const slugs = Array.from(
      new Set(
        reply.recipeReferences
          .map((reference) => reference.slug.trim())
          .filter((slug) => slug.length > 0),
      ),
    );
    const publicRecipes = await this.repository.findPublicRecipesBySlugs(slugs);
    const bySlug = new Map(
      publicRecipes.map((reference) => [reference.slug, reference]),
    );

    return slugs.flatMap((slug) => {
      const reference = bySlug.get(slug);
      return reference === undefined ? [] : [reference];
    });
  }

  private async getPersonalization(userId: string) {
    if (this.personalizationRepository === undefined) {
      return undefined;
    }

    try {
      return await this.personalizationRepository.getInsight(userId);
    } catch {
      return undefined;
    }
  }
}

function shouldCreateGeneratedRecipeDraft(message: string) {
  const normalized = normalizeIngredientName(message);

  if (
    /\b(khong|dung|chua)\s+(tao|sinh|luu)\b/.test(normalized) ||
    normalized.length === 0
  ) {
    return false;
  }

  const directGenerationPhrases = [
    "tao cong thuc",
    "sinh cong thuc",
    "viet cong thuc",
    "nghi cong thuc",
    "sang tao cong thuc",
    "tao mon",
    "nghi mon",
    "sang tao mon",
    "cong thuc moi",
    "mon moi",
  ];

  if (directGenerationPhrases.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  const hasRecipeSubject = /\b(cong thuc|mon|mon an)\b/.test(normalized);
  const hasCreateVerb = /\b(tao|sinh|viet|nghi|sang tao)\b/.test(normalized);
  const asksForNew = /\b(moi|tu dau|chua co san)\b/.test(normalized);

  return hasRecipeSubject && hasCreateVerb && asksForNew;
}

function buildChatRecipeGenerationRequest(message: string): {
  ingredients: string[];
  filters: RecommendationFilters;
} {
  return {
    ingredients: extractGenerationIngredients(message),
    filters: extractGenerationFilters(message),
  };
}

function extractGenerationIngredients(message: string) {
  const normalized = normalizeTextForIngredientParsing(message);
  const markerPatterns = [
    /\b(?:toi|minh|em|tui)\s+co\s+(.+)$/,
    /\bnguyen lieu(?:\s+(?:la|gom|co))?\s+(.+)$/,
    /\b(?:voi|bang)\s+(?:cac\s+)?(?:nguyen lieu\s+)?(.+)$/,
    /\b(?:cong thuc|mon|mon an)(?:\s+moi)?\s+tu\s+(?:cac\s+)?(?:nguyen lieu\s+)?(.+)$/,
  ];
  const matched = markerPatterns
    .map((pattern) => normalized.match(pattern)?.[1])
    .find((value): value is string => value !== undefined && value.length > 0);

  if (matched === undefined) {
    return [];
  }

  return matched
    .replace(/\b(?:trong|duoi|toi da|khong qua)\s+\d{1,3}\s*(?:phut|p)\b/g, " ")
    .replace(/\b(?:cho\s+)?\d{1,2}\s*(?:nguoi|khau phan|phan)\b/g, " ")
    .replace(
      /\b(?:de lam|don gian|nhanh|nhanh gon|it dau|cong thuc|mon an|mon|moi|nguyen lieu)\b/g,
      " ",
    )
    .split(/,|\+|\/|\bva\b|\bcung\b/)
    .map((ingredient) => ingredient.replace(/\s+/g, " ").trim())
    .filter((ingredient) => ingredient.length >= 2 && ingredient.length <= 80)
    .slice(0, 12);
}

function normalizeTextForIngredientParsing(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9\s,+/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGenerationFilters(message: string): RecommendationFilters {
  const normalized = normalizeIngredientName(message);
  const filters: RecommendationFilters = {};

  if (
    /\b(de lam|don gian|nhanh gon|cho nguoi moi|nguoi moi nau)\b/.test(
      normalized,
    )
  ) {
    filters.difficulties = ["de"];
  }

  const timeMatch = normalized.match(
    /\b(?:trong|duoi|toi da|khong qua)?\s*(\d{1,3})\s*(?:phut|p)\b/,
  );
  if (timeMatch?.[1] !== undefined) {
    filters.maxCookTimeMinutes = Number(timeMatch[1]);
  }

  const servingsMatch = normalized.match(
    /\b(?:cho\s*)?(\d{1,2})\s*(?:nguoi|khau phan|phan)\b/,
  );
  if (servingsMatch?.[1] !== undefined) {
    filters.servings = Number(servingsMatch[1]);
  }

  return filters;
}

function formatGeneratedRecipeDraft(recipe: GeneratedRecipe) {
  const ingredients = recipe.ingredients
    .slice(0, 10)
    .map(
      (ingredient) =>
        `- ${ingredient.name}: ${ingredient.amount} ${ingredient.unit}${
          ingredient.prepNote.length === 0 ? "" : `, ${ingredient.prepNote}`
        }`,
    );
  const steps = recipe.steps
    .slice(0, 8)
    .map((step, index) => `${index + 1}. ${step.content}`);
  const mainIngredients = recipe.ingredients
    .slice(0, 4)
    .map((ingredient) => ingredient.name.toLocaleLowerCase("vi"))
    .join(", ");

  return [
    `Mình tạo mới một công thức với ${mainIngredients}: ${recipe.title}.`,
    "",
    `Tên món: ${recipe.title}`,
    `Thời gian: khoảng ${recipe.cookTimeMinutes} phút | Độ khó: ${recipe.difficulty} | Khẩu phần: ${recipe.baseServings}`,
    "",
    "Nguyên liệu:",
    ...ingredients,
    "",
    "Cách làm:",
    ...steps,
    "",
    "Chúc bạn nấu vui và ngon miệng nhé!",
  ].join("\n");
}

function buildPersonalizationContext(
  personalization: PersonalizationInsightModel | undefined,
) {
  if (
    personalization === undefined ||
    personalization.feedbackCount === 0 ||
    personalization.confidence === 0
  ) {
    return null;
  }

  const lines = [
    `Đã có ${personalization.feedbackCount} feedback nấu ăn trước đây; độ tin cậy ${Math.round(
      personalization.confidence * 100,
    )}%.`,
  ];
  const { issueCounts, signals } = personalization;
  const easyIssueCount = sumPersonalizationIssueCounts(issueCounts, [
    "cutting-meat-hard",
    "hard-to-follow-steps",
    "pan-sticking-or-burning",
    "steamed-unevenly",
    "texture-failed",
    "temperature-control-hard",
  ]);
  const ingredientFitIssueCount = sumPersonalizationIssueCounts(issueCounts, [
    "missing-ingredients",
    "lacks-protein",
  ]);
  const techniqueIssueCount = sumPersonalizationIssueCounts(issueCounts, [
    "oil-splatter",
    "too-oily",
    "not-crispy",
    "vegetables-too-soft",
    "soup-too-bland-or-salty",
    "ingredients-overcooked",
    "fishy-smell",
    "too-dry",
    "too-sweet",
    "taste-not-right",
    "bland-flavor",
  ]);

  if (signals.preferQuickRecipes > 0) {
    lines.push(
      `Người dùng hay thấy món nấu lâu hơn dự kiến (${issueCounts["took-longer-than-expected"]} lần); ưu tiên gợi ý món nhanh và kế hoạch nấu gọn.`,
    );
  }

  if (signals.preferEasyRecipes > 0) {
    lines.push(
      `Người dùng từng gặp khó khi thao tác công thức (${easyIssueCount} lần); ưu tiên món dễ làm và hướng dẫn rõ từng bước.`,
    );
  }

  if (signals.preferIngredientFit > 0) {
    lines.push(
      `Người dùng hay gặp vấn đề về nguyên liệu/độ no (${ingredientFitIssueCount} lần); ưu tiên công thức khớp nguyên liệu và gợi ý cách thay thế.`,
    );
  }

  if (signals.preferTechniqueGuidance > 0) {
    lines.push(
      `Người dùng từng gặp vấn đề về kỹ thuật, độ chín hoặc canh vị (${techniqueIssueCount} lần); khi phù hợp hãy thêm mẹo thao tác và canh vị rõ ràng.`,
    );
  }

  if (personalization.insights.length > 0) {
    lines.push(`Insight hiện có: ${personalization.insights.join(" ")}`);
  }

  return lines.join("\n");
}

function sumPersonalizationIssueCounts(
  issueCounts: PersonalizationInsightModel["issueCounts"],
  issues: readonly FeedbackIssue[],
) {
  return issues.reduce((sum, issue) => sum + issueCounts[issue], 0);
}

function createFallbackDraft(
  candidates: ChatRecipeCandidateModel[],
  latencyMs: number | null = null,
): AssistantDraft {
  const recipeReferences = candidates.slice(0, 2).map(toRecipeReference);
  const content =
    recipeReferences.length === 0
      ? "Phụ Bếp chưa thể trả lời bạn lúc này. Bạn có thể thử tìm trong danh sách công thức có sẵn và quay lại sau."
      : "Phụ Bếp chưa thể trả lời bạn lúc này. Bạn có thể tham khảo vài công thức có sẵn trong hệ thống trước nhé.";

  return {
    content,
    recipeReferences,
    model: fallbackModel,
    latencyMs,
    tokenCount: null,
  };
}

function createRecipeGenerationUnavailableDraft(
  candidates: ChatRecipeCandidateModel[],
  latencyMs: number | null = null,
): AssistantDraft {
  const recipeReferences = candidates.slice(0, 2).map(toRecipeReference);
  const content =
    recipeReferences.length === 0
      ? "Phụ Bếp chưa thể tạo công thức mới lúc này vì dịch vụ phản hồi chậm hoặc không khả dụng. Bạn thử lại sau ít phút, hoặc tìm trong danh sách công thức có sẵn nhé."
      : "Phụ Bếp chưa thể tạo công thức mới lúc này vì dịch vụ phản hồi chậm hoặc không khả dụng. Trong lúc chờ, bạn có thể tham khảo vài công thức gần nhất trong hệ thống.";

  return {
    content,
    recipeReferences,
    model: fallbackModel,
    latencyMs,
    tokenCount: null,
  };
}

function toRecipeReference(
  recipe: ChatRecipeCandidateModel,
): ChatRecipeReferenceModel {
  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
  };
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

function runWithTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new OperationTimeoutError(timeoutMessage, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([task(controller.signal), timeoutPromise]).finally(() => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  });
}

class OperationTimeoutError extends Error {
  constructor(
    message: string,
    readonly timeoutMs: number,
  ) {
    super(message);
    this.name = "OperationTimeoutError";
  }
}
