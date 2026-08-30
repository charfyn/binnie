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

test("Team scope provides canonical Team and Person narrowing", () => {
  assert.deepEqual(getTasksFilterControls("team", "list"), ["team", "area", "project", "person", "assigned_by", "priority", "status", "date", "files"]);
});

test("Status is an advanced List filter and never a Board filter", () => {
  assert.equal(getTasksFilterControls("my", "list").includes("status"), true);
  assert.equal(getTasksFilterControls("my", "board").includes("status"), false);
  assert.equal(getTasksFilterControls("team", "board").includes("status"), false);
});
