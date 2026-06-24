import type { Pool } from "pg";

import type {
  AuthProvider,
  AuthUserRecord,
  UserRole,
  UserStatus,
} from "./auth.model.js";

interface UserRow {
  id: string;
  email: string;
  normalized_email: string;
  password_hash: string | null;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  provider: AuthProvider;
  google_subject: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePasswordUserInput {
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  displayName: string;
}

export interface GoogleUserInput {
  email: string;
  normalizedEmail: string;
  displayName: string;
  avatarUrl: string | null;
  googleSubject: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SaveRefreshTokenInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(normalizedEmail: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  createPasswordUser(input: CreatePasswordUserInput): Promise<AuthUserRecord>;
  upsertGoogleUser(input: GoogleUserInput): Promise<AuthUserRecord>;
  updateProfile(
    userId: string,
    input: { displayName: string },
  ): Promise<AuthUserRecord | null>;
  saveRefreshToken(input: SaveRefreshTokenInput): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: Pool) {}

  async findUserByEmail(normalizedEmail: string) {
    const result = await this.database.query<UserRow>(
      `SELECT *
       FROM app_users
       WHERE normalized_email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    return result.rows[0] === undefined ? null : mapUserRow(result.rows[0]);
  }

  async findUserById(userId: string) {
    const result = await this.database.query<UserRow>(
      `SELECT *
       FROM app_users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    return result.rows[0] === undefined ? null : mapUserRow(result.rows[0]);
  }

  async createPasswordUser(input: CreatePasswordUserInput) {
    const result = await this.database.query<UserRow>(
      `INSERT INTO app_users (
         email, normalized_email, password_hash, display_name, provider
       )
       VALUES ($1, $2, $3, $4, 'PASSWORD')
       RETURNING *`,
      [
        input.email,
        input.normalizedEmail,
        input.passwordHash,
        input.displayName,
      ],
    );
    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Could not create user.");
    }

    return mapUserRow(row);
  }

  async upsertGoogleUser(input: GoogleUserInput) {
    const existingByGoogle = await this.database.query<UserRow>(
      `SELECT *
       FROM app_users
       WHERE google_subject = $1
       LIMIT 1`,
      [input.googleSubject],
    );
    const googleRow = existingByGoogle.rows[0];

    if (googleRow !== undefined) {
      return mapUserRow(googleRow);
    }

    const result = await this.database.query<UserRow>(
      `INSERT INTO app_users (
         email, normalized_email, display_name, avatar_url, provider,
         google_subject
       )
       VALUES ($1, $2, $3, $4, 'GOOGLE', $5)
       ON CONFLICT (normalized_email) DO UPDATE SET
         display_name = COALESCE(app_users.display_name, EXCLUDED.display_name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
         google_subject = EXCLUDED.google_subject,
         updated_at = NOW()
       RETURNING *`,
      [
        input.email,
        input.normalizedEmail,
        input.displayName,
        input.avatarUrl,
        input.googleSubject,
      ],
    );
    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Could not upsert Google user.");
    }

    return mapUserRow(row);
  }

  async updateProfile(userId: string, input: { displayName: string }) {
    const result = await this.database.query<UserRow>(
      `UPDATE app_users
       SET display_name = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId, input.displayName],
    );

    return result.rows[0] === undefined ? null : mapUserRow(result.rows[0]);
  }

  async saveRefreshToken(input: SaveRefreshTokenInput) {
    await this.database.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [input.id, input.userId, input.tokenHash, input.expiresAt],
    );
  }

  async findRefreshToken(tokenHash: string) {
    const result = await this.database.query<{
      id: string;
      user_id: string;
      token_hash: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async revokeRefreshToken(tokenHash: string) {
    await this.database.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }
}

function mapUserRow(row: UserRow): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    provider: row.provider,
    googleSubject: row.google_subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
