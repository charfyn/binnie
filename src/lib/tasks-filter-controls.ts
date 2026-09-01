export type TasksFilterScope = "my" | "team" | "people" | "assigned_by_me" | "completed" | "archive";
export type TasksFilterMode = "list" | "board";
export type TasksFilterControl = "team" | "area" | "project" | "person" | "assigned_by" | "priority" | "status" | "date" | "files";

/**
 * Keeps scope, presentation, and secondary narrowing distinct in the Tasks
 * workspace. Organization intentionally stays in the always-visible toolbar.
 */
export function getTasksFilterControls(scope: TasksFilterScope, mode: TasksFilterMode): TasksFilterControl[] {
  const controls: TasksFilterControl[] = ["area", "project"];
  if (scope === "team" || scope === "assigned_by_me") controls.unshift("team");
  if (scope === "team" || scope === "assigned_by_me") controls.push("person");
  if (scope === "team" || scope === "people") controls.push("assigned_by");
  controls.push("priority");
  if (mode === "list") controls.push("status");
  controls.push("date", "files");
  return controls;
}
