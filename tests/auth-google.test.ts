import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../src/shared/http/app-error.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.model.js";
import type {
  AuthRepository,
  CreatePasswordUserInput,
  GoogleUserInput,
  RefreshTokenRecord,
  SaveRefreshTokenInput,
} from "../src/modules/auth/auth.repository.js";
import { AuthService } from "../src/modules/auth/auth.service.js";

const accessSecret = "a".repeat(32);
const refreshSecret = "b".repeat(32);
const googleClientId = "google-client-id.apps.googleusercontent.com";

class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  findUserByEmail(normalizedEmail: string) {
    return Promise.resolve(
      Array.from(this.users.values()).find(
        (user) => user.normalizedEmail === normalizedEmail,
      ) ?? null,
    );
  }

  findUserById(userId: string) {
    return Promise.resolve(this.users.get(userId) ?? null);
  }

  createPasswordUser(input: CreatePasswordUserInput) {
    const now = new Date();
    const user: AuthUserRecord = {
      id: `user-${this.users.size + 1}`,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: null,
      role: "USER",
      status: "ACTIVE",
      provider: "PASSWORD",
      googleSubject: null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  upsertGoogleUser(input: GoogleUserInput) {
    const existingByGoogle = Array.from(this.users.values()).find(
      (user) => user.googleSubject === input.googleSubject,
    );

    if (existingByGoogle !== undefined) {
      return Promise.resolve(existingByGoogle);
    }

    const existingByEmail = Array.from(this.users.values()).find(
      (user) => user.normalizedEmail === input.normalizedEmail,
    );

    if (existingByEmail !== undefined) {
      const updatedUser: AuthUserRecord = {
        ...existingByEmail,
        avatarUrl: input.avatarUrl ?? existingByEmail.avatarUrl,
        googleSubject: input.googleSubject,
        updatedAt: new Date(),
      };
      this.users.set(updatedUser.id, updatedUser);

      return Promise.resolve(updatedUser);
    }

    const now = new Date();
    const user: AuthUserRecord = {
      id: `user-${this.users.size + 1}`,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      passwordHash: null,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      role: "USER",
      status: "ACTIVE",
      provider: "GOOGLE",
      googleSubject: input.googleSubject,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  updateProfile(userId: string, input: { displayName: string }) {
    const user = this.users.get(userId);

    if (user === undefined) {
      return Promise.resolve(null);
    }

    const updatedUser = {
      ...user,
      displayName: input.displayName,
      updatedAt: new Date(),
    };
    this.users.set(userId, updatedUser);

    return Promise.resolve(updatedUser);
  }

  saveRefreshToken(input: SaveRefreshTokenInput) {
    this.refreshTokens.set(input.tokenHash, {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });

    return Promise.resolve();
  }

  findRefreshToken(tokenHash: string) {
    return Promise.resolve(this.refreshTokens.get(tokenHash) ?? null);
  }

  revokeRefreshToken(tokenHash: string) {
    const token = this.refreshTokens.get(tokenHash);

    if (token !== undefined) {
      this.refreshTokens.set(tokenHash, {
        ...token,
        revokedAt: token.revokedAt ?? new Date(),
      });
    }

    return Promise.resolve();
  }
}

function createService(repository = new InMemoryAuthRepository()) {
  return new AuthService(repository, {
    accessSecret,
    refreshSecret,
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    googleOAuthClientId: googleClientId,
  });
}

function mockGoogleTokenInfo(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function expectAppError(error: unknown, statusCode: number, code: string) {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ statusCode, code });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google auth", () => {
  it("rejects Google login when OAuth client id is not configured", async () => {
    const service = new AuthService(new InMemoryAuthRepository(), {
      accessSecret,
      refreshSecret,
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2_592_000,
    });

    await expect(service.loginWithGoogle("id-token")).rejects.toMatchObject({
      statusCode: 501,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    });
  });

  it("creates a session for a verified Google ID token", async () => {
    const fetchMock = mockGoogleTokenInfo({
      aud: googleClientId,
      sub: "google-subject-1",
      email: "User@Example.COM",
      email_verified: "true",
      name: "Google User",
      picture: "https://example.com/avatar.png",
    });
    const repository = new InMemoryAuthRepository();
    const service = createService(repository);

    const session = await service.loginWithGoogle("id.token/with space");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/tokeninfo?id_token=id.token%2Fwith%20space",
    );
    expect(session.user).toMatchObject({
      email: "User@Example.COM",
      displayName: "Google User",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(session.tokens).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
    });
    await expect(repository.findUserByEmail("user@example.com")).resolves
      .toMatchObject({
        provider: "GOOGLE",
        googleSubject: "google-subject-1",
      });
  });

  it("rejects Google tokeninfo responses that are invalid or unverified", async () => {
    const invalidTokens = [
      { aud: "another-client", sub: "sub", email: "user@example.com", email_verified: true },
      { aud: googleClientId, email: "user@example.com", email_verified: true },
      { aud: googleClientId, sub: "sub", email_verified: true },
      { aud: googleClientId, sub: "sub", email: "user@example.com", email_verified: false },
      { aud: googleClientId, sub: "sub", email: "user@example.com" },
    ];

    for (const tokenInfo of invalidTokens) {
      mockGoogleTokenInfo(tokenInfo);

      try {
        await createService().loginWithGoogle("id-token");
        throw new Error("Expected Google login to fail.");
      } catch (error) {
        expectAppError(error, 401, "INVALID_GOOGLE_TOKEN");
      } finally {
        vi.unstubAllGlobals();
      }
    }
  });

  it("maps Google tokeninfo HTTP failures to invalid token errors", async () => {
    mockGoogleTokenInfo({ error: "invalid_token" }, 400);

    await expect(createService().loginWithGoogle("bad-token")).rejects
      .toMatchObject({
        statusCode: 401,
        code: "INVALID_GOOGLE_TOKEN",
      });
  });

  it("maps Google tokeninfo network failures to a retryable auth error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(createService().loginWithGoogle("id-token")).rejects
      .toMatchObject({
        statusCode: 503,
        code: "GOOGLE_OAUTH_UNAVAILABLE",
      });
  });

  it("links Google login to an existing email account", async () => {
    mockGoogleTokenInfo({
      aud: googleClientId,
      sub: "google-subject-2",
      email: "user@example.com",
      email_verified: true,
      name: "Google User",
      picture: "https://example.com/google-avatar.png",
    });
    const repository = new InMemoryAuthRepository();
    const passwordUser = await repository.createPasswordUser({
      email: "USER@example.com",
      normalizedEmail: "user@example.com",
      passwordHash: "hashed-password",
      displayName: "Password User",
    });
    const service = createService(repository);

    const session = await service.loginWithGoogle("id-token");

    expect(session.user.id).toBe(passwordUser.id);
    expect(session.user.displayName).toBe("Password User");
    await expect(repository.findUserById(passwordUser.id)).resolves
      .toMatchObject({
        googleSubject: "google-subject-2",
        avatarUrl: "https://example.com/google-avatar.png",
      });
  });
});
