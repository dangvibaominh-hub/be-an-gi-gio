import { z } from "zod";

export const chatConversationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createChatConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const sendChatMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(2_000),
  })
  .strict();
