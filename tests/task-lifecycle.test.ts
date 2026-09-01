import assert from "node:assert/strict";
import test from "node:test";
import { canArchiveTask, taskArchiveValidationMessage } from "../src/lib/task-lifecycle.ts";

test("only a completed canonical task can enter Archive", () => {
  for (const status of ["ready", "in_progress", "waiting", "blocked", "review"] as const) {
    assert.equal(canArchiveTask(status), false);
    assert.equal(taskArchiveValidationMessage(status), "Only completed tasks can be archived.");
  }
  assert.equal(canArchiveTask("done"), true);
  assert.equal(taskArchiveValidationMessage("done"), undefined);
  assert.equal(canArchiveTask("done", true), false);
  assert.equal(taskArchiveValidationMessage("done", true), "This task is already archived.");
});
