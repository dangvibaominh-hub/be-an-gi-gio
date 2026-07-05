import { Router } from "express";

import { validateBody, validateParams } from "../../shared/http/validate.js";
import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { ChatController } from "./chat.controller.js";
import { InMemoryChatRateLimiter } from "./chat.rate-limit.js";
import {
  chatConversationIdParamsSchema,
  createChatConversationSchema,
  sendChatMessageSchema,
} from "./chat.schemas.js";
import type { ChatService } from "./chat.service.js";

export function createChatRouter(
  authService: AuthService,
  service: ChatService,
  rateLimitPerMinute: number,
) {
  const router = Router();
  const controller = new ChatController(service);
  const authGuard = authenticate(authService);
  const rateLimiter = new InMemoryChatRateLimiter(rateLimitPerMinute);

  router.post(
    "/",
    authGuard,
    validateBody(createChatConversationSchema),
    controller.createConversation,
  );
  router.get(
    "/:id/messages",
    authGuard,
    validateParams(chatConversationIdParamsSchema),
    controller.listMessages,
  );
  router.post(
    "/:id/messages",
    authGuard,
    rateLimiter.middleware,
    validateParams(chatConversationIdParamsSchema),
    validateBody(sendChatMessageSchema),
    controller.sendMessage,
  );

  return router;
}
