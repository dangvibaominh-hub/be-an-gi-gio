import { describe, expect, it } from "vitest";

import { normalizeFeedbackIssues } from "../src/modules/feedback/feedback.model.js";

describe("feedback model", () => {
  it("normalizes Postgres enum array literals into feedback issues", () => {
    expect(
      normalizeFeedbackIssues(
        '{"pan-sticking-or-burning","too-oily","pan-sticking-or-burning"}',
      ),
    ).toEqual(["pan-sticking-or-burning", "too-oily"]);
  });

  it("keeps valid issue arrays and ignores unknown values", () => {
    expect(
      normalizeFeedbackIssues([
        "missing-ingredients",
        "unknown-issue",
        "took-longer-than-expected",
      ]),
    ).toEqual(["missing-ingredients", "took-longer-than-expected"]);
  });
});
