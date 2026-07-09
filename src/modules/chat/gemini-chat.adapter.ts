import { z } from "zod";

import type {
  ChatMessageModel,
  ChatRecipeCandidateModel,
} from "./chat.model.js";

export interface ChatAssistantInput {
  message: string;
  history: Pick<ChatMessageModel, "role" | "content">[];
  recipeCandidates: ChatRecipeCandidateModel[];
  userContext: string | null;
}

export interface ChatAssistantReply {
  content: string;
  recipeReferences: { slug: string }[];
  tokenCount?: number;
}

export interface ChatAssistantAdapter {
  readonly model: string;
  generateReply(input: ChatAssistantInput): Promise<ChatAssistantReply | null>;
}

interface GeminiChatAssistantAdapterOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

const chatAssistantReplySchema = z
  .object({
    content: z.string().trim().min(1).max(2_000),
    recipeReferences: z
      .array(
        z
          .object({
            slug: z.string().trim().min(1).max(180),
          })
          .strict(),
      )
      .max(5)
      .default([]),
  })
  .strict();

const geminiChatResponseSchema = {
  type: "OBJECT",
  properties: {
    content: {
      type: "STRING",
      description: "Vietnamese assistant answer for the cooking question.",
    },
    recipeReferences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          slug: {
            type: "STRING",
            description: "Recipe slug selected only from the provided recipe context.",
          },
        },
        required: ["slug"],
      },
    },
  },
  required: ["content", "recipeReferences"],
} as const;

const geminiGenerateContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(
            z
              .object({
                text: z.string().optional(),
              })
              .passthrough(),
          ),
        }),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      totalTokenCount: z.number().int().nonnegative().optional(),
    })
    .passthrough()
    .optional(),
});

export class GeminiChatAssistantAdapter implements ChatAssistantAdapter {
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GeminiChatAssistantAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs;
  }

  async generateReply(
    input: ChatAssistantInput,
  ): Promise<ChatAssistantReply | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.model,
        )}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: buildGeminiContents(input),
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
              responseSchema: geminiChatResponseSchema,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini chat request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as unknown;
      const directReply = chatAssistantReplySchema.safeParse(payload);

      if (directReply.success) {
        return withTokenCount(directReply.data, payload);
      }

      const text = extractGeneratedText(payload);

      if (text === null) {
        return null;
      }

      const reply = chatAssistantReplySchema.parse(JSON.parse(stripJsonFence(text)));
      return withTokenCount(reply, payload);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildGeminiContents(input: ChatAssistantInput) {
  const recipeContext =
    input.recipeCandidates.length === 0
      ? "Khong co cong thuc phu hop trong context hien tai."
      : input.recipeCandidates
          .map(
            (recipe) =>
              `- ${recipe.title} | slug=${recipe.slug} | ${recipe.category} | ${recipe.difficulty} | ${recipe.cookTimeMinutes} phut | ${recipe.description}`,
          )
          .join("\n");

  const historyContext =
    input.history.length === 0
      ? "Chua co lich su hoi dap trong conversation nay."
      : input.history
          .map((message) => `${message.role}: ${message.content}`)
          .join("\n");
  const userContext =
    input.userContext ?? "Chua co tin hieu ca nhan hoa dai han cho nguoi dung nay.";

  return [
    {
      role: "user",
      parts: [
        {
          text: [
            "Bạn là Phụ Bếp, trợ lý nấu ăn của website Ăn Gì Giờ?.",
            "Tên trợ lý phải luôn viết đúng là Phụ Bếp, không viết thành Phú Bếp hoặc biến thể khác.",
            "Người dùng có thể hỏi bằng tiếng Việt có dấu, không dấu, viết tắt hoặc tên nguyên liệu quen thuộc ở Việt Nam.",
            "Hãy hiểu ý định theo ngữ cảnh nấu ăn Việt Nam và luôn trả lời bằng tiếng Việt tự nhiên, ngắn gọn, thân thiện.",
            "Ưu tiên an toàn bếp núc. Không đưa lời khuyên y tế, không khẳng định an toàn tuyệt đối về dị ứng hoặc thực phẩm sống.",
            "Nếu có tín hiệu cá nhân hóa, dùng như gợi ý mềm; câu hỏi hiện tại của người dùng vẫn là ưu tiên cao nhất.",
            "Nếu cần gợi ý công thức, chỉ reference slug nằm trong Recipe context.",
            "Trả về duy nhất JSON object theo schema: content và recipeReferences.",
            "",
            "User personalization context:",
            userContext,
            "",
            "Recipe context:",
            recipeContext,
            "",
            "Conversation context:",
            historyContext,
            "",
            `User message: ${input.message}`,
          ].join("\n"),
        },
      ],
    },
  ];
}

function extractGeneratedText(payload: unknown) {
  const parsed = geminiGenerateContentResponseSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  const text = parsed.data.candidates?.[0]?.content.parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text === undefined || text.length === 0 ? null : text;
}

function withTokenCount(
  reply: z.infer<typeof chatAssistantReplySchema>,
  payload: unknown,
): ChatAssistantReply {
  const parsed = geminiGenerateContentResponseSchema.safeParse(payload);
  const tokenCount = parsed.success
    ? parsed.data.usageMetadata?.totalTokenCount
    : undefined;

  return tokenCount === undefined ? reply : { ...reply, tokenCount };
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
