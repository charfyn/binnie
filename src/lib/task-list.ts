/**
 * The small, shared contract for Binnie's operational Tasks List. Keeping this
 * outside the view prevents the server validator, persisted preferences, and
 * UI from quietly drifting into different column sets.
 */
export const TASK_LIST_COLUMNS = [
  { id: "task", label: "Task" },
  { id: "priority", label: "Priority" },
  { id: "assignedTo", label: "Assigned To" },
  { id: "assignedBy", label: "Assigned By" },
  { id: "organization", label: "Organization" },
  { id: "area", label: "Area / Department" },
  { id: "project", label: "Project" },
  { id: "status", label: "Status" },
  { id: "assignedDate", label: "Assigned Date" },
  { id: "targetDate", label: "Target Date" },
  { id: "deadline", label: "Deadline" },
  { id: "files", label: "Files" },
  { id: "notes", label: "Notes" },
  { id: "blockedBy", label: "Blocked By" },
  { id: "completedDate", label: "Completed Date" },
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
