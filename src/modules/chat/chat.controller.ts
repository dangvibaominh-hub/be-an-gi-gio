import type { RequestHandler } from "express";

import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireAuthenticatedUser } from "../auth/auth.middleware.js";
import type { ChatService } from "./chat.service.js";
import type {
  CreateChatConversationInput,
  SendChatMessageInput,
} from "./chat.types.js";

export class ChatController {
  constructor(private readonly service: ChatService) {}

  createConversation: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const input = response.locals
      .validatedBody as CreateChatConversationInput;
    const conversation = await this.service.createConversation(auth.userId, input);

    response.status(201).json({ success: true, data: conversation });
  });

  listMessages: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const messages = await this.service.listMessages(auth.userId, id);

    response.json({ success: true, data: messages });
  });

  sendMessage: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals.validatedBody as SendChatMessageInput;
    const result = await this.service.sendMessage(auth.userId, id, input);

    response.status(201).json({ success: true, data: result });
  });
}
