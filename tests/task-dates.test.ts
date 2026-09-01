import assert from "node:assert/strict";
import test from "node:test";
import { isValidTaskIsoDate, taskDateInputError, taskDateInputFromIso, taskDateInputToIso, taskPlanningDatesError } from "../src/lib/task-dates.ts";

test("Task Detail dates require a real YYYY/MM/DD date with a four digit year", () => {
  assert.equal(taskDateInputToIso("2026/09/01"), "2026-09-01");
  assert.equal(taskDateInputToIso("222222/09/01"), undefined);
  assert.equal(taskDateInputToIso("2026/02/30"), undefined);
  assert.equal(taskDateInputToIso("2026/13/01"), undefined);
  assert.equal(taskDateInputError("222222/09/01"), "Please enter a valid date in YYYY/MM/DD format.");
  assert.equal(taskDateInputFromIso("2026-09-01"), "2026/09/01");
});

test("canonical task date storage rejects incomplete and impossible ISO dates", () => {
  assert.equal(isValidTaskIsoDate("2026-02-28"), true);
  assert.equal(isValidTaskIsoDate("2026-02-29"), false);
  assert.equal(isValidTaskIsoDate("2024-02-29"), true);
  assert.equal(isValidTaskIsoDate("2026-9-01"), false);
  assert.equal(isValidTaskIsoDate("20260-09-01"), false);
});

test("Plan For cannot be saved after Deadline", () => {
  assert.equal(taskPlanningDatesError("2026-09-01", "2026-08-31"), "Plan date cannot be after the deadline.");
  assert.equal(taskPlanningDatesError("2026-08-31", "2026-09-01"), undefined);
});
