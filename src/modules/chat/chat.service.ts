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
import type { PersonalizationInsightModel } from "../feedback/feedback.model.js";
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
}

const fallbackModel = null;

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
    const assistantDraft =
      (await this.createGeneratedRecipeDraft(
        input.content,
        personalization,
        userId,
      )) ??
      (await this.createAssistantDraft(
        input.content,
        [...previousMessages, userMessage],
        recipeCandidates,
        personalization,
      ));
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
    if (
      !shouldCreateGeneratedRecipeDraft(message) ||
      this.recipeGenerationAdapter === undefined ||
      this.generatedRecipeRepository === undefined
    ) {
      return null;
    }

    const startedAt = Date.now();
    const request = buildChatRecipeGenerationRequest(message);

    try {
      const recipe = await this.recipeGenerationAdapter.generateRecipe({
        ingredients: request.ingredients,
        filters: request.filters,
        request: message,
        userContext: buildPersonalizationContext(personalization),
      });

      if (recipe === null) {
        return null;
      }

      const savedRecipe = await this.generatedRecipeRepository.save({
        recipe,
        slug: createGeneratedRecipeSlug(recipe.title),
        aiModel: this.recipeGenerationAdapter.model,
        createdBy: userId,
      });

      return {
        content: formatGeneratedRecipeDraft(recipe, savedRecipe.slug),
        recipeReferences: [],
        model: this.recipeGenerationAdapter.model,
        latencyMs: Date.now() - startedAt,
        tokenCount: null,
      };
    } catch (error) {
      logger.warn(
        {
          error: serializeGeminiError(error),
          feature: "chat.recipe_generation",
          userId,
        },
        "Gemini recipe draft generation failed; falling back to chat assistant.",
      );
      return null;
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

function formatGeneratedRecipeDraft(recipe: GeneratedRecipe, slug: string) {
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

  return [
    "Mình đã tạo một bản nháp công thức mới bằng Gemini. Bản nháp này đang chờ admin kiểm tra và chưa xuất hiện trong catalog chính thức.",
    "",
    `Tên món: ${recipe.title}`,
    `Thời gian: khoảng ${recipe.cookTimeMinutes} phút | Độ khó: ${recipe.difficulty} | Khẩu phần: ${recipe.baseServings}`,
    `Mã bản nháp cho admin kiểm tra: ${slug}`,
    "",
    "Nguyên liệu:",
    ...ingredients,
    "",
    "Cách làm:",
    ...steps,
    "",
    "Ảnh món ăn hiện dùng placeholder. Khi duyệt, admin nên kiểm tra nội dung và upload ảnh thật hoặc ảnh có quyền sử dụng.",
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
    `Da co ${personalization.feedbackCount} feedback nau an truoc day; do tin cay ${Math.round(
      personalization.confidence * 100,
    )}%.`,
  ];
  const { issueCounts, signals } = personalization;

  if (signals.preferQuickRecipes > 0) {
    lines.push(
      `Nguoi dung hay thay mon nau lau hon du kien (${issueCounts["took-longer-than-expected"]} lan); uu tien goi y mon nhanh va ke hoach nau gon.`,
    );
  }

  if (signals.preferEasyRecipes > 0) {
    lines.push(
      `Nguoi dung tung gap kho khi so che/thao tac (${issueCounts["cutting-meat-hard"]} lan); uu tien mon de lam va huong dan ro tung buoc.`,
    );
  }

  if (signals.preferIngredientFit > 0) {
    lines.push(
      `Nguoi dung hay bi thieu nguyen lieu (${issueCounts["missing-ingredients"]} lan); uu tien cong thuc khop nguyen lieu va goi y cach thay the.`,
    );
  }

  if (signals.preferTechniqueGuidance > 0) {
    lines.push(
      `Nguoi dung tung gap van de ban dau (${issueCounts["oil-splatter"]} lan); khi phu hop hay nhac meo giam ban dau va thao tac an toan.`,
    );
  }

  if (personalization.insights.length > 0) {
    lines.push(`Insight hien co: ${personalization.insights.join(" ")}`);
  }

  return lines.join("\n");
}

function createFallbackDraft(
  candidates: ChatRecipeCandidateModel[],
  latencyMs: number | null = null,
) {
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
