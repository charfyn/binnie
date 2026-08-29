export type WorkStatus = "ready" | "in_progress" | "waiting" | "blocked" | "review" | "done";

/**
 * Keeps the two dependency promises intentionally small: one controls the
 * start of work, the other controls only final completion. Waiting itself is
 * never treated as a blocker.
 */
export function taskTransitionBlockReason(input: {
  targetStatus: WorkStatus;
  unresolvedStartBlockers: number;
  unresolvedCompletionBlockers: number;
}) {
  if (input.targetStatus === "in_progress" && input.unresolvedStartBlockers > 0) {
    return "This task cannot start until its start blocker is resolved.";
  }
  if (input.targetStatus === "done" && input.unresolvedCompletionBlockers > 0) {
    return "This task can move, but final completion is waiting on a dependency.";
  }
  return undefined;
}

export function needsAttention(input: {
  isOverdue: boolean;
  isFollowUpDue: boolean;
  blockedDependents: number;
  reviewWaitingHours: number;
  daysWithoutUpdate: number;
}) {
  return input.isOverdue
    || input.isFollowUpDue
    || input.blockedDependents > 0
    || input.reviewWaitingHours >= 48
    || input.daysWithoutUpdate >= 5;
}

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly" | "months";
  interval: number;
  weekDays: number[];
  monthDay?: number | null;
};

/**
 * Calculates the next occurrence without mutating a task. Keeping it pure lets
 * the lifecycle use the same schedule rule for creation, completion, and tests.
 */
export function nextOccurrenceDate(current: Date, rule: RecurrenceRule) {
  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  };
  const interval = Math.max(1, rule.interval);
  if (rule.frequency === "daily") return addDays(current, interval);
  if (rule.frequency === "weekly") {
    const selectedDays = rule.weekDays.length ? rule.weekDays : [current.getUTCDay()];
    for (let offset = 1; offset <= 7 * interval; offset += 1) {
      const candidate = addDays(current, offset);
      if (selectedDays.includes(candidate.getUTCDay())) return candidate;
    }
    return addDays(current, 7 * interval);
  }
  const increment = rule.frequency === "months" ? interval : 1;
  const candidate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + increment, 1));
  const lastDay = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)).getUTCDate();
  candidate.setUTCDate(Math.min(rule.monthDay || current.getUTCDate(), lastDay));
  return candidate;
}

export type NaturalSearchContext = {
  organizations?: string[];
  departments?: string[];
  assignees?: string[];
  projects?: string[];
};

export type NaturalSearchQuery = {
  raw: string;
  text: string;
  statuses: WorkStatus[];
  overdue?: boolean;
  mine?: boolean;
  dateRange?: { start: string; end: string };
  organizations: string[];
  departments: string[];
  assignees: string[];
  projects: string[];
  waitingOn?: string;
};

export type SearchableTask = {
  title: string;
  description?: string;
  status: WorkStatus;
  isOverdue?: boolean;
  org?: string;
  areas?: string[];
  assignees?: string[];
  project?: string;
  nextActionBy?: string;
  dependencyOwners?: string[];
  deadlineDate?: string;
  targetDate?: string;
  startDate?: string;
  assigneeIds?: string[];
};

/**
 * Date-only task fields are calendar values, not instants. Callers first
 * normalize "now" to their workspace day, then use this key everywhere a
 * planner date is compared or serialized.
 */
export function calendarDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type TaskPlannerDateInput = {
  startDate?: string;
  targetDate?: string;
  deadlineDate?: string;
  deadline?: string;
  isToday?: boolean;
};

/** The smallest client-safe shape needed to derive a person's planner work. */
export type PersonalPlannerTask = TaskPlannerDateInput & {
  id: string;
  status?: WorkStatus;
  archived?: boolean;
  assigneeIds?: string[];
  nextActionPrincipalId?: string;
  createdByPrincipalId?: string;
  reviewerPrincipalId?: string;
  /** Unresolved non-related dependencies whose named owner must act next. */
  dependencyActionOwnerIds?: string[];
};

/**
 * The narrow relationship shape shared by the non-planner queues.  It is kept
 * separate from authorization deliberately: an assignment records work
 * responsibility, while a visibility grant only controls who may inspect it.
 */
export type TaskAssignmentRelationship = {
  principalId: string;
  assignedByPrincipalId?: string;
};

export type WorkQueueTask = PersonalPlannerTask & {
  assignments?: TaskAssignmentRelationship[];
  nextActionKind?: "principal" | "department" | "external" | "ready";
  nextActionDepartmentId?: string;
  followUpDate?: string;
};

/**
 * The one definition of a person's actionable work. Authorization is
 * intentionally absent: being allowed to inspect a Team's work never makes
 * that work personal. Team IDs must therefore never be supplied as a match
 * for `personId` here.
 */
export function isTaskPersonallyActionableForPerson(task: PersonalPlannerTask, personId: string) {
  if (!personId) return false;
  const assigneeIds = task.assigneeIds || [];
  const isCurrentReviewer = task.status === "review" && task.reviewerPrincipalId === personId;
  const isUnassignedOwnedCapture = assigneeIds.length === 0
    && task.createdByPrincipalId === personId
    // Once a task explicitly says another person must move it, delegation is
    // no longer the creator's personal queue.
    && (!task.nextActionPrincipalId || task.nextActionPrincipalId === personId)
    && (task.status !== "review" || isCurrentReviewer);
  return assigneeIds.includes(personId)
    || task.nextActionPrincipalId === personId
    || isCurrentReviewer
    || task.dependencyActionOwnerIds?.includes(personId) === true
    || isUnassignedOwnedCapture;
}

function isOpenTask(task: Pick<PersonalPlannerTask, "archived" | "status">) {
  return !task.archived && task.status !== "done";
}

/**
 * Delegated is an authored relationship, not a guess based on a task being
 * visible or assigned.  `assignedByPrincipalId` is the canonical distinction
 * between “I gave this away” and “I can inspect this work”.
 */
export function isTaskDelegatedByPerson(task: WorkQueueTask, personId: string) {
  if (!personId) return false;
  return task.assignments?.some((assignment) =>
    assignment.assignedByPrincipalId === personId && assignment.principalId !== personId,
  ) === true;
}

export function getDelegatedTasks<T extends WorkQueueTask>(tasks: T[], personId: string) {
  return tasks.filter((task) => isOpenTask(task) && isTaskDelegatedByPerson(task, personId));
}

/** A person tracks work when it is theirs to act on or they explicitly delegated it. */
export function isTaskTrackedByPerson(task: WorkQueueTask, personId: string) {
  return isTaskPersonallyActionableForPerson(task, personId)
    || isTaskDelegatedByPerson(task, personId);
}

/**
 * Waiting is a relationship to the *next* action, never a reinterpretation of
 * the status alone.  Tasks without a recorded actor remain unclassified rather
 * than being silently attributed to the signed-in owner.
 */
export function getWaitingWork<T extends WorkQueueTask>(tasks: T[], personId: string) {
  const active = tasks.filter(isOpenTask);
  const waiting = active.filter((task) => task.status === "waiting");
  const waitingOnMe = waiting.filter((task) => task.nextActionPrincipalId === personId);
  const external = waiting.filter((task) =>
    task.nextActionKind === "external" && isTaskTrackedByPerson(task, personId),
  );
  const waitingOnOthers = waiting.filter((task) => {
    const hasInternalNextAction = task.nextActionKind === "principal" || task.nextActionKind === "department";
    return hasInternalNextAction
      && task.nextActionPrincipalId !== personId
      && isTaskTrackedByPerson(task, personId);
  });
  const blocked = active.filter((task) => task.status === "blocked" && isTaskTrackedByPerson(task, personId));
  const all = Array.from(new Map([
    ...waitingOnOthers,
    ...waitingOnMe,
    ...blocked,
    ...external,
  ].map((task) => [task.id, task])).values());
  return { waitingOnOthers, waitingOnMe, blocked, external, all };
}

/** Follow-up dates are reminders for work the person actually owns or delegated. */
export function getFollowUpTasks<T extends WorkQueueTask>(tasks: T[], personId: string, date: string) {
  return tasks.filter((task) =>
    isOpenTask(task)
    && Boolean(task.followUpDate && task.followUpDate <= date)
    && isTaskTrackedByPerson(task, personId),
  );
}

/** Review work is only actionable for the named reviewer or explicit next actor. */
export function getReviewTasks<T extends WorkQueueTask>(tasks: T[], personId: string) {
  return tasks.filter((task) =>
    isOpenTask(task)
    && task.status === "review"
    && (task.reviewerPrincipalId === personId || task.nextActionPrincipalId === personId),
  );
}

/** Overdue is a derived condition over the canonical deadline, not a status. */
export function getOverdueTasks<T extends TaskPlannerDateInput & { id: string; status?: WorkStatus; archived?: boolean }>(tasks: T[], date: string) {
  return tasks.filter((task) =>
    !task.archived
    && task.status !== "done"
    && Boolean(task.deadlineDate && task.deadlineDate < date),
  );
}

/**
 * Organization and Project screens are operational lenses over the very same
 * task rows used elsewhere.  These selectors deliberately know nothing about
 * the viewer's personal responsibility: callers apply authorization before
 * supplying tasks, while the selector only answers the organization/project
 * question.
 */
export type OrganizationWorkTask = WorkQueueTask & {
  organizationId?: string;
  /** Compatibility for the older client projection while it is being retired. */
  org?: string;
  area?: string;
  involvedAreas?: string[];
  involvedDepartments?: Array<{ id?: string; name: string }>;
  projectId?: string;
};

function belongsToOrganization(task: OrganizationWorkTask, organizationId: string) {
  // Canonical callers use organizationId. The org-name fallback only keeps the
  // legacy client projection readable until every old task has been migrated.
  return task.organizationId === organizationId || task.org === organizationId;
}

export function getOrganizationTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string) {
  return tasks.filter((task) => !task.archived && belongsToOrganization(task, organizationId));
}

export function getOrganizationActiveTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string) {
  return getOrganizationTasks(tasks, organizationId).filter((task) => task.status !== "done");
}

/** Organization operational Today: all authorized unfinished organization work. */
export function getOrganizationTodayTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string, date: string) {
  return getOrganizationActiveTasks(tasks, organizationId)
    .filter((task) => getTaskPlannerDate(task) === date);
}

/** Organization operational week: the same planner rule as Today, wider range. */
export function getOrganizationWeekTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string, startDate: string, endDate: string) {
  return getOrganizationActiveTasks(tasks, organizationId)
    .filter((task) => {
      const plannerDate = getTaskPlannerDate(task);
      return Boolean(plannerDate && plannerDate >= startDate && plannerDate <= endDate);
    });
}

/** Waiting is status-derived; personal Waiting applies an extra person scope. */
export function getOrganizationWaitingTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string) {
  return getOrganizationActiveTasks(tasks, organizationId).filter((task) => task.status === "waiting");
}

/**
 * Revisit is one follow-up definition everywhere: unfinished work with an
 * explicit follow-up date due today or earlier. Deadlines and overdue work are
 * intentionally not substituted for a follow-up reminder.
 */
export function getOrganizationRevisitTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string, date: string) {
  return getOrganizationActiveTasks(tasks, organizationId)
    .filter((task) => Boolean(task.followUpDate && task.followUpDate <= date));
}

/** Area counts use the same unit: unfinished tasks with that area involved. */
export function getOrganizationAreaTasks<T extends OrganizationWorkTask>(tasks: T[], organizationId: string, area: string) {
  return getOrganizationActiveTasks(tasks, organizationId).filter((task) => {
    const areas = new Set([
      task.area,
      ...(task.involvedAreas || []),
      ...(task.involvedDepartments || []).map((department) => department.name),
    ].filter((value): value is string => Boolean(value)));
    return areas.has(area);
  });
}

export type ProjectWorkTask = OrganizationWorkTask & {
  projectId?: string;
  canStartNow?: boolean;
  blockedBy?: unknown;
};

export type ProjectProgress = {
  tasks: ProjectWorkTask[];
  total: number;
  done: number;
  remaining: number;
  progress: number;
  statusCounts: Record<WorkStatus, number>;
};

export function getProjectTasks<T extends ProjectWorkTask>(tasks: T[], projectId: string) {
  return tasks.filter((task) => !task.archived && task.projectId === projectId);
}

/** One project progress calculation for cards, Organization detail, and header. */
export function getProjectProgress<T extends ProjectWorkTask>(tasks: T[], projectId: string): ProjectProgress {
  const projectTasks = getProjectTasks(tasks, projectId);
  const statusCounts: Record<WorkStatus, number> = { ready: 0, in_progress: 0, waiting: 0, blocked: 0, review: 0, done: 0 };
  projectTasks.forEach((task) => { if (task.status) statusCounts[task.status] += 1; });
  const done = statusCounts.done;
  return {
    tasks: projectTasks,
    total: projectTasks.length,
    done,
    remaining: projectTasks.length - done,
    progress: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
    statusCounts,
  };
}

/** Work that can actually begin or continue now; status and blockers stay separate. */
export function getProjectMovableTasks<T extends ProjectWorkTask>(tasks: T[], projectId: string) {
  return getProjectTasks(tasks, projectId).filter((task) =>
    (task.status === "ready" || task.status === "in_progress")
    && task.canStartNow !== false
    && !task.blockedBy,
  );
}

/** The card's Next label always points at a real canonical task title. */
export function getProjectNextTask<T extends ProjectWorkTask>(tasks: T[], projectId: string) {
  const statusOrder: Record<WorkStatus, number> = { in_progress: 0, ready: 1, review: 2, waiting: 3, blocked: 4, done: 5 };
  return [...getProjectMovableTasks(tasks, projectId)].sort((left, right) => {
    const statusDelta = statusOrder[left.status || "ready"] - statusOrder[right.status || "ready"];
    if (statusDelta) return statusDelta;
    const leftDate = getTaskPlannerDate(left) || "9999-12-31";
    const rightDate = getTaskPlannerDate(right) || "9999-12-31";
    return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id);
  })[0];
}

export type ProjectFocusSource = { focusItems?: Array<{ text: string; position?: number }>; status?: string };

/** Organization focus is only explicit canonical Project focus text, never project names. */
export function getOrganizationCurrentFocus(projects: ProjectFocusSource[]) {
  return projects
    .filter((project) => project.status !== "archived")
    .flatMap((project) => (project.focusItems || []).slice().sort((left, right) => (left.position || 0) - (right.position || 0)).map((item) => item.text.trim()))
    .filter(Boolean)
    .filter((text, index, values) => values.indexOf(text) === index);
}

/** @deprecated Use isTaskPersonallyActionableForPerson. */
export const isPersonalPlannerTask = isTaskPersonallyActionableForPerson;

function legacyDeadlineDate(deadline: string | undefined, today: Date) {
  const match = deadline?.trim().match(/^(?:[a-z]+,?\s+)?(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?$/i);
  if (!match) return undefined;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = monthNames.indexOf(match[2].slice(0, 3).toLowerCase());
  const day = Number(match[1]);
  const year = Number(match[3] || today.getUTCFullYear());
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? calendarDateKey(date) : undefined;
}

/**
 * The one calendar-routing rule used by Today, This Week, and task filters.
 * `startDate` is Binnie's explicit “Plan for” field. A target date retains its
 * established product meaning as a planning fallback, and a deadline routes a
 * task only when neither planning field is present. The legacy labels are read
 * compatibility only; they never create a second source of work.
 */
export function getTaskPlannerDate(task: TaskPlannerDateInput, today = new Date()) {
  if (task.startDate) return task.startDate;
  if (task.targetDate) return task.targetDate;
  if (task.deadlineDate) return task.deadlineDate;
  if (task.isToday || task.deadline === "Today") return calendarDateKey(today);
  if (task.deadline === "Tomorrow") { const tomorrow = new Date(today); tomorrow.setUTCDate(today.getUTCDate() + 1); return calendarDateKey(tomorrow); }
  if (task.deadline === "Yesterday") { const yesterday = new Date(today); yesterday.setUTCDate(today.getUTCDate() - 1); return calendarDateKey(yesterday); }
  return legacyDeadlineDate(task.deadline, today);
}

/**
 * The personal planner universe is deliberately separate from management
 * visibility. Every planner slice starts here, so Today, This Week, and their
 * counters cannot drift into different assignment rules.
 */
export function getVisiblePersonalTasks<T extends PersonalPlannerTask>(
  tasks: T[],
  actorId: string,
  options: { includeCompleted?: boolean } = {},
) {
  return tasks.filter((task) =>
    !task.archived
    && (options.includeCompleted || task.status !== "done")
    && isTaskPersonallyActionableForPerson(task, actorId),
  );
}

/** Today's unfinished personal work for one canonical calendar date. */
export function getTodayTasks<T extends PersonalPlannerTask>(tasks: T[], actorId: string, date: string) {
  return getVisiblePersonalTasks(tasks, actorId)
    .filter((task) => getTaskPlannerDate(task) === date);
}

/**
 * This Week is the same personal universe as Today, expanded to a date range.
 * Completed work stays in the weekly record; Today intentionally excludes it
 * from remaining workload.
 */
export function getWeekTasks<T extends PersonalPlannerTask>(tasks: T[], actorId: string, startDate: string, endDate: string) {
  return getVisiblePersonalTasks(tasks, actorId, { includeCompleted: true })
    .filter((task) => {
      const plannerDate = getTaskPlannerDate(task);
      return Boolean(plannerDate && plannerDate >= startDate && plannerDate <= endDate);
    });
}

/** @deprecated Use getTaskPlannerDate. Retained for narrow compatibility. */
export const getTaskEffectiveDate = getTaskPlannerDate;

/** @deprecated Use getTodayTasks. Retained for narrow compatibility. */
export const getPersonalPlannerTasksForDate = getTodayTasks;

/** @deprecated Use getWeekTasks. Retained for narrow compatibility. */
export const getPersonalPlannerTasksForWeek = getWeekTasks;

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function startOfWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - mondayOffset);
  return copy;
}

function includesPhrase(haystack: string, needle: string) {
  return haystack.includes(needle.toLowerCase());
}

/**
 * Turns a small, human query into ordinary structured filters. The parser is
 * deliberately narrow and deterministic: structured filters remain available
 * for anything it cannot confidently express.
 */
export function parseNaturalTaskSearch(query: string, context: NaturalSearchContext = {}, now = new Date()): NaturalSearchQuery {
  const raw = query.trim();
  const source = raw.toLowerCase().replace(/\s+/g, " ");
  const statuses: WorkStatus[] = [];
  const statusTerms: Array<[RegExp, WorkStatus]> = [
    [/\bready\b|\bcan start\b/, "ready"],
    [/\bin progress\b|\bactive\b/, "in_progress"],
    [/\bwaiting\b/, "waiting"],
    [/\bblocked\b|\bstuck\b/, "blocked"],
    [/\breview\b/, "review"],
    [/\bdone\b|\bcompleted\b/, "done"],
  ];
  statusTerms.forEach(([pattern, status]) => { if (pattern.test(source)) statuses.push(status); });

  let dateRange: NaturalSearchQuery["dateRange"];
  if (/\btoday\b/.test(source)) {
    const today = calendarDateKey(now);
    dateRange = { start: today, end: today };
  } else if (/\bthis week\b/.test(source)) {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    dateRange = { start: calendarDateKey(start), end: calendarDateKey(end) };
  } else if (/\bthis month\b/.test(source)) {
    dateRange = {
      start: calendarDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
      end: calendarDateKey(endOfMonth(now)),
    };
  }

  const known = (values: string[] | undefined) => (values || []).filter(value => includesPhrase(source, value));
  const waitingMatch = source.match(/\bwaiting on\s+(.+?)(?=\b(?:this|today|overdue|tasks?|work|and)\b|$)/);
  const waitingOn = waitingMatch?.[1]?.trim();
  const consumed = [
    "overdue", "my tasks", "for me", "assigned to me", "this month", "this week", "today",
    "ready", "can start", "in progress", "active", "waiting", "blocked", "stuck", "review", "done", "completed",
    ...(context.organizations || []), ...(context.departments || []), ...(context.assignees || []), ...(context.projects || []),
    waitingMatch?.[0] || "",
  ].filter(Boolean);
  let text = source;
  consumed.sort((a, b) => b.length - a.length).forEach(term => { text = text.replaceAll(term.toLowerCase(), " "); });
  text = text.replace(/\b(tasks?|work|show|find|with|for|on|in|the|all|me)\b/g, " ").replace(/\s+/g, " ").trim();

  const organizations = known(context.organizations);
  const departments = known(context.departments).filter(value => value.toLowerCase() !== waitingOn?.toLowerCase());
  const assignees = known(context.assignees).filter(value => value.toLowerCase() !== waitingOn?.toLowerCase());
  return {
    raw,
    text,
    statuses: [...new Set(statuses)],
    overdue: /\boverdue\b/.test(source) || undefined,
    mine: /\b(my tasks|for me|assigned to me)\b/.test(source) || undefined,
    dateRange,
    organizations,
    departments,
    assignees,
    projects: known(context.projects),
    waitingOn,
  };
}

export function matchesNaturalTaskSearch(task: SearchableTask, query: NaturalSearchQuery, actorId?: string) {
  if (query.statuses.length && !query.statuses.includes(task.status)) return false;
  if (query.overdue && !task.isOverdue) return false;
  if (query.mine && (!actorId || !task.assigneeIds?.includes(actorId))) return false;
  const includesAny = (values: string[], expected: string[]) => !expected.length || expected.some(value => values.some(candidate => candidate.toLowerCase() === value.toLowerCase()));
  if (!includesAny([task.org || ""], query.organizations)) return false;
  if (!includesAny(task.areas || [], query.departments)) return false;
  if (!includesAny(task.assignees || [], query.assignees)) return false;
  if (!includesAny([task.project || ""], query.projects)) return false;
  if (query.waitingOn) {
    const ownership = [task.nextActionBy || "", ...(task.dependencyOwners || [])].join(" ").toLowerCase();
    if (!ownership.includes(query.waitingOn.toLowerCase())) return false;
  }
  if (query.dateRange) {
    const date = getTaskPlannerDate(task);
    if (!date || date < query.dateRange.start || date > query.dateRange.end) return false;
  }
  if (!query.text) return true;
  return [task.title, task.description || "", task.org || "", ...(task.areas || []), ...(task.assignees || []), task.project || "", task.nextActionBy || ""]
    .join(" ").toLowerCase().includes(query.text);
}

export type WorkloadTask = {
  id: string;
  status: WorkStatus;
  isOverdue?: boolean;
  isFollowUpDue?: boolean;
  assigneeIds?: string[];
  nextActionPrincipalId?: string;
  createdByPrincipalId?: string;
  reviewerPrincipalId?: string;
  dependencyActionOwnerIds?: string[];
  primaryOwnerId?: string;
  blockedDependentCount?: number;
};

export type WorkloadPrincipal = { id: string; name: string; type: "person" | "team"; active: boolean };

export type WorkloadSummary = {
  principalId: string;
  name: string;
  type: "person" | "team";
  ready: number;
  inProgress: number;
  waiting: number;
  blocked: number;
  review: number;
  overdue: number;
  needsAttention: number;
  primaryOwned: number;
  active: number;
  waitingOnOthers: number;
  blockingOthers: number;
  load: "light" | "steady" | "full";
};

/** Directional workload, not a promise of capacity forecasting. */
export function deriveWorkload(tasks: WorkloadTask[], principals: WorkloadPrincipal[]): WorkloadSummary[] {
  return principals.filter(person => person.active).map(person => {
    const assigned = tasks.filter(task => task.status !== "done" && (
      person.type === "team"
        ? task.assigneeIds?.includes(person.id)
        : isTaskPersonallyActionableForPerson(task, person.id)
    ));
    const count = (status: WorkStatus) => assigned.filter(task => task.status === status).length;
    const active = assigned.filter(task => task.status === "ready" || task.status === "in_progress" || task.status === "review").length;
    const overdue = assigned.filter(task => task.isOverdue).length;
    const needsAttention = assigned.filter(task => task.isOverdue || task.isFollowUpDue || task.status === "blocked" || task.status === "review").length;
    const blockingOthers = tasks.filter(task => task.primaryOwnerId === person.id).reduce((sum, task) => sum + (task.blockedDependentCount || 0), 0);
    const pressure = active + count("blocked") * 1.5 + count("review") * 1.25 + overdue * 2 + blockingOthers * 1.5;
    return {
      principalId: person.id,
      name: person.name,
      type: person.type,
      ready: count("ready"),
      inProgress: count("in_progress"),
      waiting: count("waiting"),
      blocked: count("blocked"),
      review: count("review"),
      overdue,
      needsAttention,
      primaryOwned: assigned.filter(task => task.primaryOwnerId === person.id).length,
      active,
      waitingOnOthers: count("waiting") + count("blocked"),
      blockingOthers,
      load: (pressure >= 11 ? "full" : pressure >= 5 ? "steady" : "light") as WorkloadSummary["load"],
    };
  }).sort((left, right) => right.needsAttention - left.needsAttention || right.active - left.active || left.name.localeCompare(right.name));
}

export type NudgeTask = {
  id: string;
  title: string;
  status: WorkStatus;
  isOverdue?: boolean;
  isFollowUpDue?: boolean;
  daysWithoutUpdate?: number;
  reviewWaitingHours?: number;
  blockedDependentCount?: number;
  nextActionBy?: string;
  deadlineDate?: string;
  priority?: "low" | "medium" | "high" | "urgent";
};

export type WorkNudgeCandidate = {
  dedupKey: string;
  taskId: string;
  kind: "overdue" | "follow_up" | "review" | "blocker" | "stale_delegation" | "deadline_risk";
  title: string;
  detail: string;
  priority: number;
};

/**
 * Produces a restrained action queue. A bare Waiting status never produces a
 * nudge: Binnie only speaks up when a date, a blocked colleague, or time makes
 * the next move meaningful.
 */
export function deriveWorkNudges(tasks: NudgeTask[], now = new Date()): WorkNudgeCandidate[] {
  const today = calendarDateKey(now);
  const candidates: WorkNudgeCandidate[] = [];
  tasks.filter(task => task.status !== "done").forEach(task => {
    if (task.isOverdue) candidates.push({ dedupKey: `overdue:${task.id}`, taskId: task.id, kind: "overdue", title: task.title, detail: "The deadline has passed. Decide the next move or reset it.", priority: 100 });
    if (task.isFollowUpDue) candidates.push({ dedupKey: `follow-up:${task.id}`, taskId: task.id, kind: "follow_up", title: task.title, detail: `It is time to check in with ${task.nextActionBy || "the next owner"}.`, priority: 85 });
    if ((task.reviewWaitingHours || 0) >= 48) candidates.push({ dedupKey: `review:${task.id}`, taskId: task.id, kind: "review", title: task.title, detail: "This review has been waiting for two days or more.", priority: 80 });
    if ((task.blockedDependentCount || 0) > 0) candidates.push({ dedupKey: `blocker:${task.id}`, taskId: task.id, kind: "blocker", title: task.title, detail: `${task.blockedDependentCount} downstream ${task.blockedDependentCount === 1 ? "task is" : "tasks are"} waiting on this.`, priority: 95 });
    if (task.status === "waiting" && (task.daysWithoutUpdate || 0) >= 5) candidates.push({ dedupKey: `stale:${task.id}`, taskId: task.id, kind: "stale_delegation", title: task.title, detail: `No update for ${task.daysWithoutUpdate} days. A quiet follow-up may help.`, priority: 65 });
    if (task.deadlineDate && task.deadlineDate >= today && task.priority && ["high", "urgent"].includes(task.priority)) {
      const diff = Math.ceil((Date.parse(`${task.deadlineDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
      if (diff <= 2 && task.status === "ready") candidates.push({ dedupKey: `deadline-risk:${task.id}`, taskId: task.id, kind: "deadline_risk", title: task.title, detail: `Due in ${diff === 0 ? "one day" : `${diff} days`} and work has not started.`, priority: 70 });
    }
  });
  return candidates.sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title)).slice(0, 12);
}

export type RoadmapTask = { id: string; title: string; dependencies?: Array<{ prerequisiteTaskId?: string; type: "start_blocker" | "completion_blocker" | "related"; label: string; resolvedAt?: string }> };
export type RoadmapDependency = { fromTaskId: string; toTaskId: string; type: "start_blocker" | "completion_blocker" | "related"; label: string; resolved: boolean };

export function deriveRoadmapDependencies(tasks: RoadmapTask[]): RoadmapDependency[] {
  const ids = new Set(tasks.map(task => task.id));
  return tasks.flatMap(task => (task.dependencies || [])
    .filter(dependency => dependency.prerequisiteTaskId && ids.has(dependency.prerequisiteTaskId))
    .map(dependency => ({ fromTaskId: dependency.prerequisiteTaskId!, toTaskId: task.id, type: dependency.type, label: dependency.label, resolved: Boolean(dependency.resolvedAt) })));
}
