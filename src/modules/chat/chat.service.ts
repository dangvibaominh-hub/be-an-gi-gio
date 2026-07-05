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
    const assistantDraft = await this.createAssistantDraft(
      input.content,
      [...previousMessages, userMessage],
      recipeCandidates,
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
