import assert from "node:assert/strict";
import test from "node:test";
import { getTasksFilterControls } from "../src/lib/tasks-filter-controls.ts";

test("My Work and People scopes do not expose redundant Person or Team filters", () => {
  for (const scope of ["my", "people"] as const) {
    const controls = getTasksFilterControls(scope, "list");
    assert.equal(controls.includes("person"), false);
    assert.equal(controls.includes("team"), false);
  }
});

test("My Work never retains an Assigned by monitoring filter", () => {
  assert.equal(getTasksFilterControls("my", "list").includes("assigned_by"), false);
  assert.equal(getTasksFilterControls("assigned_by_me", "list").includes("assigned_by"), false);
  assert.equal(getTasksFilterControls("people", "list").includes("assigned_by"), true);
});

test("Team scope provides canonical Team and Person narrowing", () => {
  assert.deepEqual(getTasksFilterControls("team", "list"), ["team", "area", "project", "person", "assigned_by", "priority", "status", "date", "files"]);
});

test("Assigned by me monitors the current person or team without becoming My Work", () => {
  assert.deepEqual(getTasksFilterControls("assigned_by_me", "list"), ["team", "area", "project", "person", "priority", "status", "date", "files"]);
});

test("Status is an advanced List filter and never a Board filter", () => {
  assert.equal(getTasksFilterControls("my", "list").includes("status"), true);
  assert.equal(getTasksFilterControls("my", "board").includes("status"), false);
  assert.equal(getTasksFilterControls("team", "board").includes("status"), false);
});
