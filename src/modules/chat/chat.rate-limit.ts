import type { RequestHandler } from "express";

import { AppError } from "../../shared/http/app-error.js";
import { requireAuthenticatedUser } from "../auth/auth.middleware.js";

interface RateLimitBucket {
  windowStartedAt: number;
  count: number;
}

export class InMemoryChatRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  middleware: RequestHandler = (request, _response, next) => {
    if (this.limit <= 0) {
      next();
      return;
    }

    const auth = requireAuthenticatedUser(request);
    const now = Date.now();
    const bucket = this.buckets.get(auth.userId);

    if (bucket === undefined || now - bucket.windowStartedAt >= this.windowMs) {
      this.buckets.set(auth.userId, { windowStartedAt: now, count: 1 });
      next();
      return;
    }

    if (bucket.count >= this.limit) {
      next(
        new AppError(
          429,
          "CHAT_RATE_LIMITED",
          "Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau.",
        ),
      );
      return;
    }

    bucket.count += 1;
    next();
  };
}
