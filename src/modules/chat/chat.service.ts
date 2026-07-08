import { AppError } from "../../shared/http/app-error.js";
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
    const assistantDraft = await this.createAssistantDraft(
      input.content,
      [...previousMessages, userMessage],
      recipeCandidates,
      personalization,
    );
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

  private async createAssistantDraft(
    message: string,
    history: ChatMessageModel[],
    recipeCandidates: ChatRecipeCandidateModel[],
    personalization: PersonalizationInsightModel | undefined,
  ) {
    if (this.assistantAdapter === undefined) {
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
        return createFallbackDraft(recipeCandidates, Date.now() - startedAt);
      }

      const recipeReferences = await this.resolveRecipeReferences(reply);

      return {
        content: reply.content,
        recipeReferences,
        model: this.assistantAdapter.model,
        latencyMs: Date.now() - startedAt,
        tokenCount: reply.tokenCount ?? null,
      };
    } catch {
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
      ? "Mình chưa thể trả lời bằng Phụ Bếp lúc này. Bạn có thể thử tìm trong danh sách công thức có sẵn và quay lại sau."
      : "Mình chưa thể trả lời bằng Phụ Bếp lúc này. Bạn có thể tham khảo vài công thức có sẵn trong hệ thống trước nhé.";

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
