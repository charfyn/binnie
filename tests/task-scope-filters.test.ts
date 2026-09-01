import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_TASK_SCOPE_FILTERS, normalizeTaskScopeFilters } from "../src/lib/task-scope-filters.ts";

test("returning from monitoring and historical task tabs restores the complete My Work base", () => {
  const monitored = {
    ...EMPTY_TASK_SCOPE_FILTERS,
    search: "pricing",
    organization: "org-apotik",
    team: "team-design",
    assignedBy: "person-charlotte",
    priority: "high",
    status: "done",
    hasFiles: true,
  };
  assert.deepEqual(normalizeTaskScopeFilters("assigned_by_me", monitored).assignedBy, "");
  assert.deepEqual(normalizeTaskScopeFilters("completed", monitored).status, "done");
  assert.deepEqual(normalizeTaskScopeFilters("archive", monitored).status, "done");
  assert.deepEqual(normalizeTaskScopeFilters("my", monitored), EMPTY_TASK_SCOPE_FILTERS);
});

test("scope-only filters cannot remain hidden in People or historical task scopes", () => {
  const filters = { ...EMPTY_TASK_SCOPE_FILTERS, assignee: "person-charlotte", team: "team-finance", assignedBy: "person-bu-desti", status: "ready" };
  const people = normalizeTaskScopeFilters("people", filters);
  assert.equal(people.assignee, "");
  assert.equal(people.team, "");
  assert.equal(people.assignedBy, "person-bu-desti");
  const archive = normalizeTaskScopeFilters("archive", filters);
  assert.equal(archive.status, "");
  assert.equal(archive.assignedBy, "");
});
