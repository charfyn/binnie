import type { TaskWorkspaceScope } from "./work-types";

/**
 * Task filters are local to an operational scope. This keeps a monitoring
 * filter (for example an organization from Assigned by me) from silently
 * narrowing the personal-action queue after a tab switch.
 */
export type TaskScopeFilters = {
  search: string;
  organization: string;
  area: string;
  project: string;
  assignee: string;
  team: string;
  assignedBy: string;
  ownedByMe: boolean;
  priority: string;
  status: string;
  date: string;
  hasFiles: boolean;
};

export const EMPTY_TASK_SCOPE_FILTERS: TaskScopeFilters = {
  search: "",
  organization: "",
  area: "",
  project: "",
  assignee: "",
  team: "",
  assignedBy: "",
  ownedByMe: false,
  priority: "",
  status: "",
  date: "",
  hasFiles: false,
};

export function normalizeTaskScopeFilters(scope: TaskWorkspaceScope, filters: TaskScopeFilters): TaskScopeFilters {
  // My Work is always the complete personal-action base. Filters may be set
  // again deliberately from this scope, but are never carried in from a
  // monitoring or historical tab.
  if (scope === "my") return { ...EMPTY_TASK_SCOPE_FILTERS };

  const next = { ...filters, ownedByMe: false };
  if (scope !== "team" && scope !== "assigned_by_me") {
    next.assignee = "";
    next.team = "";
  }
  if (scope !== "team" && scope !== "people") next.assignedBy = "";
  if ((scope === "completed" || scope === "archive") && next.status && next.status !== "done") next.status = "";
  if ((scope === "team" || scope === "people" || scope === "assigned_by_me") && next.status === "done") next.status = "";
  return next;
}
