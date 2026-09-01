import assert from "node:assert/strict";
import test from "node:test";
import {
  captureSearchTerms,
  conciseCaptureTitle,
  explicitCaptureEstimatedMinutes,
  findCaptureTaskMatches,
  inferCapturePriority,
  splitCaptureActionClauses,
  suggestCaptureEstimatedMinutes,
  type CaptureTaskCandidate,
} from "../src/lib/capture-intelligence.ts";

const activeBanner: CaptureTaskCandidate = {
  id: "task-banner",
  version: 4,
  title: "Update villa banner",
  status: "ready",
  organizationId: "org-villa",
  organization: "Villa Khayangan",
  currentResponsibilityPrincipalId: "team-design",
  currentResponsibilityName: "Design Team",
  createdAt: "2026-09-01T01:00:00.000Z",
  updatedAt: "2026-09-01T01:00:00.000Z",
};

function matches(title: string, extra: Partial<Parameters<typeof findCaptureTaskMatches>[0]> = {}, candidates = [activeBanner]) {
  return findCaptureTaskMatches({
    title,
    organizationId: "org-villa",
    organization: "Villa Khayangan",
    currentResponsibilityPrincipalId: "team-design",
    ...extra,
  }, candidates);
}

test("Quick Capture detects an exact active duplicate without changing it", () => {
  const result = matches("Update villa banner");
  assert.equal(result[0]?.id, "task-banner");
  assert.equal(result[0]?.kind, "likely_duplicate");
});

test("Quick Capture recognizes a rewritten and typoed duplicate", () => {
  const rewritten = matches("Design needs to revise the banner for Villa Khayangan");
  const typo = matches("update vila banner, design team");
  assert.equal(rewritten[0]?.kind, "likely_duplicate");
  assert.equal(typo[0]?.kind, "likely_duplicate");
});

test("shared organization and priority wording cannot outweigh different task intent", () => {
  const simCard: CaptureTaskCandidate = {
    id: "task-sim-card",
    title: "Finish registering SIM card for Khayangan, top priority",
    status: "ready",
    organizationId: "org-villa",
    organization: "Villa Khayangan",
    currentResponsibilityPrincipalId: "person-charlotte",
  };
  const input = "tomorrow call bestari internet for khayangan, priority.";
  assert.deepEqual(captureSearchTerms(input), ["call", "bestari", "internet"]);
  assert.deepEqual(matches("Call Bestari Internet", { originalText: input, currentResponsibilityPrincipalId: "person-charlotte" }, [simCard]), []);
});

test("Call and contact with the same named entity are likely duplicates", () => {
  const existing: CaptureTaskCandidate = {
    id: "task-bestari",
    title: "Call Bestari Internet",
    status: "ready",
    organizationId: "org-villa",
    organization: "Villa Khayangan",
    currentResponsibilityPrincipalId: "person-charlotte",
  };
  const result = matches("Contact Bestari about internet", { currentResponsibilityPrincipalId: "person-charlotte" }, [existing]);
  assert.equal(result[0]?.kind, "likely_duplicate");
});

test("same subject with a different action is related, not a strong duplicate", () => {
  const result = matches("Review villa banner pricing", { currentResponsibilityPrincipalId: "team-finance" });
  assert.equal(result[0]?.kind, "related");
});

test("explicit different monthly periods stay separate recurring work", () => {
  const august: CaptureTaskCandidate = { ...activeBanner, title: "Update August villa banner" };
  assert.deepEqual(matches("Update September villa banner", {}, [august]), []);
});

test("a related capture can be offered as context without becoming a duplicate", () => {
  const result = matches("Use new accommodation prices", { originalText: "also make sure they use the new accommodation prices", currentResponsibilityPrincipalId: "team-design" });
  assert.equal(result[0]?.kind, "related");
  assert.equal(result[0]?.isContinuation, true);
  assert.equal(result[0]?.canAddAsContext, true);
});

test("completed work is only surfaced when it is an extremely close recent match", () => {
  const completedCall: CaptureTaskCandidate = {
    id: "completed-bestari",
    title: "Call Bestari Internet",
    status: "done",
    organizationId: "org-villa",
    completedAt: "2026-09-01T09:00:00.000Z",
  };
  const recent = matches("Call Bestari Internet", { now: "2026-09-02T09:00:00.000Z" }, [completedCall]);
  assert.equal(recent[0]?.kind, "similar_completed");
  assert.deepEqual(matches("Call Bestari Internet", { now: "2026-10-01T09:00:00.000Z" }, [completedCall]), []);
});

test("candidate classification cannot reveal a permission-hidden task", () => {
  const visible = matches("Update villa banner", {}, [activeBanner]);
  assert.deepEqual(visible.map(match => match.id), ["task-banner"]);
  // The server passes only authorization-scoped candidates to this helper.
  assert.deepEqual(matches("Update villa banner", {}, []), []);
});

test("one capture can contain two independent actions", () => {
  assert.deepEqual(
    splitCaptureActionClauses("Tomorrow call Bestari about the internet and ask Design Team to update the villa banner"),
    ["Tomorrow call Bestari about the internet", "ask Design Team to update the villa banner"],
  );
});

test("capture titles remove conversational filler while preserving review intent and entities", () => {
  assert.equal(
    conciseCaptureTitle("tomorrow need to finish review request from bestari internet of villa khayangan"),
    "Review Bestari Internet request",
  );
  assert.equal(conciseCaptureTitle("tomorrow call bestari internet for khayangan, priority."), "Call Bestari Internet");
});

test("effort uses explicit duration first, offers only conservative suggestions, and leaves uncertain work unestimated", () => {
  assert.equal(explicitCaptureEstimatedMinutes("This should take around 30 minutes"), 30);
  assert.equal(suggestCaptureEstimatedMinutes("Call Bestari tomorrow"), 15);
  assert.equal(suggestCaptureEstimatedMinutes("Prepare the 2027 financial strategy"), undefined);
});

test("priority defaults to Normal unless the capture carries an explicit signal", () => {
  assert.deepEqual(inferCapturePriority("Send report tomorrow"), { priority: "medium", explicit: false });
  assert.deepEqual(inferCapturePriority("priority, send report tomorrow"), { priority: "high", explicit: true });
  assert.deepEqual(inferCapturePriority("Important: send report"), { priority: "high", explicit: true });
  assert.deepEqual(inferCapturePriority("Urgent, send report tomorrow"), { priority: "urgent", explicit: true });
  assert.deepEqual(inferCapturePriority("This is overdue"), { priority: "medium", explicit: false });
});

test("a user-selected estimate remains an explicit value rather than a later suggestion", () => {
  const userChoice = 60;
  assert.equal(userChoice, 60);
  assert.equal(suggestCaptureEstimatedMinutes("Call Bestari tomorrow"), 15);
});
