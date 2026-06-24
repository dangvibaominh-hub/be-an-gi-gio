import type { RequestHandler } from "express";

import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireAuthenticatedUser } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register: RequestHandler = asyncHandler(async (_request, response) => {
    const body = response.locals.validatedBody as {
      email: string;
      password: string;
      displayName?: string;
    };
    const result = await this.service.register(body);
    response.status(201).json({ success: true, data: result });
  });

  login: RequestHandler = asyncHandler(async (_request, response) => {
    const body = response.locals.validatedBody as {
      email: string;
      password: string;
    };
    const result = await this.service.login(body);
    response.json({ success: true, data: result });
  });

  googleLogin: RequestHandler = asyncHandler(async (_request, response) => {
    const { idToken } = response.locals.validatedBody as { idToken: string };
    const result = await this.service.loginWithGoogle(idToken);
    response.json({ success: true, data: result });
  });

  refresh: RequestHandler = asyncHandler(async (_request, response) => {
    const { refreshToken } = response.locals.validatedBody as {
      refreshToken: string;
    };
    const result = await this.service.refresh(refreshToken);
    response.json({ success: true, data: result });
  });

  logout: RequestHandler = asyncHandler(async (_request, response) => {
    const { refreshToken } = response.locals.validatedBody as {
      refreshToken: string;
    };
    await this.service.logout(refreshToken);
    response.status(204).send();
  });

  me: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const user = await this.service.getProfile(auth.userId);
    response.json({ success: true, data: user });
  });

  updateMe: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const body = response.locals.validatedBody as { displayName: string };
    const user = await this.service.updateProfile(
      auth.userId,
      body,
    );
    response.json({ success: true, data: user });
  });
}
