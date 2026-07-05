export type ChatConversationStatus = "ACTIVE" | "ARCHIVED";
export type ChatMessageRole = "user" | "assistant";

export interface ChatRecipeReferenceModel {
  id: string;
  slug: string;
  title: string;
}

export interface ChatConversationModel {
  id: string;
  userId: string;
  title: string;
  status: ChatConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageModel {
  id: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  recipeReferences: ChatRecipeReferenceModel[];
  model: string | null;
  latencyMs: number | null;
  tokenCount: number | null;
  createdAt: string;
}

export interface ChatRecipeCandidateModel extends ChatRecipeReferenceModel {
  description: string;
  category: string;
  difficulty: "de" | "trung-binh" | "kho";
  cookTimeMinutes: number;
}
