import { AppError } from "../../shared/http/app-error.js";
import type {
  CookingFeedbackModel,
  PersonalizationInsightModel,
} from "./feedback.model.js";
import { isFeedbackIssueAllowedForCategory } from "./feedback.model.js";
import type { FeedbackRepository } from "./feedback.repository.js";
import type { SubmitFeedbackInput } from "./feedback.types.js";
import { buildPersonalizationInsight } from "./personalization-rules.js";

export interface SubmitFeedbackResult {
  feedback: CookingFeedbackModel;
  personalization: PersonalizationInsightModel;
}

export class FeedbackService {
  constructor(private readonly repository: FeedbackRepository) {}

  async submit(
    userId: string,
    cookingSessionId: string,
    input: SubmitFeedbackInput,
  ): Promise<SubmitFeedbackResult> {
    const session = await this.repository.findSessionForFeedback(
      userId,
      cookingSessionId,
    );

    if (session === null) {
      throw new AppError(
        404,
        "COOKING_SESSION_NOT_FOUND",
        "Khong tim thay phien nau nay.",
      );
    }

    if (session.status !== "COMPLETED") {
      throw new AppError(
        409,
        "COOKING_SESSION_NOT_COMPLETED",
        "Chi co the gui feedback sau khi hoan thanh phien nau.",
      );
    }

    const invalidIssue = input.issues.find(
      (issue) =>
        !isFeedbackIssueAllowedForCategory(issue, session.recipeCategory),
    );
    if (invalidIssue !== undefined) {
      throw new AppError(
        400,
        "FEEDBACK_ISSUE_NOT_ALLOWED_FOR_RECIPE",
        "Tag feedback nay khong phu hop voi loai mon da nau.",
      );
    }

    const feedback = await this.repository.upsertFeedback(
      userId,
      session,
      input,
    );
    const feedbacks = await this.repository.listFeedbackSignals(userId);
    const insight = buildPersonalizationInsight(
      feedbacks,
      new Date().toISOString(),
    );
    const personalization = await this.repository.saveInsight(userId, insight);

    return { feedback, personalization };
  }

  getPersonalization(userId: string) {
    return this.repository.getInsight(userId);
  }
}
