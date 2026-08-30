import assert from "node:assert/strict";
import test from "node:test";
import { calendarDateKey, deriveRoadmapDependencies, deriveWorkNudges, deriveWorkload, filterAttentionTasks, getAttentionWork, getDelegatedTasks, getOrganizationActiveTasks, getOrganizationAreaTasks, getOrganizationCurrentFocus, getOrganizationRevisitTasks, getOrganizationTasks, getOrganizationTodayTasks, getOrganizationWaitingTasks, getOrganizationWeekTasks, getOverdueTasks, getProjectMovableTasks, getProjectNextTask, getProjectProgress, getProjectTasks, getReviewTasks, getTaskAttentionPrincipalIds, getTaskPlannerDate, getTodayTasks, getWaitingWork, getWeekTasks, isTaskPersonallyActionableForPerson, isTaskTrackedByPerson, matchesNaturalTaskSearch, needsAttention, nextOccurrenceDate, parseNaturalTaskSearch, taskTransitionBlockReason } from "../src/lib/work-rules.ts";

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

test("getTaskPlannerDate uses Plan for, then target, then deadline", () => {
  const today = new Date("2026-08-19T00:00:00Z");
  assert.equal(getTaskPlannerDate({ startDate: "2026-08-19", targetDate: "2026-08-20", deadlineDate: "2026-08-21" }, today), "2026-08-19");
  assert.equal(getTaskPlannerDate({ targetDate: "2026-08-19", deadlineDate: "2026-08-21" }, today), "2026-08-19");
  assert.equal(getTaskPlannerDate({ deadlineDate: "2026-08-19" }, today), "2026-08-19");
  assert.equal(getTaskPlannerDate({}, today), undefined);
});

test("Today IDs equal this week's selected-day IDs for the same personal work", () => {
  const tasks = [
    { id: "task-a", status: "in_progress" as const, startDate: "2026-08-27", assigneeIds: ["person-charlotte"] },
  ];
  const today = getTodayTasks(tasks, "person-charlotte", "2026-08-27");
  const week = getWeekTasks(tasks, "person-charlotte", "2026-08-24", "2026-08-30");
  assert.deepEqual(today.map(task => task.id), ["task-a"]);
  assert.deepEqual(week.filter(task => getTaskPlannerDate(task) === "2026-08-27").map(task => task.id), today.map(task => task.id));
});

test("personal planners include only explicit personal action, never team membership or delegation", () => {
  const tasks = [
    { id: "direct", status: "ready" as const, targetDate: "2026-08-27", assigneeIds: ["person-charlotte"] },
    { id: "team", status: "ready" as const, targetDate: "2026-08-27", assigneeIds: ["team-marketing"] },
    { id: "owned", status: "in_progress" as const, targetDate: "2026-08-27", createdByPrincipalId: "person-charlotte" },
    { id: "review", status: "review" as const, targetDate: "2026-08-27", reviewerPrincipalId: "person-charlotte" },
    { id: "dependency", status: "waiting" as const, targetDate: "2026-08-27", assigneeIds: ["team-finance"], dependencyActionOwnerIds: ["person-charlotte"] },
    { id: "other", status: "ready" as const, targetDate: "2026-08-27", assigneeIds: ["person-bu-desti"] },
    { id: "delegated-other", status: "ready" as const, targetDate: "2026-08-27", createdByPrincipalId: "person-charlotte", assigneeIds: ["person-bu-desti"] },
    { id: "reviewed-by-other", status: "review" as const, targetDate: "2026-08-27", createdByPrincipalId: "person-charlotte", reviewerPrincipalId: "person-bu-desti" },
    { id: "tomorrow", status: "ready" as const, targetDate: "2026-08-28", assigneeIds: ["person-charlotte"] },
    { id: "done", status: "done" as const, targetDate: "2026-08-27", assigneeIds: ["person-charlotte"] },
  ];
  const today = getTodayTasks(tasks, "person-charlotte", "2026-08-27");
  const week = getWeekTasks(tasks, "person-charlotte", "2026-08-24", "2026-08-30");
  assert.deepEqual(today.map(task => task.id), ["direct", "owned", "review", "dependency"]);
  assert.deepEqual(week.filter(task => getTaskPlannerDate(task) === "2026-08-27" && task.status !== "done").map(task => task.id), today.map(task => task.id));
  assert.equal(week.some(task => task.id === "done"), true, "This Week keeps completed work as history while Today excludes remaining workload");
  assert.equal(today.some(task => task.id === "team"), false, "a Team queue does not become every member's personal planner work");
  assert.equal(today.some(task => task.id === "other"), false);
  assert.equal(week.some(task => task.id === "other"), false);
  assert.equal(today.some(task => task.id === "delegated-other"), false, "creating someone else's assigned task does not pollute the creator's Today");
  assert.equal(week.some(task => task.id === "delegated-other"), false);
  assert.equal(today.some(task => task.id === "reviewed-by-other"), false, "review work belongs only to the active reviewer");
});

test("the personal-action helper gives People the exact same definition as My Work", () => {
  const teamOnly = { id: "team-only", status: "ready" as const, assigneeIds: ["team-marketing"] };
  const personAndTeam = { id: "person-and-team", status: "ready" as const, assigneeIds: ["team-marketing", "person-bu-desti"] };
  const nextActionForCharlotte = { id: "next-action", status: "ready" as const, assigneeIds: ["team-finance"], nextActionPrincipalId: "person-charlotte" };
  const movedNextAction = { ...nextActionForCharlotte, nextActionPrincipalId: "person-bu-desti" };
  assert.equal(isTaskPersonallyActionableForPerson(teamOnly, "person-charlotte"), false);
  assert.equal(isTaskPersonallyActionableForPerson(personAndTeam, "person-bu-desti"), true);
  assert.equal(isTaskPersonallyActionableForPerson(personAndTeam, "person-charlotte"), false);
  assert.equal(isTaskPersonallyActionableForPerson(nextActionForCharlotte, "person-charlotte"), true);
  assert.equal(isTaskPersonallyActionableForPerson(movedNextAction, "person-charlotte"), false);
  assert.equal(isTaskPersonallyActionableForPerson(movedNextAction, "person-bu-desti"), true);
});

test("a canonical date move updates Today and the weekly column without creating another task", () => {
  const original = [{ id: "task-a", status: "ready" as const, startDate: "2026-08-27", assigneeIds: ["person-charlotte"] }];
  const moved = [{ ...original[0], startDate: "2026-08-28" }];
  const idsFor = (tasks: typeof original, date: string) => getWeekTasks(tasks, "person-charlotte", "2026-08-24", "2026-08-30").filter(task => getTaskPlannerDate(task) === date).map(task => task.id);
  assert.deepEqual(getTodayTasks(original, "person-charlotte", "2026-08-27").map(task => task.id), ["task-a"]);
  assert.deepEqual(idsFor(original, "2026-08-27"), ["task-a"]);
  assert.deepEqual(getTodayTasks(moved, "person-charlotte", "2026-08-27").map(task => task.id), []);
  assert.deepEqual(idsFor(moved, "2026-08-27"), []);
  assert.deepEqual(idsFor(moved, "2026-08-28"), ["task-a"]);
  assert.deepEqual(idsFor(moved, "2026-08-28"), ["task-a"], "a refresh reads the same one canonical task ID");
});

test("deadline-only personal work appears in Today and the matching weekly day", () => {
  const tasks = [{ id: "task-a", status: "ready" as const, deadlineDate: "2026-08-28", assigneeIds: ["person-charlotte"] }];
  const today = getTodayTasks(tasks, "person-charlotte", "2026-08-28");
  const week = getWeekTasks(tasks, "person-charlotte", "2026-08-24", "2026-08-30");
  assert.deepEqual(today.map(task => task.id), ["task-a"]);
  assert.deepEqual(week.filter(task => getTaskPlannerDate(task) === "2026-08-28").map(task => task.id), ["task-a"]);
});

test("a planned date wins over a future deadline without duplicating the task", () => {
  const tasks = [{ id: "task-b", status: "in_progress" as const, startDate: "2026-08-28", deadlineDate: "2026-08-31", assigneeIds: ["person-charlotte"] }];
  const week = getWeekTasks(tasks, "person-charlotte", "2026-08-24", "2026-08-31");
  assert.deepEqual(getTodayTasks(tasks, "person-charlotte", "2026-08-28").map(task => task.id), ["task-b"]);
  assert.deepEqual(week.filter(task => getTaskPlannerDate(task) === "2026-08-28").map(task => task.id), ["task-b"]);
  assert.equal(week.some(task => getTaskPlannerDate(task) === "2026-08-31"), false);
});

test("future, undated, and another person's tasks do not pollute today's personal work", () => {
  const tasks = [
    { id: "tomorrow", status: "ready" as const, startDate: "2026-08-29", assigneeIds: ["person-charlotte"] },
    { id: "undated", status: "ready" as const, assigneeIds: ["person-charlotte"] },
    { id: "other-person", status: "ready" as const, startDate: "2026-08-28", assigneeIds: ["person-bu-desti"] },
  ];
  assert.deepEqual(getTodayTasks(tasks, "person-charlotte", "2026-08-28").map(task => task.id), []);
  assert.deepEqual(getWeekTasks(tasks, "person-charlotte", "2026-08-24", "2026-08-30").map(task => task.id), ["tomorrow"]);
  assert.deepEqual(getTodayTasks(tasks, "person-charlotte", "2026-08-29").map(task => task.id), ["tomorrow"]);
});

test("changing a deadline moves deadline-only planner placement while preserving the Task ID", () => {
  const before = [{ id: "task-deadline", status: "ready" as const, deadlineDate: "2026-08-28", assigneeIds: ["person-charlotte"] }];
  const after = [{ ...before[0], deadlineDate: "2026-08-30" }];
  assert.deepEqual(getTodayTasks(before, "person-charlotte", "2026-08-28").map(task => task.id), ["task-deadline"]);
  assert.deepEqual(getTodayTasks(after, "person-charlotte", "2026-08-28").map(task => task.id), []);
  assert.deepEqual(getWeekTasks(after, "person-charlotte", "2026-08-24", "2026-08-30").filter(task => getTaskPlannerDate(task) === "2026-08-30").map(task => task.id), ["task-deadline"]);
});

test("date-only planner keys preserve their calendar day", () => {
  assert.equal(calendarDateKey(new Date(Date.UTC(2026, 7, 28))), "2026-08-28");
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

test("workload counts Team queues for Teams, not every Team member", () => {
  const workload = deriveWorkload([
    { id: "shared", status: "in_progress", assigneeIds: ["marketing", "sarah"], primaryOwnerId: "marketing" },
    { id: "team-only", status: "ready", assigneeIds: ["marketing"], primaryOwnerId: "marketing" },
    { id: "review", status: "review", assigneeIds: ["sarah"], primaryOwnerId: "sarah", isOverdue: true },
  ], [
    { id: "marketing", name: "Marketing Team", type: "team", active: true },
    { id: "sarah", name: "Sarah", type: "person", active: true },
  ]);
  assert.equal(workload.find(item => item.principalId === "marketing")?.inProgress, 1);
  assert.equal(workload.find(item => item.principalId === "marketing")?.ready, 1);
  assert.equal(workload.find(item => item.principalId === "sarah")?.inProgress, 1);
  assert.equal(workload.find(item => item.principalId === "sarah")?.ready, 0);
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

test("delegation is assigned-by, not the delegator's personal work", () => {
  const delegated = {
    id: "delegated",
    status: "ready" as const,
    assigneeIds: ["person-bu-desti"],
    assignments: [{ principalId: "person-bu-desti", assignedByPrincipalId: "person-charlotte" }],
  };
  assert.deepEqual(getDelegatedTasks([delegated], "person-charlotte").map(task => task.id), ["delegated"]);
  assert.equal(isTaskPersonallyActionableForPerson(delegated, "person-charlotte"), false);
  assert.equal(isTaskPersonallyActionableForPerson(delegated, "person-bu-desti"), true);
  assert.equal(isTaskTrackedByPerson(delegated, "person-charlotte"), true);
});

test("Waiting separates explicit next actions from a bare waiting status", () => {
  const tasks = [
    { id: "on-me", status: "waiting" as const, nextActionKind: "principal" as const, nextActionPrincipalId: "person-charlotte", assigneeIds: ["team-finance"] },
    { id: "on-other", status: "waiting" as const, nextActionKind: "principal" as const, nextActionPrincipalId: "person-bu-desti", assigneeIds: ["person-charlotte"] },
    { id: "external", status: "waiting" as const, nextActionKind: "external" as const, assigneeIds: ["person-charlotte"] },
    { id: "blocked", status: "blocked" as const, assigneeIds: ["person-charlotte"] },
    { id: "unknown", status: "waiting" as const, nextActionKind: "ready" as const, assignments: [{ principalId: "team-finance", assignedByPrincipalId: "person-charlotte" }] },
  ];
  const waiting = getWaitingWork(tasks, "person-charlotte");
  assert.deepEqual(waiting.waitingOnMe.map(task => task.id), ["on-me"]);
  assert.deepEqual(waiting.waitingOnOthers.map(task => task.id), ["on-other"]);
  assert.deepEqual(waiting.external.map(task => task.id), ["external"]);
  assert.deepEqual(waiting.blocked.map(task => task.id), ["blocked"]);
  assert.equal(waiting.all.some(task => task.id === "unknown"), false, "a missing next action is never silently attributed to the Owner");
});

test("Attention uses one canonical task set and does not double-count overlapping work", () => {
  const tasks = [
    { id: "overlapping", status: "review" as const, reviewerPrincipalId: "person-charlotte", followUpDate: "2026-08-28", deadlineDate: "2026-08-27", assigneeIds: ["person-bu-desti"] },
    { id: "waiting-on-me", status: "waiting" as const, nextActionKind: "principal" as const, nextActionPrincipalId: "person-charlotte", assigneeIds: ["team-finance"] },
    { id: "blocked", status: "blocked" as const, assigneeIds: ["person-charlotte"] },
    { id: "waiting-on-other", status: "waiting" as const, nextActionKind: "principal" as const, nextActionPrincipalId: "person-bu-desti", assigneeIds: ["person-charlotte"] },
    { id: "delegated", status: "ready" as const, assigneeIds: ["person-bu-desti"], assignments: [{ principalId: "person-bu-desti", assignedByPrincipalId: "person-charlotte" }] },
  ];
  const attention = getAttentionWork(tasks, "person-charlotte", "2026-08-28");
  assert.deepEqual(attention.allNow.map(task => task.id), ["overlapping", "waiting-on-me", "blocked"]);
  assert.deepEqual(attention.reasonsByTaskId.get("overlapping"), ["follow_up", "review", "overdue"]);
  assert.deepEqual(attention.followUp.map(task => task.id), ["overlapping"]);
  assert.deepEqual(attention.review.map(task => task.id), ["overlapping"]);
  assert.deepEqual(attention.overdue.map(task => task.id), ["overlapping"]);
  assert.equal(attention.allNow.some(task => task.id === "waiting-on-other"), false, "passive waiting work remains visible in Waiting without inflating the current-user Attention badge");
  assert.equal(attention.allNow.some(task => task.id === "delegated"), false, "delegated tracking remains available without treating delegation as the delegator's immediate action");
});

test("Attention scopes intersect canonical organization and principal relationships", () => {
  const tasks = [
    { id: "finance-villa", organizationId: "villa", status: "waiting" as const, assigneeIds: ["team-finance"], assignments: [{ principalId: "team-finance", assignedByPrincipalId: "person-charlotte" }] },
    { id: "finance-apotik", organizationId: "apotik", status: "blocked" as const, nextActionPrincipalId: "team-finance" },
    { id: "marketing-villa", organizationId: "villa", status: "review" as const, reviewerPrincipalId: "person-bu-desti", assigneeIds: ["team-marketing"] },
  ];
  assert.deepEqual(filterAttentionTasks(tasks, { organizationId: "villa", principalId: "team-finance" }).map(task => task.id), ["finance-villa"]);
  assert.deepEqual(filterAttentionTasks(tasks, { principalId: "person-charlotte" }).map(task => task.id), ["finance-villa"]);
  assert.deepEqual(filterAttentionTasks(tasks, { organizationId: "villa" }).map(task => task.id), ["finance-villa", "marketing-villa"]);
  assert.deepEqual(getTaskAttentionPrincipalIds(tasks[0]).sort(), ["person-charlotte", "team-finance"]);
});

test("review, planner, and overdue slices retain the same canonical task ID", () => {
  const task = {
    id: "review-today",
    status: "review" as const,
    reviewerPrincipalId: "person-charlotte",
    startDate: "2026-08-28",
    deadlineDate: "2026-08-28",
    assigneeIds: ["person-bu-desti"],
  };
  assert.deepEqual(getReviewTasks([task], "person-charlotte").map(item => item.id), [task.id]);
  assert.deepEqual(getTodayTasks([task], "person-charlotte", "2026-08-28").map(item => item.id), [task.id]);
  assert.deepEqual(getWeekTasks([task], "person-charlotte", "2026-08-24", "2026-08-30").map(item => item.id), [task.id]);
  assert.deepEqual(getOverdueTasks([{ ...task, status: "in_progress" as const, deadlineDate: "2026-08-27" }], "2026-08-28").map(item => item.id), [task.id]);
});

test("moving organization or project changes only the linked canonical view", () => {
  const task = { id: "task-a", organizationId: "villa", projectId: "project-a" };
  const moved = { ...task, organizationId: "apotik", projectId: "project-b" };
  const inOrganization = (items: Array<typeof task>, organizationId: string) => items.filter(item => item.organizationId === organizationId).map(item => item.id);
  const inProject = (items: Array<typeof task>, projectId: string) => items.filter(item => item.projectId === projectId).map(item => item.id);
  assert.deepEqual(inOrganization([task], "villa"), [task.id]);
  assert.deepEqual(inOrganization([moved], "villa"), []);
  assert.deepEqual(inOrganization([moved], "apotik"), [task.id]);
  assert.deepEqual(inProject([moved], "project-a"), []);
  assert.deepEqual(inProject([moved], "project-b"), [task.id]);
});

test("organization metrics and their filtered task IDs use one canonical definition", () => {
  const tasks = [
    { id: "today", organizationId: "villa", status: "ready" as const, startDate: "2026-08-28", involvedAreas: ["Finance"] },
    { id: "waiting", organizationId: "villa", status: "waiting" as const, followUpDate: "2026-08-28", involvedAreas: ["Finance", "Marketing"] },
    { id: "done", organizationId: "villa", status: "done" as const, followUpDate: "2026-08-27", involvedAreas: ["Marketing"] },
    { id: "other-org", organizationId: "apotik", status: "waiting" as const, followUpDate: "2026-08-20", involvedAreas: ["Finance"] },
  ];
  assert.deepEqual(getOrganizationTasks(tasks, "villa").map(task => task.id), ["today", "waiting", "done"]);
  assert.deepEqual(getOrganizationActiveTasks(tasks, "villa").map(task => task.id), ["today", "waiting"]);
  assert.deepEqual(getOrganizationTodayTasks(tasks, "villa", "2026-08-28").map(task => task.id), ["today"]);
  assert.deepEqual(getOrganizationWeekTasks(tasks, "villa", "2026-08-24", "2026-08-30").map(task => task.id), ["today"]);
  assert.deepEqual(getOrganizationWaitingTasks(tasks, "villa").map(task => task.id), ["waiting"]);
  assert.deepEqual(getOrganizationRevisitTasks(tasks, "villa", "2026-08-28").map(task => task.id), ["waiting"], "revisit is explicit due follow-up work, never generic attention");
  assert.deepEqual(getOrganizationAreaTasks(tasks, "villa", "Finance").map(task => task.id), ["today", "waiting"]);
  assert.deepEqual(getOrganizationAreaTasks(tasks, "villa", "Marketing").map(task => task.id), ["waiting"], "area chips may overlap while All stays unique");
});

test("project cards, organization project cards, and boards share progress and task IDs", () => {
  const tasks = [
    { id: "ready", projectId: "website", status: "ready" as const, startDate: "2026-08-28" },
    { id: "blocked", projectId: "website", status: "blocked" as const, startDate: "2026-08-28", blockedBy: { label: "Pricing" } },
    { id: "done", projectId: "website", status: "done" as const },
    { id: "other", projectId: "test", status: "ready" as const },
  ];
  const progress = getProjectProgress(tasks, "website");
  assert.deepEqual(getProjectTasks(tasks, "website").map(task => task.id), ["ready", "blocked", "done"]);
  assert.equal(progress.total, 3);
  assert.equal(progress.done, 1);
  assert.equal(progress.remaining, 2);
  assert.equal(progress.progress, 33);
  assert.deepEqual(progress.statusCounts, { ready: 1, in_progress: 0, waiting: 0, blocked: 1, review: 0, done: 1 });
  assert.deepEqual(getProjectMovableTasks(tasks, "website").map(task => task.id), ["ready"]);
  assert.equal(getProjectNextTask(tasks, "website")?.id, "ready");
});

test("organization focus is canonical focus text, not a copied project name", () => {
  const focus = getOrganizationCurrentFocus([
    { status: "active", focusItems: [{ text: "Confirm accommodation pricing", position: 1 }, { text: "Mobile booking flow", position: 0 }] },
    { status: "active", focusItems: [{ text: "Mobile booking flow", position: 0 }] },
    { status: "archived", focusItems: [{ text: "Retired initiative", position: 0 }] },
  ]);
  assert.deepEqual(focus, ["Mobile booking flow", "Confirm accommodation pricing"]);
});
