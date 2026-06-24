import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/http/app-error.js";
import { signJwt, verifyJwt } from "../../shared/security/jwt.js";
import { hashPassword, verifyPassword } from "../../shared/security/password.js";
import { hashToken } from "../../shared/security/token-hash.js";
import type {
  AuthSessionModel,
  AuthTokenPair,
  AuthUserRecord,
  PublicUserModel,
} from "./auth.model.js";
import type { AuthRepository } from "./auth.repository.js";

interface AuthServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  googleOAuthClientId?: string;
}

interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly options: AuthServiceOptions,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthSessionModel> {
    const normalizedEmail = normalizeEmail(input.email);
    const existingUser = await this.repository.findUserByEmail(normalizedEmail);

    if (existingUser !== null) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "Email này đã được đăng ký.",
      );
    }

    const user = await this.repository.createPasswordUser({
      email: input.email.trim(),
      normalizedEmail,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName ?? normalizedEmail.split("@")[0] ?? "User",
    });

    return {
      user: toPublicUser(user),
      tokens: await this.issueTokens(user),
    };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<AuthSessionModel> {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );

    if (
      user === null ||
      user.passwordHash === null ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email hoặc mật khẩu không đúng.",
      );
    }

    ensureActiveUser(user);

    return {
      user: toPublicUser(user),
      tokens: await this.issueTokens(user),
    };
  }

  async loginWithGoogle(idToken: string): Promise<AuthSessionModel> {
    if (this.options.googleOAuthClientId === undefined) {
      throw new AppError(
        501,
        "GOOGLE_OAUTH_NOT_CONFIGURED",
        "Google OAuth chưa được cấu hình cho backend.",
      );
    }

    const tokenInfo = await this.verifyGoogleToken(idToken);
    const user = await this.repository.upsertGoogleUser({
      email: tokenInfo.email,
      normalizedEmail: normalizeEmail(tokenInfo.email),
      displayName: tokenInfo.name ?? tokenInfo.email.split("@")[0] ?? "User",
      avatarUrl: tokenInfo.picture ?? null,
      googleSubject: tokenInfo.sub,
    });

    ensureActiveUser(user);

    return {
      user: toPublicUser(user),
      tokens: await this.issueTokens(user),
    };
  }

  async refresh(refreshToken: string): Promise<AuthSessionModel> {
    const payload = verifyJwt(refreshToken, this.options.refreshSecret);

    if (payload.type !== "refresh") {
      throw new AppError(401, "INVALID_TOKEN", "Refresh token không hợp lệ.");
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await this.repository.findRefreshToken(tokenHash);

    if (
      storedToken === null ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt.getTime() <= Date.now() ||
      storedToken.id !== payload.jti
    ) {
      throw new AppError(
        401,
        "REFRESH_TOKEN_REVOKED",
        "Refresh token không còn hiệu lực.",
      );
    }

    const user = await this.repository.findUserById(payload.sub);
    if (user === null) {
      throw new AppError(401, "USER_NOT_FOUND", "Tài khoản không tồn tại.");
    }

    ensureActiveUser(user);
    await this.repository.revokeRefreshToken(tokenHash);

    return {
      user: toPublicUser(user),
      tokens: await this.issueTokens(user),
    };
  }

  async logout(refreshToken: string) {
    await this.repository.revokeRefreshToken(hashToken(refreshToken));
  }

  async getProfile(userId: string) {
    const user = await this.repository.findUserById(userId);

    if (user === null) {
      throw new AppError(404, "USER_NOT_FOUND", "Tài khoản không tồn tại.");
    }

    ensureActiveUser(user);

    return toPublicUser(user);
  }

  async updateProfile(userId: string, input: { displayName: string }) {
    const user = await this.repository.updateProfile(userId, input);

    if (user === null) {
      throw new AppError(404, "USER_NOT_FOUND", "Tài khoản không tồn tại.");
    }

    ensureActiveUser(user);

    return toPublicUser(user);
  }

  verifyAccessToken(accessToken: string) {
    const payload = verifyJwt(accessToken, this.options.accessSecret);

    if (payload.type !== "access") {
      throw new AppError(401, "INVALID_TOKEN", "Access token không hợp lệ.");
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  }

  private async issueTokens(user: AuthUserRecord): Promise<AuthTokenPair> {
    const accessToken = signJwt({
      subject: user.id,
      role: user.role,
      type: "access",
      ttlSeconds: this.options.accessTokenTtlSeconds,
      secret: this.options.accessSecret,
    });
    const refreshTokenId = randomUUID();
    const refreshToken = signJwt({
      subject: user.id,
      role: user.role,
      type: "refresh",
      ttlSeconds: this.options.refreshTokenTtlSeconds,
      secret: this.options.refreshSecret,
      jwtId: refreshTokenId,
    });

    await this.repository.saveRefreshToken({
      id: refreshTokenId,
      userId: user.id,
      tokenHash: hashToken(refreshToken.token),
      expiresAt: new Date(
        Date.now() + this.options.refreshTokenTtlSeconds * 1000,
      ),
    });

    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      tokenType: "Bearer",
      expiresIn: this.options.accessTokenTtlSeconds,
    };
  }

  private async verifyGoogleToken(idToken: string) {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        idToken,
      )}`,
    );

    if (!response.ok) {
      throw new AppError(
        401,
        "INVALID_GOOGLE_TOKEN",
        "Google token không hợp lệ.",
      );
    }

    const tokenInfo = (await response.json()) as GoogleTokenInfo;

    if (
      tokenInfo.aud !== this.options.googleOAuthClientId ||
      tokenInfo.sub === undefined ||
      tokenInfo.email === undefined ||
      tokenInfo.email_verified === false ||
      tokenInfo.email_verified === "false"
    ) {
      throw new AppError(
        401,
        "INVALID_GOOGLE_TOKEN",
        "Google token không hợp lệ.",
      );
    }

    return {
      sub: tokenInfo.sub,
      email: tokenInfo.email,
      name: tokenInfo.name,
      picture: tokenInfo.picture,
    };
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("vi");
}

export function toPublicUser(user: AuthUserRecord): PublicUserModel {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
  };
}

function ensureActiveUser(user: AuthUserRecord) {
  if (user.status !== "ACTIVE") {
    throw new AppError(
      403,
      "ACCOUNT_SUSPENDED",
      "Tài khoản này đang bị tạm khóa.",
    );
  }
}
