import assert from "node:assert/strict";
import test from "node:test";
import { getPrimarySidebarView } from "../src/lib/primary-navigation.ts";

test("each primary Binnie destination resolves to itself and only itself", () => {
  const primary = ["home", "today", "this-week", "all-tasks", "inbox", "attention", "people", "organizations", "projects"];
  assert.deepEqual(primary.map(getPrimarySidebarView), primary);
  assert.equal(new Set(primary.map(getPrimarySidebarView)).size, primary.length);
});

test("consolidated and detail views resolve to one parent sidebar destination", () => {
  assert.equal(getPrimarySidebarView("followup"), "attention");
  assert.equal(getPrimarySidebarView("waiting"), "attention");
  assert.equal(getPrimarySidebarView("delegated"), "attention");
  assert.equal(getPrimarySidebarView("review"), "attention");
  assert.equal(getPrimarySidebarView("overdue"), "attention");
  assert.equal(getPrimarySidebarView("workload"), "people");
  assert.equal(getPrimarySidebarView("templates"), "projects");
  assert.equal(getPrimarySidebarView("search"), undefined);
});
