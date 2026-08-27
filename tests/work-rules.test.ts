import assert from "node:assert/strict";
import test from "node:test";
import { deriveRoadmapDependencies, deriveWorkNudges, deriveWorkload, getPersonalPlannerTasksForDate, getPersonalPlannerTasksForWeek, getTaskEffectiveDate, matchesNaturalTaskSearch, needsAttention, nextOccurrenceDate, parseNaturalTaskSearch, taskTransitionBlockReason } from "../src/lib/work-rules.ts";

test("a completion dependency permits parallel work but not final completion", () => {
  assert.equal(taskTransitionBlockReason({ targetStatus: "in_progress", unresolvedStartBlockers: 0, unresolvedCompletionBlockers: 1 }), undefined);
  assert.match(taskTransitionBlockReason({ targetStatus: "done", unresolvedStartBlockers: 0, unresolvedCompletionBlockers: 1 }) || "", /final completion/i);
});

test("a start dependency prevents beginning", () => {
  assert.match(taskTransitionBlockReason({ targetStatus: "in_progress", unresolvedStartBlockers: 1, unresolvedCompletionBlockers: 0 }) || "", /cannot start/i);
});

test("attention is derived independently from manual priority", () => {
  assert.equal(needsAttention({ isOverdue: false, isFollowUpDue: false, blockedDependents: 0, reviewWaitingHours: 0, daysWithoutUpdate: 4 }), false);
  assert.equal(needsAttention({ isOverdue: false, isFollowUpDue: true, blockedDependents: 0, reviewWaitingHours: 0, daysWithoutUpdate: 0 }), true);
});

test("a weekly recurrence respects the selected weekdays", () => {
  const next = nextOccurrenceDate(new Date("2026-08-14T00:00:00Z"), { frequency: "weekly", interval: 1, weekDays: [1], monthDay: null });
  assert.equal(next.toISOString().slice(0, 10), "2026-08-17");
});

test("monthly recurrence clamps an unavailable day to the end of month", () => {
  const next = nextOccurrenceDate(new Date("2026-01-30T00:00:00Z"), { frequency: "monthly", interval: 1, weekDays: [], monthDay: 30 });
  assert.equal(next.toISOString().slice(0, 10), "2026-02-28");
});

test("Today and week share scheduled, target, then deadline routing", () => {
  const today = new Date("2026-08-19T00:00:00Z");
  assert.equal(getTaskEffectiveDate({ startDate: "2026-08-19", targetDate: "2026-08-20", deadlineDate: "2026-08-21" }, today), "2026-08-19");
  assert.equal(getTaskEffectiveDate({ targetDate: "2026-08-19", deadlineDate: "2026-08-21" }, today), "2026-08-19");
  assert.equal(getTaskEffectiveDate({ deadlineDate: "2026-08-19" }, today), "2026-08-19");
});

test("Today IDs equal this week's selected-day IDs for the same personal work", () => {
  const tasks = [
    { id: "task-a", status: "in_progress" as const, startDate: "2026-08-27", assigneeIds: ["person-charlotte"] },
  ];
  const today = getPersonalPlannerTasksForDate(tasks, "person-charlotte", "2026-08-27");
  const week = getPersonalPlannerTasksForWeek(tasks, "person-charlotte", "2026-08-24", "2026-08-30");
  assert.deepEqual(today.map(task => task.id), ["task-a"]);
  assert.deepEqual(week.filter(task => getTaskEffectiveDate(task) === "2026-08-27").map(task => task.id), today.map(task => task.id));
});

test("personal planners include direct, team, creator, and review work but not another person's task", () => {
  const tasks = [
    { id: "direct", status: "ready" as const, targetDate: "2026-08-27", assigneeIds: ["person-charlotte"] },
    { id: "team", status: "ready" as const, targetDate: "2026-08-27", assigneeIds: ["team-marketing"] },
    { id: "owned", status: "in_progress" as const, targetDate: "2026-08-27", createdByPrincipalId: "person-charlotte" },
    { id: "review", status: "review" as const, targetDate: "2026-08-27", reviewerPrincipalId: "person-charlotte" },
    { id: "other", status: "ready" as const, targetDate: "2026-08-27", assigneeIds: ["person-bu-desti"] },
    { id: "delegated-other", status: "ready" as const, targetDate: "2026-08-27", createdByPrincipalId: "person-charlotte", assigneeIds: ["person-bu-desti"] },
    { id: "tomorrow", status: "ready" as const, targetDate: "2026-08-28", assigneeIds: ["person-charlotte"] },
    { id: "done", status: "done" as const, targetDate: "2026-08-27", assigneeIds: ["person-charlotte"] },
  ];
  const today = getPersonalPlannerTasksForDate(tasks, "person-charlotte", "2026-08-27", ["team-marketing"]);
  const week = getPersonalPlannerTasksForWeek(tasks, "person-charlotte", "2026-08-24", "2026-08-30", ["team-marketing"]);
  assert.deepEqual(today.map(task => task.id), ["direct", "team", "owned", "review"]);
  assert.deepEqual(week.filter(task => getTaskEffectiveDate(task) === "2026-08-27" && task.status !== "done").map(task => task.id), today.map(task => task.id));
  assert.equal(week.some(task => task.id === "done"), true, "This Week keeps completed work as history while Today excludes remaining workload");
  assert.equal(today.some(task => task.id === "other"), false);
  assert.equal(week.some(task => task.id === "other"), false);
  assert.equal(today.some(task => task.id === "delegated-other"), false, "creating someone else's assigned task does not pollute the creator's Today");
  assert.equal(week.some(task => task.id === "delegated-other"), false);
});

test("a canonical date move updates Today and the weekly column without creating another task", () => {
  const original = [{ id: "task-a", status: "ready" as const, startDate: "2026-08-27", assigneeIds: ["person-charlotte"] }];
  const moved = [{ ...original[0], startDate: "2026-08-28" }];
  const idsFor = (tasks: typeof original, date: string) => getPersonalPlannerTasksForWeek(tasks, "person-charlotte", "2026-08-24", "2026-08-30").filter(task => getTaskEffectiveDate(task) === date).map(task => task.id);
  assert.deepEqual(getPersonalPlannerTasksForDate(original, "person-charlotte", "2026-08-27").map(task => task.id), ["task-a"]);
  assert.deepEqual(idsFor(original, "2026-08-27"), ["task-a"]);
  assert.deepEqual(getPersonalPlannerTasksForDate(moved, "person-charlotte", "2026-08-27").map(task => task.id), []);
  assert.deepEqual(idsFor(moved, "2026-08-27"), []);
  assert.deepEqual(idsFor(moved, "2026-08-28"), ["task-a"]);
  assert.deepEqual(idsFor(moved, "2026-08-28"), ["task-a"], "a refresh reads the same one canonical task ID");
});

test("natural search recognizes a department, waiting owner, and month without AI", () => {
  const context = { organizations: ["Villa Khayangan"], departments: ["Marketing", "Purchasing"], assignees: ["Sarah"], projects: ["Website Revamp"] };
  const waitingOnPurchasing = parseNaturalTaskSearch("waiting on purchasing", context, new Date("2026-08-13T00:00:00Z"));
  assert.equal(matchesNaturalTaskSearch({ title: "Compare quotations", status: "waiting", areas: ["Marketing"], nextActionBy: "Purchasing Team" }, waitingOnPurchasing), true);
  assert.equal(matchesNaturalTaskSearch({ title: "Draft campaign", status: "waiting", areas: ["Marketing"], nextActionBy: "Finance Team" }, waitingOnPurchasing), false);
  const marketingThisMonth = parseNaturalTaskSearch("marketing tasks this month", context, new Date("2026-08-13T00:00:00Z"));
  assert.equal(matchesNaturalTaskSearch({ title: "Draft campaign", status: "ready", areas: ["Marketing"], targetDate: "2026-08-20" }, marketingThisMonth), true);
  assert.equal(matchesNaturalTaskSearch({ title: "Draft campaign", status: "ready", areas: ["Marketing"], targetDate: "2026-09-01" }, marketingThisMonth), false);
});

test("workload keeps one shared task visible to every assigned owner", () => {
  const workload = deriveWorkload([
    { id: "shared", status: "in_progress", assigneeIds: ["marketing", "sarah"], primaryOwnerId: "marketing" },
    { id: "review", status: "review", assigneeIds: ["sarah"], primaryOwnerId: "sarah", isOverdue: true },
  ], [
    { id: "marketing", name: "Marketing Team", type: "team", active: true },
    { id: "sarah", name: "Sarah", type: "person", active: true },
  ]);
  assert.equal(workload.find(item => item.principalId === "marketing")?.inProgress, 1);
  assert.equal(workload.find(item => item.principalId === "sarah")?.inProgress, 1);
  assert.equal(workload.find(item => item.principalId === "sarah")?.review, 1);
  assert.equal(workload.find(item => item.principalId === "sarah")?.overdue, 1);
});

test("nudges remain quiet for ordinary waiting work and surface meaningful signals", () => {
  const nudges = deriveWorkNudges([
    { id: "ordinary", title: "Wait for reply", status: "waiting", daysWithoutUpdate: 2 },
    { id: "stale", title: "Supplier quotation", status: "waiting", daysWithoutUpdate: 5, nextActionBy: "Supplier" },
    { id: "blocker", title: "Confirm pricing", status: "in_progress", blockedDependentCount: 2 },
  ], new Date("2026-08-13T00:00:00Z"));
  assert.equal(nudges.some(item => item.taskId === "ordinary"), false);
  assert.equal(nudges.some(item => item.dedupKey === "stale:stale"), true);
  assert.equal(nudges.some(item => item.dedupKey === "blocker:blocker"), true);
});

test("roadmap links distinguish completion dependencies from related work", () => {
  const dependencies = deriveRoadmapDependencies([
    { id: "pricing", title: "Confirm pricing" },
    { id: "publish", title: "Publish prices", dependencies: [
      { prerequisiteTaskId: "pricing", type: "completion_blocker", label: "Final pricing required" },
      { prerequisiteTaskId: "pricing", type: "related", label: "Same launch" },
    ] },
  ]);
  assert.equal(dependencies.length, 2);
  assert.equal(dependencies.find(item => item.type === "completion_blocker")?.fromTaskId, "pricing");
  assert.equal(dependencies.find(item => item.type === "related")?.resolved, false);
});
