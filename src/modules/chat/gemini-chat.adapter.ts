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
  model?: string;
  tokenCount?: number;
}

export interface ChatAssistantAdapter {
  readonly model: string;
  generateReply(input: ChatAssistantInput): Promise<ChatAssistantReply | null>;
}

interface GeminiChatAssistantAdapterOptions {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

const chatAssistantReplySchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.slice(0, 2_000)),
    recipeReferences: z
      .array(
        z.union([
          z.string().trim().min(1).max(180).transform((slug) => ({ slug })),
          z
            .object({
              slug: z.string().trim().min(1).max(180),
            })
            .passthrough()
            .transform(({ slug }) => ({ slug })),
        ]),
      )
      .default([])
      .transform((value) => value.slice(0, 5)),
  });

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
  private readonly models: string[];
  private readonly timeoutMs: number;

  constructor(options: GeminiChatAssistantAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.models = uniqueModels([
      options.model,
      ...(options.fallbackModels ?? []),
    ]);
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs;
  }

  async generateReply(
    input: ChatAssistantInput,
  ): Promise<ChatAssistantReply | null> {
    let lastError: unknown;

    for (const model of this.models) {
      try {
        return await this.generateReplyWithModel(input, model);
      } catch (error) {
        lastError = error;

        if (!isRetryableGeminiError(error) || model === this.models.at(-1)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini chat request failed for all configured models.");
  }

  private async generateReplyWithModel(
    input: ChatAssistantInput,
    model: string,
  ): Promise<ChatAssistantReply | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model,
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
            },
          }),
        },
      );

      if (!response.ok) {
        const preview = await readGeminiErrorPreview(response);
        const message = [
          `Gemini chat request failed for model ${model} with status ${response.status}`,
          response.statusText.trim().length === 0 ? "" : ` ${response.statusText}`,
          preview === null ? "" : `: ${preview}`,
          ".",
        ].join("");

        throw new GeminiRequestError(response.status, model, message);
      }

      const payload = (await response.json()) as unknown;
      const directReply = chatAssistantReplySchema.safeParse(payload);

      if (directReply.success) {
        return withTokenCount(directReply.data, payload, model);
      }

      const text = extractGeneratedText(payload);

      if (text === null) {
        throw new Error(
          `Gemini chat response for model ${model} did not include generated text: ${previewPayload(
            payload,
          )}`,
        );
      }

      const reply = parseAssistantReplyText(text);
      return withTokenCount(reply, payload, model);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class GeminiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly model: string,
    message: string,
  ) {
    super(message);
    this.name = "GeminiRequestError";
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
            "recipeReferences phải là mảng object dạng [{\"slug\":\"slug-cong-thuc\"}], không trả mảng string.",
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
  model: string,
): ChatAssistantReply {
  const parsed = geminiGenerateContentResponseSchema.safeParse(payload);
  const tokenCount = parsed.success
    ? parsed.data.usageMetadata?.totalTokenCount
    : undefined;

  return tokenCount === undefined
    ? { ...reply, model }
    : { ...reply, model, tokenCount };
}

function uniqueModels(models: string[]) {
  const seen = new Set<string>();

  return models.flatMap((model) => {
    const normalized = model.trim();

    if (normalized.length === 0 || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function isRetryableGeminiError(error: unknown) {
  if (error instanceof GeminiRequestError) {
    return [404, 408, 409, 429, 500, 502, 503, 504].includes(error.status);
  }

  return error instanceof Error && error.name === "AbortError";
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

function parseAssistantReplyText(text: string): ChatAssistantReply {
  const strippedText = stripJsonFence(text);

  if (strippedText.length === 0) {
    throw new Error("Gemini chat response did not include usable assistant text.");
  }

  const structuredReply = parseStructuredReply(strippedText);

  if (structuredReply !== null) {
    return structuredReply;
  }

  const jsonObjectText = extractJsonObjectText(strippedText);
  if (jsonObjectText !== null) {
    const extractedReply = parseStructuredReply(jsonObjectText);

    if (extractedReply !== null) {
      return extractedReply;
    }
  }

  return {
    content: strippedText.slice(0, 2_000),
    recipeReferences: [],
  };
}

function parseStructuredReply(text: string) {
  try {
    const parsed = chatAssistantReplySchema.safeParse(JSON.parse(text));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function extractJsonObjectText(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function previewPayload(payload: unknown) {
  try {
    return JSON.stringify(payload).replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "[unserializable payload]";
  }
}

async function readGeminiErrorPreview(response: Response) {
  try {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, " ").trim();

    return normalized.length === 0 ? null : normalized.slice(0, 500);
  } catch {
    return null;
  }
}
