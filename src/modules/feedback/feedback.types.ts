import type { FeedbackIssue } from "./feedback.model.js";

export interface SubmitFeedbackInput {
  rating: number;
  issues: FeedbackIssue[];
  note?: string;
}
