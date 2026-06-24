import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { AppError } from "../http/app-error.js";

export interface JwtPayload {
  sub: string;
  role: string;
  type: "access" | "refresh";
  jti: string;
  iat: number;
  exp: number;
}

export interface SignJwtOptions {
  subject: string;
  role: string;
  type: JwtPayload["type"];
  ttlSeconds: number;
  secret: string;
  jwtId?: string;
}

export function signJwt({
  subject,
  role,
  type,
  ttlSeconds,
  secret,
  jwtId,
}: SignJwtOptions) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: JwtPayload = {
    sub: subject,
    role,
    type,
    jti: jwtId ?? randomUUID(),
    iat: now,
    exp: now + ttlSeconds,
  };

  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSignature(signingInput, secret);

  return {
    token: `${signingInput}.${signature}`,
    payload,
  };
}

export function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw invalidTokenError();
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  if (
    encodedHeader === undefined ||
    encodedPayload === undefined ||
    signature === undefined
  ) {
    throw invalidTokenError();
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createSignature(signingInput, secret);

  if (!safeEqual(signature, expectedSignature)) {
    throw invalidTokenError();
  }

  const payload = parsePayload(encodedPayload);
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError(401, "TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn.");
  }

  return payload;
}

function createSignature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parsePayload(encodedPayload: string): JwtPayload {
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Partial<JwtPayload>;

  if (
    typeof payload.sub !== "string" ||
    typeof payload.role !== "string" ||
    (payload.type !== "access" && payload.type !== "refresh") ||
    typeof payload.jti !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw invalidTokenError();
  }

  return payload as JwtPayload;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function invalidTokenError() {
  return new AppError(
    401,
    "INVALID_TOKEN",
    "Token không hợp lệ hoặc đã bị thay đổi.",
  );
}
