import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TASK_LIST_COLUMNS, getRecommendedTaskListColumns, getTaskListColumnOptions, TASK_LIST_COLUMNS } from "../src/lib/task-list.ts";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_WORKSPACE_SCOPES } from "../src/lib/work-types.ts";

test("Tasks keeps its first-glance List to the six essential columns", () => {
  assert.deepEqual(DEFAULT_TASK_LIST_COLUMNS, [
    "task",
    "priority",
    "assignedTo",
    "organization",
    "status",
    "deadline",
  ]);
  assert.equal(new Set(DEFAULT_TASK_LIST_COLUMNS).size, DEFAULT_TASK_LIST_COLUMNS.length);
  assert.ok(DEFAULT_TASK_LIST_COLUMNS.every((id) => TASK_LIST_COLUMNS.some((column) => column.id === id)));
  assert.equal(TASK_LIST_COLUMNS.find((column) => column.id === "assignedTo")?.label, "Currently With");
});

test("Tasks recommends scope-appropriate columns without promoting Target Date", () => {
  assert.deepEqual(getRecommendedTaskListColumns("my"), ["task", "priority", "assignedTo", "organization", "area", "project", "status", "planFor", "deadline", "files"]);
  assert.deepEqual(getRecommendedTaskListColumns("assigned_by_me"), ["task", "assignedTo", "assignedBy", "currentStep", "organization", "project", "status", "deadline"]);
  assert.deepEqual(getRecommendedTaskListColumns("completed"), ["task", "owner", "completedBy", "completedDate", "organization", "project"]);
  assert.deepEqual(getRecommendedTaskListColumns("archive"), ["task", "owner", "completedDate", "archivedDate", "organization", "project"]);
  assert.equal(getRecommendedTaskListColumns("my").includes("targetDate"), false);
  assert.equal(getTaskListColumnOptions("my").some((column) => column.id === "targetDate"), true, "Target Date remains an advanced fallback column");
});

test("Tasks keeps active work, delegated monitoring, and historical scopes distinct", () => {
  assert.deepEqual(TASK_WORKSPACE_SCOPES, ["my", "team", "people", "assigned_by_me", "completed", "archive"]);
});

test("List and Board share Binnie's canonical workflow vocabulary", () => {
  assert.deepEqual(TASK_STATUSES, ["ready", "in_progress", "waiting", "blocked", "review", "done"]);
  assert.deepEqual(TASK_PRIORITIES, ["low", "medium", "high", "urgent"]);
});
