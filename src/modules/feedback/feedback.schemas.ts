import { z } from "zod";

import { FEEDBACK_ISSUES } from "./feedback.model.js";

export const feedbackSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

export const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  issues: z
    .array(z.enum(FEEDBACK_ISSUES))
    .max(FEEDBACK_ISSUES.length)
    .default([])
    .transform((issues) => Array.from(new Set(issues))),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((note) => (note === "" ? undefined : note)),
});
