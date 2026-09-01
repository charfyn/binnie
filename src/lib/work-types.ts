import type { OrganizationColorKey } from "@/lib/organization-colors";

export const TASK_STATUSES = ["ready", "in_progress", "waiting", "blocked", "review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const DEPENDENCY_TYPES = ["start_blocker", "completion_blocker", "related"] as const;
export const NEXT_ACTION_KINDS = ["principal", "department", "external", "ready"] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];
export type DependencyTypeValue = (typeof DEPENDENCY_TYPES)[number];
export type NextActionKindValue = (typeof NEXT_ACTION_KINDS)[number];

export interface DirectoryDTO {
  id: string;
  name: string;
  type: "person" | "team";
  active: boolean;
  accountStatus: "PERSON_ONLY" | "ACTIVE" | "SUSPENDED" | "ACCESS_REMOVED";
  email?: string;
  memberships: Array<{
    organizationId?: string;
    organization?: string;
    departmentId?: string;
    department?: string;
    role: "owner" | "organization_manager" | "department_manager" | "employee";
  }>;
}

export type WorkspaceThemeValue = "soft" | "clear" | "dark";

export interface UserProfileDTO {
  principalId: string;
  displayName: string;
  /** Login credential only; Person IDs remain the canonical identity. */
  username?: string;
  role: DirectoryDTO["memberships"][number]["role"];
  email?: string;
  timezone: string;
  dateFormat: string;
  theme: WorkspaceThemeValue;
  /** 0 denotes a profile created before durable preferences were introduced. */
  storageVersion: number;
  /** Canonical TeamMembership IDs used for personal Today filtering. */
  teamIds: string[];
  /** Personal column choices for the canonical Tasks List view. */
  taskListColumns: string[];
  accountStatus: "ACTIVE";
  workspaces: Array<{ organizationId: string; organization: string; accessLevel: string }>;
  pendingAccessRequestCount: number;
}

/** A raw thought Binnie retained because it could not safely organize it yet. */
export interface InboxCaptureDTO {
  id: string;
  rawText: string;
  status: "needs_organization" | "reviewing";
  createdAt: string;
}

export interface TaskAssignmentDTO {
  id: string;
  principalId: string;
  name: string;
  type: "person" | "team";
  role: "primary_owner" | "collaborator";
  source: "manual" | "department_routing" | "smart_inbox" | "claim" | "import";
  assignedAt: string;
  assignedByPrincipalId?: string;
  assignedBy?: string;
  claimedFromAssignmentId?: string;
}

/**
 * Tasks has one intentionally small set of scopes. Broader visibility is
 * reached through People/Team selection rather than a separate "all work"
 * dashboard, which keeps the default workspace personal and calm.
 */
export const TASK_WORKSPACE_SCOPES = ["my", "team", "people", "assigned_by_me", "completed", "archive"] as const;
export type TaskWorkspaceScope = (typeof TASK_WORKSPACE_SCOPES)[number];

/** A deliberately narrow option set for the Tasks scope selector. */
export interface TaskScopeOptionDTO {
  id: string;
  name: string;
  subtitle?: string;
  /** Team scopes always use a stable Team Principal ID. */
  kind?: "team";
}

/** Server-authorized task data for one Tasks page scope. */
export interface TaskScopeResultDTO {
  scope: TaskWorkspaceScope;
  /** Advanced monitoring filter; never changes the primary My Work meaning. */
  ownedByMe?: boolean;
  tasks: TaskDTO[];
  people: TaskScopeOptionDTO[];
  teams: TaskScopeOptionDTO[];
  allowedScopes: TaskWorkspaceScope[];
}

export interface TaskDependencyDTO {
  id: string;
  type: DependencyTypeValue;
  label: string;
  prerequisiteTaskId?: string;
  ownerPrincipalId?: string;
  ownerDepartmentId?: string;
  owner?: string;
  resolvedAt?: string;
}

export interface TaskResourceDTO {
  id: string;
  label: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
  kind: "link" | "file";
}

export interface OrganizationDTO {
  id: string;
  name: string;
  description?: string;
  /** Persistent semantic identity, shared by organization and project cards. */
  colorKey: OrganizationColorKey;
  aliases: string[];
  departments: Array<{ id: string; name: string; aliases: string[]; teamId?: string }>;
  resources: TaskResourceDTO[];
}

export interface TaskUpdateDTO {
  id: string;
  authorId: string;
  author: string;
  text: string;
  createdAt: string;
  resources: TaskResourceDTO[];
}

export interface TaskActivityDTO {
  id: string;
  type: string;
  actor?: string;
  summary: string;
  createdAt: string;
}

export interface TaskChecklistItemDTO {
  id: string;
  title: string;
  position: number;
  completedAt?: string;
  completedBy?: string;
}

/** A compact child projection for the parent Task Detail drawer. */
export interface TaskSubtaskDTO {
  id: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  org: string;
  area: string;
  assignee?: string;
  startDate?: string;
  deadlineDate?: string;
}

/** A compact historical source kept after a merge archives the duplicate. */
export interface TaskMergedHistoryDTO {
  id: string;
  title: string;
}

export interface TaskRecurrenceDTO {
  id: string;
  frequency: "daily" | "weekly" | "monthly" | "months";
  interval: number;
  weekDays: number[];
  monthDay?: number;
  startDate: string;
  endDate?: string;
  nextOccurrenceDate?: string;
  active: boolean;
}

export interface SavedViewDTO {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  ownerId?: string;
}

export interface WorkflowTemplateTaskDTO {
  id: string;
  title: string;
  description?: string;
  leadDepartmentId?: string;
  area?: string;
  defaultAssigneeId?: string;
  defaultAssignee?: string;
  priority: TaskPriorityValue;
  startOffsetDays?: number;
  targetOffsetDays?: number;
  deadlineOffsetDays?: number;
  position: number;
  checklistItems: string[];
  dependencies: Array<{
    prerequisiteTemplateTaskId: string;
    type: DependencyTypeValue;
    label: string;
  }>;
}

export interface WorkflowTemplateDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  organization: string;
  name: string;
  description?: string;
  leadDepartmentId?: string;
  leadArea?: string;
  involvedDepartments: Array<{ id: string; name: string }>;
  tasks: WorkflowTemplateTaskDTO[];
  milestones: Array<{ id: string; title: string; targetOffsetDays?: number; ownerPrincipalId?: string; owner?: string; position: number }>;
  focusItems: Array<{ id: string; text: string; position: number }>;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

/** A personal, persisted preference about a nudge generated from live work. */
export interface NudgeStateDTO {
  dedupKey: string;
  disposition: "dismissed" | "snoozed";
  taskId?: string;
  snoozedUntil?: string;
}

export interface ReviewDTO {
  id: string;
  submittedById: string;
  submittedBy: string;
  submittedAt: string;
  reviewerId?: string;
  reviewer?: string;
  reviewedById?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decision?: "approved" | "revision_requested";
  revisionNote?: string;
}

export interface ProjectMemberDTO {
  principalId: string;
  name: string;
  type: "person" | "team";
  role: "owner" | "member" | "collaborator";
}

export interface ProjectMilestoneDTO {
  id: string;
  title: string;
  targetDate?: string;
  status: "planned" | "done";
  ownerPrincipalId?: string;
  owner?: string;
}

/** A client-safe canonical project. Progress and attention remain derived from tasks. */
export interface ProjectDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  organization: string;
  name: string;
  description?: string;
  leadDepartmentId?: string;
  leadArea?: string;
  involvedDepartments: Array<{ id: string; name: string }>;
  members: ProjectMemberDTO[];
  targetDate?: string;
  status: "active" | "completed" | "archived";
  milestones: ProjectMilestoneDTO[];
  focusItems: Array<{ id: string; text: string; position: number }>;
  resources: TaskResourceDTO[];
  createdAt: string;
  updatedAt: string;
}

/** A deliberately client-safe projection of one canonical database task. */
export interface TaskDTO {
  id: string;
  version: number;
  title: string;
  description?: string;
  workspaceId: string;
  organizationId?: string;
  org: string;
  leadDepartmentId?: string;
  area: string;
  involvedDepartments: Array<{ id: string; name: string }>;
  involvedAreas: string[];
  projectId?: string;
  project?: string;
  priority: TaskPriorityValue;
  status: TaskStatusValue;
  assignments: TaskAssignmentDTO[];
  /** Accountable Person for the whole deliverable; distinct from current work. */
  ownerPrincipalId?: string;
  /** True only for the migration's creator-derived Owner default. */
  ownerInferredFromCreator?: boolean;
  owner?: { id: string; name: string };
  /** The one Person or Team expected to make the next operational move. */
  currentResponsibility?: TaskAssignmentDTO;
  /** Omit for simple work; callers use the task title as its implicit step. */
  currentStep?: string;
  assigneeIds: string[];
  assignee?: string;
  /** Stable identity of the creator; this is not the Task Owner. */
  createdByPrincipalId?: string;
  nextActionKind: NextActionKindValue;
  nextActionBy: string;
  nextActionPrincipalId?: string;
  nextActionDepartmentId?: string;
  nextActionExternalLabel?: string;
  startDate?: string;
  targetDate?: string;
  deadlineDate?: string;
  followUpDate?: string;
  /** Optional planned effort for this task as a whole, stored in minutes. */
  estimatedMinutes?: number;
  /** Reserved for future opt-in time tracking; not used for workload yet. */
  actualMinutes?: number;
  waitingSince?: string;
  completedAt?: string;
  /** The person who marked the whole task Done, when completion is recorded. */
  completedBy?: { id: string; name: string };
  isOverdue: boolean;
  isFollowUpDue: boolean;
  canStartNow: boolean;
  completionBlockedBy: TaskDependencyDTO[];
  startBlockedBy: TaskDependencyDTO[];
  relatedWork: TaskDependencyDTO[];
  updates: TaskUpdateDTO[];
  resources: TaskResourceDTO[];
  activity: TaskActivityDTO[];
  checklistItems: TaskChecklistItemDTO[];
  subtasks: TaskSubtaskDTO[];
  subtaskProgress: { total: number; completed: number };
  parentTaskId?: string;
  parentTask?: { id: string; title: string };
  sourceTaskId?: string;
  mergedIntoTaskId?: string;
  /** Present only when this archived task was merged into accessible work. */
  mergedIntoTask?: { id: string; title: string };
  mergedHistory: TaskMergedHistoryDTO[];
  recurrence?: TaskRecurrenceDTO;
  review?: ReviewDTO;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  originalCapture?: string;
}

export interface WorkspaceSnapshotDTO {
  workspaceId: string;
  workspaceName: string;
  revision: number;
  actorId: string;
  profile: UserProfileDTO;
  tasks: TaskDTO[];
  projects: ProjectDTO[];
  directory: DirectoryDTO[];
  organizations: OrganizationDTO[];
  savedViews: SavedViewDTO[];
  workflowTemplates: WorkflowTemplateDTO[];
  nudgeStates: NudgeStateDTO[];
  inboxCaptures: InboxCaptureDTO[];
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; revision?: number }
  | { ok: false; code: "CONFIGURATION" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "DEPENDENCY"; message: string; latest?: TaskDTO };
