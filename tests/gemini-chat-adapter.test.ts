import { describe, expect, it } from "vitest";

import { GeminiChatAssistantAdapter } from "../src/modules/chat/gemini-chat.adapter.js";

describe("GeminiChatAssistantAdapter", () => {
  it("requests JSON output and validates a structured assistant reply", async () => {
    let requestBody: unknown;
    const fetchFn: typeof fetch = (_input, init) => {
      requestBody =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : undefined;

      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        content: "Phu Bep goi y nau mi trung nhanh.",
                        recipeReferences: [{ slug: "mi-trung" }],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 42 },
          }),
          { status: 200 },
        ),
      );
    };
    const adapter = new GeminiChatAssistantAdapter({
      apiKey: "test-key",
      model: "gemini-test",
      timeoutMs: 10_000,
      fetchFn,
    });

    const reply = await adapter.generateReply({
      message: "Toi co mi va trung",
      history: [],
      recipeCandidates: [],
      userContext: null,
    });

    expect(reply).toMatchObject({
      content: "Phu Bep goi y nau mi trung nhanh.",
      recipeReferences: [{ slug: "mi-trung" }],
      tokenCount: 42,
    });
    expect(requestBody).toMatchObject({
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    expect(JSON.stringify(requestBody)).not.toContain("responseSchema");
  });

  it("uses plain generated text when Gemini does not return structured JSON", async () => {
    const fetchFn: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "Bạn có thể nấu mì trứng trong khoảng 10 phút.",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const adapter = new GeminiChatAssistantAdapter({
      apiKey: "test-key",
      model: "gemini-test",
      timeoutMs: 10_000,
      fetchFn,
    });

    const reply = await adapter.generateReply({
      message: "Toi co mi va trung",
      history: [],
      recipeCandidates: [],
      userContext: null,
    });

    expect(reply).toMatchObject({
      content: "Bạn có thể nấu mì trứng trong khoảng 10 phút.",
      recipeReferences: [],
    });
  });

  it("accepts structured replies with extra generated fields", async () => {
    const fetchFn: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        content: "Bạn có thể nấu mì trứng nhanh.",
                        recipeReferences: [
                          { slug: "mi-trung", title: "Mì trứng" },
                        ],
                        confidence: "high",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const adapter = new GeminiChatAssistantAdapter({
      apiKey: "test-key",
      model: "gemini-test",
      timeoutMs: 10_000,
      fetchFn,
    });

    const reply = await adapter.generateReply({
      message: "Toi co mi va trung",
      history: [],
      recipeCandidates: [],
      userContext: null,
    });

    expect(reply).toMatchObject({
      content: "Bạn có thể nấu mì trứng nhanh.",
      recipeReferences: [{ slug: "mi-trung" }],
    });
  });

  it("throws when Gemini returns no generated text", async () => {
    const fetchFn: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
      );
    const adapter = new GeminiChatAssistantAdapter({
      apiKey: "test-key",
      model: "gemini-test",
      timeoutMs: 10_000,
      fetchFn,
    });

    await expect(
      adapter.generateReply({
        message: "Xin chao",
        history: [],
        recipeCandidates: [],
        userContext: null,
      }),
    ).rejects.toThrow("did not include generated text");
  });
});
