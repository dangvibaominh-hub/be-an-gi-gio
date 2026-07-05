import type {
  ChatConversationModel,
  ChatMessageModel,
} from "./chat.model.js";

export interface CreateChatConversationInput {
  title?: string;
}

export interface SendChatMessageInput {
  content: string;
}

export interface SendChatMessageResult {
  conversation: ChatConversationModel;
  userMessage: ChatMessageModel;
  assistantMessage: ChatMessageModel;
}
