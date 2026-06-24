import { AppError } from "../../shared/http/app-error.js";
import type {
  CookingSessionModel,
  PaginatedCookingSessions,
} from "./cooking-session.model.js";
import type { CookingSessionRepository } from "./cooking-session.repository.js";
import type {
  CookingHistoryQuery,
  StartCookingSessionInput,
  UpdateCookingSessionInput,
} from "./cooking-session.types.js";

export class CookingSessionService {
  constructor(private readonly repository: CookingSessionRepository) {}

  async start(userId: string, input: StartCookingSessionInput) {
    const session = await this.repository.start(userId, input);

    if (session === null) {
      throw new AppError(
        404,
        "RECIPE_NOT_FOUND",
        "Khong tim thay cong thuc nay.",
      );
    }

    return session;
  }

  async update(
    userId: string,
    sessionId: string,
    input: UpdateCookingSessionInput,
  ) {
    const session = await this.requireSession(userId, sessionId);
    ensureInProgress(session);
    const nextInput = {
      currentStep: input.currentStep ?? session.currentStep,
      servings: input.servings ?? session.servings,
    };
    ensureStepInRange(nextInput.currentStep, session.totalSteps);

    const updatedSession = await this.repository.update(
      userId,
      sessionId,
      nextInput,
    );

    if (updatedSession === null) {
      throw new AppError(
        404,
        "COOKING_SESSION_NOT_FOUND",
        "Khong tim thay phien nau nay.",
      );
    }

    return updatedSession;
  }

  async complete(userId: string, sessionId: string) {
    const session = await this.requireSession(userId, sessionId);

    if (session.status === "COMPLETED") {
      return session;
    }

    const completedSession = await this.repository.complete(
      userId,
      sessionId,
      session.totalSteps,
    );

    if (completedSession === null) {
      throw new AppError(
        404,
        "COOKING_SESSION_NOT_FOUND",
        "Khong tim thay phien nau nay.",
      );
    }

    return completedSession;
  }

  listHistory(
    userId: string,
    query: CookingHistoryQuery,
  ): Promise<PaginatedCookingSessions> {
    return this.repository.listHistory(userId, query);
  }

  private async requireSession(userId: string, sessionId: string) {
    const session = await this.repository.findById(userId, sessionId);

    if (session === null) {
      throw new AppError(
        404,
        "COOKING_SESSION_NOT_FOUND",
        "Khong tim thay phien nau nay.",
      );
    }

    return session;
  }
}

function ensureInProgress(session: CookingSessionModel) {
  if (session.status === "COMPLETED") {
    throw new AppError(
      409,
      "COOKING_SESSION_COMPLETED",
      "Phien nau nay da hoan thanh.",
    );
  }
}

function ensureStepInRange(currentStep: number, totalSteps: number) {
  if (currentStep > totalSteps) {
    throw new AppError(
      400,
      "INVALID_CURRENT_STEP",
      "Buoc hien tai vuot qua so buoc cua cong thuc.",
    );
  }
}
