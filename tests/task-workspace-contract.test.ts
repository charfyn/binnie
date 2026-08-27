import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TASK_LIST_COLUMNS, TASK_LIST_COLUMNS } from "../src/lib/task-list.ts";
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
});

test("Tasks exposes only progressive My Work, Team, and People scopes", () => {
  assert.deepEqual(TASK_WORKSPACE_SCOPES, ["my", "team", "people"]);
});

test("List and Board share Binnie's canonical workflow vocabulary", () => {
  assert.deepEqual(TASK_STATUSES, ["ready", "in_progress", "waiting", "blocked", "review", "done"]);
  assert.deepEqual(TASK_PRIORITIES, ["low", "medium", "high", "urgent"]);
});
