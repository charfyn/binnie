/**
 * The small, shared contract for Binnie's operational Tasks List. Keeping this
 * outside the view prevents the server validator, persisted preferences, and
 * UI from quietly drifting into different column sets.
 */
export const TASK_LIST_COLUMNS = [
  { id: "task", label: "Task" },
  { id: "priority", label: "Priority" },
  { id: "assignedTo", label: "Currently With" },
  { id: "assignedBy", label: "Assigned By" },
  { id: "owner", label: "Owner" },
  { id: "currentStep", label: "Current Step" },
  { id: "organization", label: "Organization" },
  { id: "area", label: "Area / Department" },
  { id: "project", label: "Project" },
  { id: "status", label: "Status" },
  { id: "assignedDate", label: "Assigned Date" },
  { id: "planFor", label: "Plan For" },
  // Retained as a fallback field for older planning records. It is deliberately
  // not part of an everyday scope's recommended columns.
  { id: "targetDate", label: "Target Date" },
  { id: "deadline", label: "Deadline" },
  { id: "files", label: "Files" },
  { id: "notes", label: "Notes" },
  { id: "blockedBy", label: "Blocked By" },
  { id: "completedBy", label: "Completed By" },
  { id: "completedDate", label: "Completed Date" },
  { id: "archivedDate", label: "Archived Date" },
] as const;

export const TASK_LIST_COLUMN_IDS = TASK_LIST_COLUMNS.map((column) => column.id) as [TaskListColumnId, ...TaskListColumnId[]];

export type TaskListColumnId = (typeof TASK_LIST_COLUMNS)[number]["id"];

/** A normal employee sees just the essential operational context at first. */
export const DEFAULT_TASK_LIST_COLUMNS: TaskListColumnId[] = [
  "task",
  "priority",
  "assignedTo",
  "organization",
  "status",
  "deadline",
];

export type TaskListScope = "my" | "team" | "people" | "assigned_by_me" | "completed" | "archive";

const RECOMMENDED_COLUMNS_BY_SCOPE: Record<TaskListScope, TaskListColumnId[]> = {
  my: ["task", "priority", "assignedTo", "organization", "area", "project", "status", "planFor", "deadline", "files"],
  team: ["task", "priority", "assignedTo", "organization", "area", "project", "status", "planFor", "deadline", "files"],
  people: ["task", "priority", "assignedTo", "organization", "area", "project", "status", "planFor", "deadline", "files"],
  assigned_by_me: ["task", "assignedTo", "assignedBy", "currentStep", "organization", "project", "status", "deadline"],
  completed: ["task", "owner", "completedBy", "completedDate", "organization", "project"],
  archive: ["task", "owner", "completedDate", "archivedDate", "organization", "project"],
};

const AVAILABLE_COLUMNS_BY_SCOPE: Record<TaskListScope, TaskListColumnId[]> = {
  my: ["task", "priority", "assignedTo", "currentStep", "organization", "area", "project", "status", "planFor", "deadline", "files", "notes", "blockedBy", "targetDate"],
  team: ["task", "priority", "assignedTo", "assignedBy", "currentStep", "organization", "area", "project", "status", "planFor", "deadline", "files", "notes", "blockedBy", "targetDate"],
  people: ["task", "priority", "assignedTo", "assignedBy", "currentStep", "organization", "area", "project", "status", "planFor", "deadline", "files", "notes", "blockedBy", "targetDate"],
  assigned_by_me: ["task", "priority", "assignedTo", "assignedBy", "currentStep", "owner", "organization", "area", "project", "status", "assignedDate", "planFor", "deadline", "files", "notes", "blockedBy", "targetDate"],
  completed: ["task", "owner", "completedBy", "completedDate", "organization", "area", "project", "priority", "currentStep", "files", "notes", "targetDate"],
  archive: ["task", "owner", "completedBy", "completedDate", "archivedDate", "organization", "area", "project", "currentStep", "files", "notes", "targetDate"],
};

export function getRecommendedTaskListColumns(scope: TaskListScope): TaskListColumnId[] {
  return [...RECOMMENDED_COLUMNS_BY_SCOPE[scope]];
}

export function getTaskListColumnOptions(scope: TaskListScope) {
  const allowed = new Set(AVAILABLE_COLUMNS_BY_SCOPE[scope]);
  return TASK_LIST_COLUMNS.filter((column) => allowed.has(column.id));
}
