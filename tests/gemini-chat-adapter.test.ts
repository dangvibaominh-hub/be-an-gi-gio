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

  it("accepts recipe references returned as slug strings", async () => {
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
                        content:
                          "Chao ban, Phu Bep goi y bo xao hanh tay va ca hap gung.",
                        recipeReferences: [
                          "bo-xao-hanh-tay",
                          "ca-hap-gung",
                        ],
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
      message: "Duoi 30 phut",
      history: [],
      recipeCandidates: [],
      userContext: null,
    });

    expect(reply).toMatchObject({
      content: "Chao ban, Phu Bep goi y bo xao hanh tay va ca hap gung.",
      recipeReferences: [
        { slug: "bo-xao-hanh-tay" },
        { slug: "ca-hap-gung" },
      ],
    });
  });

  it("falls back to the next configured model on transient Gemini errors", async () => {
    const requestedUrls: string[] = [];
    let callCount = 0;
    const fetchFn: typeof fetch = (input) => {
      callCount += 1;
      requestedUrls.push(readFetchUrl(input));

      if (callCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 503,
                message: "This model is currently experiencing high demand.",
                status: "UNAVAILABLE",
              },
            }),
            { status: 503, statusText: "Service Unavailable" },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        content: "Phu Bep goi y nau trung ca chua.",
                        recipeReferences: [{ slug: "trung-ca-chua" }],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 64 },
          }),
          { status: 200 },
        ),
      );
    };
    const adapter = new GeminiChatAssistantAdapter({
      apiKey: "test-key",
      model: "gemini-primary",
      fallbackModels: ["gemini-fallback"],
      timeoutMs: 10_000,
      fetchFn,
    });

    const reply = await adapter.generateReply({
      message: "Toi co trung va ca chua",
      history: [],
      recipeCandidates: [],
      userContext: null,
    });

    expect(requestedUrls[0]).toContain("/gemini-primary:generateContent");
    expect(requestedUrls[1]).toContain("/gemini-fallback:generateContent");
    expect(reply).toMatchObject({
      content: "Phu Bep goi y nau trung ca chua.",
      model: "gemini-fallback",
      recipeReferences: [{ slug: "trung-ca-chua" }],
      tokenCount: 64,
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

function readFetchUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
