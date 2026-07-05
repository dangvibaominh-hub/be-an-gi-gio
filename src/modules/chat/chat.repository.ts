import type { Pool } from "pg";

import { normalizeIngredientName, tokenizeIngredientName } from "../recommendations/ingredient-normalizer.js";
import type {
  ChatConversationModel,
  ChatMessageModel,
  ChatMessageRole,
  ChatRecipeCandidateModel,
  ChatRecipeReferenceModel,
} from "./chat.model.js";

interface ChatConversationRow {
  id: string;
  user_id: string;
  title: string;
  status: ChatConversationModel["status"];
  created_at: Date;
  updated_at: Date;
}

interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: ChatMessageRole;
  content: string;
  recipe_references: unknown;
  model: string | null;
  latency_ms: number | null;
  token_count: number | null;
  created_at: Date;
}

interface RecipeCandidateRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: ChatRecipeCandidateModel["difficulty"];
  cook_time_minutes: number;
}

export interface AddChatMessageInput {
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  recipeReferences?: ChatRecipeReferenceModel[];
  model?: string | null;
  latencyMs?: number | null;
  tokenCount?: number | null;
}

export interface ChatRepository {
  createConversation(
    userId: string,
    title: string,
  ): Promise<ChatConversationModel>;
  findConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<ChatConversationModel | null>;
  listMessagesForUser(
    conversationId: string,
    userId: string,
  ): Promise<ChatMessageModel[]>;
  addMessage(input: AddChatMessageInput): Promise<ChatMessageModel>;
  listRecipeCandidates(
    query: string,
    limit: number,
  ): Promise<ChatRecipeCandidateModel[]>;
  findPublicRecipesBySlugs(
    slugs: string[],
  ): Promise<ChatRecipeReferenceModel[]>;
}

export class PostgresChatRepository implements ChatRepository {
  constructor(private readonly database: Pool) {}

  async createConversation(userId: string, title: string) {
    const result = await this.database.query<ChatConversationRow>(
      `INSERT INTO chat_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, status, created_at, updated_at`,
      [userId, title],
    );
    const conversation = result.rows[0];

    if (conversation === undefined) {
      throw new Error("Failed to create chat conversation.");
    }

    return mapConversationRow(conversation);
  }

  async findConversationForUser(conversationId: string, userId: string) {
    const result = await this.database.query<ChatConversationRow>(
      `SELECT id, user_id, title, status, created_at, updated_at
       FROM chat_conversations
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [conversationId, userId],
    );
    const conversation = result.rows[0];

    return conversation === undefined ? null : mapConversationRow(conversation);
  }

  async listMessagesForUser(conversationId: string, userId: string) {
    const result = await this.database.query<ChatMessageRow>(
      `SELECT
         cm.id,
         cm.conversation_id,
         cm.role,
         cm.content,
         cm.recipe_references,
         cm.model,
         cm.latency_ms,
         cm.token_count,
         cm.created_at
       FROM chat_messages cm
       INNER JOIN chat_conversations cc ON cc.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cc.user_id = $2
       ORDER BY cm.created_at ASC`,
      [conversationId, userId],
    );

    return result.rows.map(mapMessageRow);
  }

  async addMessage(input: AddChatMessageInput) {
    const result = await this.database.query<ChatMessageRow>(
      `INSERT INTO chat_messages (
         conversation_id,
         role,
         content,
         recipe_references,
         model,
         latency_ms,
         token_count
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING
         id,
         conversation_id,
         role,
         content,
         recipe_references,
         model,
         latency_ms,
         token_count,
         created_at`,
      [
        input.conversationId,
        input.role,
        input.content,
        JSON.stringify(input.recipeReferences ?? []),
        input.model ?? null,
        input.latencyMs ?? null,
        input.tokenCount ?? null,
      ],
    );
    await this.database.query(
      `UPDATE chat_conversations
       SET updated_at = NOW()
       WHERE id = $1`,
      [input.conversationId],
    );
    const message = result.rows[0];

    if (message === undefined) {
      throw new Error("Failed to create chat message.");
    }

    return mapMessageRow(message);
  }

  async listRecipeCandidates(query: string, limit: number) {
    const tokens = Array.from(
      new Set(
        tokenizeIngredientName(query).filter((token) => token.length >= 2),
      ),
    );

    if (tokens.length === 0) {
      return this.listRecentPublicRecipes(limit);
    }

    const patterns = tokens.map((token) => `%${token}%`);
    const normalizedQuery = normalizeIngredientName(query);
    const slugPattern = `%${normalizedQuery.replace(/\s+/g, "-")}%`;
    const result = await this.database.query<RecipeCandidateRow>(
      `${recipeCandidateSelectSql()}
       WHERE r.status = 'PUBLISHED'
         AND r.moderation_status = 'APPROVED'
         AND (
           r.slug ILIKE $1
           OR r.slug ILIKE ANY($2::text[])
           OR EXISTS (
             SELECT 1
             FROM recipe_ingredients ri
             INNER JOIN ingredients i ON i.id = ri.ingredient_id
             WHERE ri.recipe_id = r.id
               AND (
                 i.normalized_name = ANY($3::text[])
                 OR i.normalized_name ILIKE ANY($2::text[])
                 OR EXISTS (
                   SELECT 1
                   FROM unnest(i.aliases) AS ingredient_alias(value)
                   WHERE ingredient_alias.value = ANY($3::text[])
                      OR ingredient_alias.value ILIKE ANY($2::text[])
                 )
               )
           )
         )
       ORDER BY r.updated_at DESC, r.title
       LIMIT $4`,
      [slugPattern, patterns, tokens, limit],
    );

    return result.rows.length === 0
      ? this.listRecentPublicRecipes(limit)
      : result.rows.map(mapRecipeCandidateRow);
  }

  async findPublicRecipesBySlugs(slugs: string[]) {
    if (slugs.length === 0) {
      return [];
    }

    const result = await this.database.query<RecipeCandidateRow>(
      `${recipeCandidateSelectSql()}
       WHERE r.status = 'PUBLISHED'
         AND r.moderation_status = 'APPROVED'
         AND r.slug = ANY($1::text[])
       ORDER BY r.title`,
      [slugs],
    );

    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
    }));
  }

  private async listRecentPublicRecipes(limit: number) {
    const result = await this.database.query<RecipeCandidateRow>(
      `${recipeCandidateSelectSql()}
       WHERE r.status = 'PUBLISHED'
         AND r.moderation_status = 'APPROVED'
       ORDER BY r.updated_at DESC, r.title
       LIMIT $1`,
      [limit],
    );

    return result.rows.map(mapRecipeCandidateRow);
  }
}

function recipeCandidateSelectSql() {
  return `SELECT
            r.id,
            r.slug,
            r.title,
            r.description,
            c.name AS category,
            r.difficulty,
            r.cook_time_minutes
          FROM recipes r
          INNER JOIN categories c ON c.id = r.category_id`;
}

function mapConversationRow(row: ChatConversationRow): ChatConversationModel {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMessageRow(row: ChatMessageRow): ChatMessageModel {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    recipeReferences: mapRecipeReferences(row.recipe_references),
    model: row.model,
    latencyMs: row.latency_ms,
    tokenCount: row.token_count,
    createdAt: row.created_at.toISOString(),
  };
}

function mapRecipeCandidateRow(row: RecipeCandidateRow): ChatRecipeCandidateModel {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    cookTimeMinutes: row.cook_time_minutes,
  };
}

function mapRecipeReferences(value: unknown): ChatRecipeReferenceModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const id = readStringProperty(item, "id");
    const slug = readStringProperty(item, "slug");
    const title = readStringProperty(item, "title");

    if (id !== undefined && slug !== undefined && title !== undefined) {
      return [{ id, slug, title }];
    }

    return [];
  });
}

function readStringProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : undefined;
}
