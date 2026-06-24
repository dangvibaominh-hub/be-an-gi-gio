import type { RequestHandler } from "express";
import type { Request } from "express";

import { AppError } from "../../shared/http/app-error.js";
import type { AuthService } from "./auth.service.js";

export interface AuthenticatedRequestUser {
  userId: string;
  role: string;
}

type RequestWithAuth = Request & { auth?: AuthenticatedRequestUser };

export function authenticate(authService: AuthService): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.header("authorization");

    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
      next(
        new AppError(
          401,
          "AUTH_REQUIRED",
          "Bạn cần đăng nhập để sử dụng chức năng này.",
        ),
      );
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();
    (request as RequestWithAuth).auth = authService.verifyAccessToken(token);
    next();
  };
}

export function optionalAuthenticate(authService: AuthService): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.header("authorization");

    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();
    (request as RequestWithAuth).auth = authService.verifyAccessToken(token);
    next();
  };
}

export function requireRole(...roles: string[]): RequestHandler {
  return (request, _response, next) => {
    const auth = (request as RequestWithAuth).auth;

    if (auth === undefined || !roles.includes(auth.role)) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "Bạn không có quyền thực hiện hành động này.",
        ),
      );
      return;
    }

    next();
  };
}

export function requireAuthenticatedUser(request: Request) {
  const auth = getAuthenticatedUser(request);

  if (auth === undefined) {
    throw new AppError(
      401,
      "AUTH_REQUIRED",
      "Bạn cần đăng nhập để sử dụng chức năng này.",
    );
  }

  return auth;
}

export function getAuthenticatedUser(request: Request) {
  return (request as RequestWithAuth).auth;
}
