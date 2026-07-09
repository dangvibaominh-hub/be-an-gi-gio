import { describe, expect, it } from "vitest";

import { GeminiChatAssistantAdapter } from "../src/modules/chat/gemini-chat.adapter.js";

describe("GeminiChatAssistantAdapter", () => {
  it("tries a fallback model when the primary model is temporarily unavailable", async () => {
    const requestedUrls: string[] = [];
    const fetchFn: typeof fetch = (input) => {
      const url = getRequestUrl(input);
      requestedUrls.push(url);

      if (url.includes("gemini-primary")) {
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
                        content: "Phu Bep goi y nau mi trung don gian.",
                        recipeReferences: [],
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
    };
    const adapter = new GeminiChatAssistantAdapter({
      apiKey: "test-key",
      model: "gemini-primary",
      fallbackModels: ["gemini-fallback"],
      timeoutMs: 10_000,
      fetchFn,
    });

    const reply = await adapter.generateReply({
      message: "Toi co mi va trung, nen nau gi?",
      history: [],
      recipeCandidates: [],
      userContext: null,
    });

    expect(reply?.content).toContain("Phu Bep");
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("gemini-primary");
    expect(requestedUrls[1]).toContain("gemini-fallback");
  });

  it("does not retry a fallback model when the Gemini API key is unauthorized", async () => {
    const requestedUrls: string[] = [];
    const fetchFn: typeof fetch = (input) => {
      requestedUrls.push(getRequestUrl(input));

      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 401,
              message: "API key not valid.",
              status: "UNAUTHENTICATED",
            },
          }),
          { status: 401, statusText: "Unauthorized" },
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

    await expect(
      adapter.generateReply({
        message: "Xin chao",
        history: [],
        recipeCandidates: [],
        userContext: null,
      }),
    ).rejects.toThrow("status 401");
    expect(requestedUrls).toHaveLength(1);
  });
});

function getRequestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
