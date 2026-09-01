export type PrimarySidebarView =
  | "home"
  | "today"
  | "this-week"
  | "all-tasks"
  | "inbox"
  | "attention"
  | "people"
  | "organizations"
  | "projects";

/**
 * A sidebar can have one active primary destination. Detail and legacy views
 * belong to their parent destination; transient tools such as Search do not.
 */
export function getPrimarySidebarView(view: string): PrimarySidebarView | undefined {
  const normalized = view === "org-detail" ? "organizations"
    : view === "project-detail" || view === "templates" ? "projects"
      : view === "person-detail" || view === "workload" ? "people"
        : ["delegated", "waiting", "followup", "review", "overdue"].includes(view) ? "attention"
          : view;
  return ["home", "today", "this-week", "all-tasks", "inbox", "attention", "people", "organizations", "projects"].includes(normalized)
    ? normalized as PrimarySidebarView
    : undefined;
}
