export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";
export type AuthProvider = "PASSWORD" | "GOOGLE";

export interface AuthUserRecord {
  id: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  provider: AuthProvider;
  googleSubject: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUserModel {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface AuthSessionModel {
  user: PublicUserModel;
  tokens: AuthTokenPair;
}
