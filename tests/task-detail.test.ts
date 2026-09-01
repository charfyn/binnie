import assert from "node:assert/strict";
import test from "node:test";
import { getTaskDetailPrimaryAction, getTaskDetailPriorityLabel, hasTaskDetailSecondaryContext } from "../src/lib/task-detail.ts";

const mine = {
  isServerTask: true,
  currentUserIsAssignee: true,
  currentUserHasNextAction: false,
  currentUserIsReviewer: false,
  hasTeamAssignment: false,
  hasPersonalAssignment: true,
  isWaiting: false,
} as const;

test("Task Detail promotes the action that fits the authenticated person's actual task state", () => {
  assert.equal(getTaskDetailPrimaryAction({ ...mine, status: "ready" }), "start");
  assert.equal(getTaskDetailPrimaryAction({ ...mine, status: "in_progress" }), "complete");
  assert.equal(getTaskDetailPrimaryAction({ ...mine, status: "waiting", isWaiting: true }), "update_waiting");
  assert.equal(getTaskDetailPrimaryAction({ ...mine, status: "blocked", isWaiting: true }), "update_waiting");
  assert.equal(getTaskDetailPrimaryAction({ ...mine, status: "done" }), undefined);
});

test("Task Detail never turns a legacy next-action label into personal responsibility", () => {
  assert.equal(getTaskDetailPrimaryAction({
    ...mine,
    status: "waiting",
    isWaiting: true,
    currentUserIsAssignee: false,
    currentUserHasNextAction: true,
  }), undefined);
  assert.equal(getTaskDetailPrimaryAction({
    ...mine,
    status: "waiting",
    isWaiting: true,
    currentUserIsAssignee: false,
    currentUserHasNextAction: false,
  }), undefined);
});

test("Task Detail offers claim only for an unassigned team task, not a task personally actionable by someone else", () => {
  assert.equal(getTaskDetailPrimaryAction({
    ...mine,
    status: "ready",
    currentUserIsAssignee: false,
    hasTeamAssignment: true,
    hasPersonalAssignment: false,
  }), "claim");
  assert.equal(getTaskDetailPrimaryAction({
    ...mine,
    status: "ready",
    currentUserIsAssignee: false,
    currentUserHasNextAction: false,
  }), undefined);
});

test("Task Detail gives the current reviewer an approval action without treating review as owner access", () => {
  assert.equal(getTaskDetailPrimaryAction({
    ...mine,
    status: "review",
    currentUserIsAssignee: false,
    currentUserIsReviewer: true,
  }), "approve");
  assert.equal(getTaskDetailPrimaryAction({
    ...mine,
    status: "review",
    currentUserIsAssignee: false,
    currentUserIsReviewer: false,
  }), undefined);
});

test("Task Detail keeps simple work calm while recurring and complex work can reveal more details", () => {
  assert.equal(hasTaskDetailSecondaryContext({}), false);
  assert.equal(hasTaskDetailSecondaryContext({ recurring: true }), true);
  assert.equal(hasTaskDetailSecondaryContext({ dependencyCount: 1, checklistCount: 2, subtaskCount: 3 }), true);
});

test("Task Detail never presents a planning state as priority", () => {
  assert.equal(getTaskDetailPriorityLabel("low"), "Low");
  assert.equal(getTaskDetailPriorityLabel("medium"), "Normal");
  assert.equal(getTaskDetailPriorityLabel("high"), "High");
  assert.equal(getTaskDetailPriorityLabel("urgent"), "Urgent");
});
