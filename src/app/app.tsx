"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type DragEvent, type ReactNode } from "react";
import {
  Home, CalendarDays, Inbox, Users, AlertTriangle,
  Building2, FolderKanban, Search, Sparkles, Paperclip,
  Link2, FileText, CheckCircle2, X, RotateCcw, MoreHorizontal,
  Settings, ExternalLink,
  ChevronRight, Plus, Globe, GitBranch, RefreshCw,
  ChevronDown, ChevronUp, Check, Calendar, Send,
  Hourglass, Eye, BarChart2, Layers, Timer,
  SlidersHorizontal, ArrowUpDown, Copy, ChevronLeft,
  MessageSquare, ListTodo, Target, UserCheck, Menu, ImagePlus, Download, Trash2, Pencil,
} from "lucide-react";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const WORKSPACE_TIME_ZONE = "Asia/Jakarta";

function getWorkspaceCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WORKSPACE_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function formatWorkspaceDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date);
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type OrgName = "Villa Khayangan" | "Apotik" | "Personal" | (string & {});
type AreaName = "System Development" | "Operations" | "Marketing" | "Finance" | "HR" | "Purchasing" | "Design" | "Front Office" | "F&B" | "Maintenance" | "Warehouse" | "Housekeeping" | (string & {});
type Priority = "urgent" | "high" | "medium" | "low";
type TaskStatus = "ready" | "in_progress" | "waiting" | "blocked" | "review" | "done";
type DependencyKind = "task" | "department" | "decision" | "external" | "other";
type DependencyType = "blocking" | "related";
type WorkspaceTheme = "soft" | "clear" | "dark";
type NavView =
  | "home" | "today" | "this-week" | "inbox" | "delegated"
  | "waiting" | "review" | "overdue" | "organizations" | "projects" | "search"
  | "all-tasks" | "people" | "person-detail" | "org-detail" | "project-detail" | "followup";

type ResourceType = "website" | "sheet" | "figma" | "github" | "drive" | "doc" | "dashboard" | "notion" | "other";
interface TaskLink { label: string; url: string; type: ResourceType; description?: string }
interface OrganizationResource extends TaskLink { area?: AreaName; project?: string; description?: string }
interface TaskFile { id?: string; name: string; type: "pdf" | "excel" | "screenshot" | "doc"; size?: string; url?: string }
interface Activity { type: "assigned" | "updated" | "submitted" | "commented" | "revision" | "approved"; actor: string; text: string; time: string }

interface Task {
  id: string; title: string; org: OrgName; area: AreaName; // area is the lead area
  involvedAreas?: AreaName[];
  project?: string; priority: Priority; status: TaskStatus;
  // assignee remains the primary display fallback for older work. assigneeIds is
  // the source of truth: a task can be shared by any number of people or teams.
  assignee?: string; assigneeIds?: string[]; nextActionBy: string;
  deadline?: string; deadlineDate?: string; startDate?: string; targetDate?: string; waitingSince?: string; responseDue?: string;
  lastUpdate?: string; isDelegated: boolean; isWaiting: boolean;
  isOverdue?: boolean; isToday?: boolean; estimatedHours?: number;
  carriedOver?: boolean; archived?: boolean; completedInCurrentMonth?: boolean; staleDays?: number;
  links?: TaskLink[]; files?: TaskFile[]; originalCapture?: string; description?: string; notes?: string; contributorIds?: string[]; activity?: Activity[];
  createdAt?: string; createdBy?: string; updatedAt?: string;
  blockedBy?: { kind: DependencyKind; type: DependencyType; label: string; taskId?: string; owner?: string };
  relatedTaskIds?: string[];
}

function getTaskAreas(task: Task) {
  return Array.from(new Set([task.area, ...(task.involvedAreas || [])].filter((area): area is AreaName => Boolean(area) && area !== "Unassigned")));
}

function taskInvolvesArea(task: Task, area?: AreaName | "all" | null) {
  return !area || area === "all" || getTaskAreas(task).includes(area);
}

function isSharedTask(task: Task) {
  return getTaskAreas(task).length > 1;
}

type DirectoryEntityType = "person" | "team";
type DirectoryAccountStatus = "no_account" | "invited" | "active_user" | "disabled";

interface OrganizationMembership {
  organization: OrgName;
  role?: string;
  area?: AreaName;
}

interface DirectoryPerson {
  id: string;
  name: string;
  type: DirectoryEntityType;
  memberships: OrganizationMembership[];
  active: boolean;
  accountStatus: DirectoryAccountStatus;
  email?: string;
  phone?: string;
  notes?: string;
}

interface PersonAccountability {
  active: number;
  ready: number;
  inProgress: number;
  waitingOnThem: number;
  waitingOnMe: number;
  blocked: number;
  overdue: number;
  review: number;
  lastUpdate: string;
  oldestUnanswered: string;
}

interface UserProfile {
  directoryId?: string;
  displayName: string;
  role: string;
  email: string;
  timezone: string;
  dateFormat: string;
}

// Capture is used in several places, but self-assignment must always resolve to
// the active profile rather than a demo name embedded in parsing rules.
const CurrentUserContext = createContext<string | undefined>(undefined);

interface FollowUpItem {
  title: string; taskId: string; daysWaiting: number;
  status: "overdue" | "due_today" | "due_soon" | "no_update"; note: string;
}

interface FollowUpPerson {
  person: string; section: "today" | "overdue" | "later";
  items: FollowUpItem[]; suggestedMessage: string;
}

interface ProjectDetail {
  id: string; name: string; org: OrgName; area: AreaName;
  progress: number; deadline: string; status: "on_track" | "at_risk" | "behind";
  tasks: number; done: number; currentFocus: string[];
  resources: TaskLink[]; files?: TaskFile[]; recentActivity: Activity[];
}

interface Milestone {
  id: string; name: string; date: string; project: string; owner: string;
  status: "planned" | "at_risk" | "done"; description?: string;
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const SEED_TASKS: Task[] = [
  {
    id: "t1", title: "Review website accommodation prices",
    org: "Villa Khayangan", area: "Marketing", project: "Villa Website Revamp",
    priority: "high", status: "waiting", assignee: "Bu Desti", nextActionBy: "Bu Desti",
    deadline: "Wed, 14 Aug", waitingSince: "Mon, 11 Aug", responseDue: "Wed, 14 Aug",
    lastUpdate: "3 days ago", isDelegated: true, isWaiting: true, estimatedHours: 2,
    links: [{ label: "Website", url: "https://example.com", type: "website" }],
    originalCapture: "ask Bu Desti to check website prices by Wednesday https://example.com",
    activity: [
      { type: "assigned", actor: "You", text: "Assigned to Bu Desti", time: "3 days ago" },
      { type: "commented", actor: "Bu Desti", text: "Will check and update by Wednesday", time: "2 days ago" },
    ]
  },
  {
    id: "t2", title: "Fix purchasing settlement receipt flow",
    org: "Villa Khayangan", area: "System Development", project: "Finance Automation",
    priority: "high", status: "in_progress", nextActionBy: "me",
    deadline: "Tomorrow", isDelegated: false, isWaiting: false, isToday: true, estimatedHours: 4,
    links: [{ label: "Dev Branch", url: "#", type: "github" }, { label: "Finance Sheet", url: "#", type: "sheet" }],
    originalCapture: "fix purchasing receipt flow because finance needs to calculate money return",
    activity: [{ type: "assigned", actor: "You", text: "Created task", time: "Yesterday" }]
  },
  {
    id: "t3", title: "Check expired medicine inventory",
    org: "Apotik", area: "Operations", priority: "urgent", status: "ready",
    nextActionBy: "me", deadline: "Today", isDelegated: false, isWaiting: false, isToday: true, estimatedHours: 1,
    originalCapture: "tomorrow check apotik expired medicine issue",
    activity: [{ type: "assigned", actor: "You", text: "Created task", time: "Yesterday" }]
  },
  {
    id: "t4", title: "Update restaurant SOP documentation",
    org: "Villa Khayangan", area: "Operations", project: "Ops Manual 2024",
    priority: "medium", status: "waiting", assignee: "Bu Desti", nextActionBy: "Bu Desti",
    deadline: "Fri, 16 Aug", waitingSince: "Sat, 9 Aug", lastUpdate: "5 days ago",
    isDelegated: true, isWaiting: true, carriedOver: true, staleDays: 35,
    files: [{ name: "SOP_Draft_v2.docx", type: "doc" }],
    activity: [{ type: "assigned", actor: "You", text: "Assigned to Bu Desti", time: "5 days ago" }]
  },
  {
    id: "t5", title: "Reconcile August petty cash",
    org: "Apotik", area: "Finance", priority: "urgent", status: "ready",
    nextActionBy: "me", deadline: "Yesterday", isDelegated: false, isWaiting: false, isOverdue: true, estimatedHours: 2,
    files: [{ name: "Cash_July.xlsx", type: "excel" }],
    activity: [{ type: "assigned", actor: "You", text: "Created task", time: "3 days ago" }]
  },
  {
    id: "t6", title: "Prepare supplier quotation comparison",
    org: "Villa Khayangan", area: "Finance", priority: "high", status: "waiting",
    assignee: "Purchasing Manager", nextActionBy: "Purchasing Manager",
    deadline: "Thu, 15 Aug", waitingSince: "Mon, 11 Aug", responseDue: "Thu, 15 Aug",
    lastUpdate: "2 days ago", isDelegated: true, isWaiting: true,
    files: [{ name: "Quotation_Template.xlsx", type: "excel" }],
    activity: [{ type: "assigned", actor: "You", text: "Assigned to Purchasing Manager", time: "2 days ago" }]
  },
  {
    id: "t7", title: "Review new hire onboarding checklist",
    org: "Villa Khayangan", area: "HR", priority: "medium", status: "review",
    assignee: "HR Manager", nextActionBy: "me", deadline: "Fri, 16 Aug", isDelegated: true, isWaiting: false,
    files: [{ name: "Onboarding_Checklist.pdf", type: "pdf" }],
    activity: [
      { type: "assigned", actor: "You", text: "Assigned to HR Manager", time: "4 days ago" },
      { type: "submitted", actor: "HR Manager", text: "Submitted for review", time: "1 day ago" },
    ]
  },
  {
    id: "t8", title: "Update Figma mockup for mobile booking flow",
    org: "Villa Khayangan", area: "System Development", project: "Villa Website Revamp",
    priority: "medium", status: "review", assignee: "Design Team", nextActionBy: "me",
    deadline: "Wed, 14 Aug", isDelegated: true, isWaiting: false,
    links: [{ label: "Figma File", url: "#", type: "figma" }],
    activity: [
      { type: "assigned", actor: "You", text: "Assigned to Design Team", time: "3 days ago" },
      { type: "submitted", actor: "Design Team", text: "Mockups ready for review", time: "Today" },
    ]
  },
  {
    id: "t9", title: "Follow up with bank on credit facility renewal",
    org: "Personal", area: "Finance", priority: "high", status: "waiting",
    nextActionBy: "Bank Officer", deadline: "Fri, 16 Aug", waitingSince: "Wed, 7 Aug", lastUpdate: "4 days ago",
    isDelegated: false, isWaiting: true, carriedOver: true, staleDays: 41,
    activity: [{ type: "assigned", actor: "You", text: "Called bank, waiting for callback", time: "4 days ago" }]
  },
  {
    id: "t10", title: "Review Q3 marketing budget proposal",
    org: "Villa Khayangan", area: "Marketing", priority: "high", status: "ready",
    nextActionBy: "me", deadline: "Today", isDelegated: false, isWaiting: false, isToday: true, estimatedHours: 1.5,
    files: [{ name: "Marketing_Budget_Q3.xlsx", type: "excel" }],
    activity: [{ type: "assigned", actor: "Marketing Team", text: "Sent for owner approval", time: "Yesterday" }]
  },
  {
    id: "t11", title: "Update staff schedule for Lebaran holiday",
    org: "Villa Khayangan", area: "HR", priority: "medium", status: "ready",
    nextActionBy: "me", deadline: "Thu, 15 Aug", isDelegated: false, isWaiting: false, estimatedHours: 1,
    activity: [{ type: "assigned", actor: "You", text: "Created task", time: "Today" }]
  },
  {
    id: "t12", title: "Negotiate new supplier contract terms",
    org: "Apotik", area: "Operations", priority: "medium", status: "waiting",
    assignee: "Purchasing Manager", nextActionBy: "Purchasing Manager",
    deadline: "Mon, 18 Aug", waitingSince: "Fri, 8 Aug", lastUpdate: "2 days ago",
    isDelegated: true, isWaiting: true,
    activity: [{ type: "assigned", actor: "You", text: "Assigned to Purchasing Manager", time: "2 days ago" }]
  },
  {
    id: "t13", title: "Finalize annual revenue report",
    org: "Villa Khayangan", area: "Finance", project: "Finance Automation",
    priority: "high", status: "done", nextActionBy: "me",
    isDelegated: false, isWaiting: false, completedInCurrentMonth: true,
    activity: [{ type: "approved", actor: "You", text: "Marked as complete", time: "Last week" }]
  },
  {
    id: "t14", title: "Train front desk staff on new booking system",
    org: "Villa Khayangan", area: "HR", priority: "medium", status: "ready",
    assignee: "Bu Desti", nextActionBy: "Bu Desti",
    deadline: "Mon, 19 Aug", isDelegated: true, isWaiting: false,
    activity: [{ type: "assigned", actor: "You", text: "Assigned to Bu Desti", time: "Today" }]
  },
  {
    id: "t15", title: "Confirm accommodation pricing",
    org: "Villa Khayangan", area: "Finance", project: "Villa Website Revamp",
    priority: "urgent", status: "ready", assignee: "Finance Team", nextActionBy: "Finance",
    startDate: "2026-08-12", targetDate: "2026-08-19", deadline: "Tue, 19 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 3,
    activity: [{ type: "assigned", actor: "Marketing Team", text: "Requested final pricing confirmation", time: "Today" }],
  },
  {
    id: "t16", title: "Prepare campaign concept",
    org: "Villa Khayangan", area: "Marketing", project: "Villa Website Revamp",
    priority: "high", status: "ready", assignee: "Marketing Team", nextActionBy: "Marketing",
    startDate: "2026-08-12", targetDate: "2026-08-20", deadline: "Wed, 20 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 6,
    activity: [{ type: "assigned", actor: "You", text: "Prepared for parallel campaign work", time: "Today" }],
  },
  {
    id: "t17", title: "Draft website copy",
    org: "Villa Khayangan", area: "Marketing", project: "Villa Website Revamp",
    priority: "medium", status: "in_progress", assignee: "Marketing Team", nextActionBy: "Marketing",
    startDate: "2026-08-13", targetDate: "2026-08-22", deadline: "Fri, 22 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 5,
    activity: [{ type: "updated", actor: "Marketing Team", text: "First draft is in progress", time: "Today" }],
  },
  {
    id: "t18", title: "Brief Front Office on updated offers",
    org: "Villa Khayangan", area: "Operations", project: "Villa Website Revamp",
    priority: "medium", status: "ready", assignee: "Operations Team", nextActionBy: "Operations",
    startDate: "2026-08-18", targetDate: "2026-08-26", deadline: "Tue, 26 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 2, relatedTaskIds: ["t15"],
    activity: [{ type: "assigned", actor: "You", text: "Can be prepared alongside the pricing review", time: "Today" }],
  },
  {
    id: "t19", title: "Publish final accommodation prices",
    org: "Villa Khayangan", area: "System Development", project: "Villa Website Revamp",
    priority: "high", status: "blocked", assignee: "Development Team", nextActionBy: "Finance",
    startDate: "2026-08-19", targetDate: "2026-08-23", deadline: "Sat, 23 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 3,
    blockedBy: { kind: "task", type: "blocking", label: "Confirm accommodation pricing", taskId: "t15", owner: "Finance" },
    activity: [{ type: "updated", actor: "Development Team", text: "Ready to publish once Finance confirms pricing", time: "Today" }],
  },
  {
    id: "t20", title: "Finalize website banner",
    org: "Villa Khayangan", area: "Marketing", project: "Villa Website Revamp",
    priority: "medium", status: "blocked", assignee: "Design Team", nextActionBy: "Finance",
    startDate: "2026-08-19", targetDate: "2026-08-25", deadline: "Mon, 25 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 4,
    blockedBy: { kind: "task", type: "blocking", label: "Confirm accommodation pricing", taskId: "t15", owner: "Finance" },
    activity: [{ type: "assigned", actor: "Marketing Team", text: "Banner content waits for approved pricing", time: "Today" }],
  },
  {
    id: "t21", title: "Finalize the August budget",
    org: "Villa Khayangan", area: "Finance", involvedAreas: ["Marketing", "Finance", "Purchasing"],
    priority: "medium", status: "ready", assignee: "Finance Team", assigneeIds: ["team-finance", "team-marketing", "team-purchasing"], nextActionBy: "Finance Team",
    startDate: "2026-08-13", targetDate: "2026-08-16", deadline: "Sat, 16 Aug",
    isDelegated: true, isWaiting: false, estimatedHours: 4,
    description: "Coordinate the August budget with Marketing, Finance, and Purchasing.",
    notes: "Shared work: Finance leads, with Marketing and Purchasing participating.",
    originalCapture: "finalize budget bersama marketing, finance dan purchasing; deadline agustus 16",
    activity: [{ type: "assigned", actor: "Binnie", text: "Created one shared task for Finance, Marketing, and Purchasing", time: "Today" }],
  },
];

const SEED_ARCHIVED_TASKS: Task[] = [
  {
    id: "archive-1", title: "Compare accommodation supplier terms",
    org: "Villa Khayangan", area: "Operations", project: "Ops Manual 2024", priority: "medium", status: "done", nextActionBy: "me",
    deadline: "Jul 2026", isDelegated: false, isWaiting: false, archived: true,
    activity: [{ type: "approved", actor: "You", text: "Completed in July", time: "Last month" }],
  },
  {
    id: "archive-2", title: "Refresh pharmacy inventory labels",
    org: "Apotik", area: "Operations", priority: "low", status: "done", nextActionBy: "me",
    deadline: "Jun 2026", isDelegated: false, isWaiting: false, archived: true,
    activity: [{ type: "approved", actor: "You", text: "Completed in June", time: "2 months ago" }],
  },
];

// ─── CANONICAL TASK STORE ────────────────────────────────────────────────────
// Every screen reads this collection. The local persistence is deliberately
// isolated here so a future API/database can replace it without changing views.
const BINNIE_TASK_STORE_STORAGE_KEY = "binnie-task-store-v1";
const DEFAULT_CURRENT_USER_ID = "person-charlotte";
type TaskDraft = Omit<Task, "id"> & { id?: string };

let TASKS: Task[] = SEED_TASKS.map(task => ({ ...task }));
let ARCHIVED_TASKS: Task[] = SEED_ARCHIVED_TASKS.map(task => ({ ...task }));
let taskStoreVersion = 0;
let taskStoreHydrated = false;
const taskStoreListeners = new Set<() => void>();

function taskStoreSnapshot() {
  return taskStoreVersion;
}

function subscribeToTaskStore(listener: () => void) {
  taskStoreListeners.add(listener);
  return () => taskStoreListeners.delete(listener);
}

function persistTaskStore() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BINNIE_TASK_STORE_STORAGE_KEY, JSON.stringify({ tasks: TASKS, archivedTasks: ARCHIVED_TASKS }));
  } catch {
    // Persistence is an enhancement in the local prototype; in-memory work is
    // still valid if browser storage is unavailable.
  }
}

function publishTaskStore() {
  taskStoreVersion += 1;
  persistTaskStore();
  taskStoreListeners.forEach(listener => listener());
}

function initializeTaskStore() {
  if (taskStoreHydrated || typeof window === "undefined") return;
  taskStoreHydrated = true;
  try {
    const stored = JSON.parse(window.localStorage.getItem(BINNIE_TASK_STORE_STORAGE_KEY) || "null") as { tasks?: Task[]; archivedTasks?: Task[] } | null;
    if (stored?.tasks && Array.isArray(stored.tasks)) {
      TASKS = stored.tasks;
      ARCHIVED_TASKS = Array.isArray(stored.archivedTasks) ? stored.archivedTasks : [];
    }
  } catch {
    // A damaged local record should never prevent Binnie from opening with its
    // safe demo seed.
  }
  publishTaskStore();
}

function useTaskStoreVersion() {
  return useSyncExternalStore(subscribeToTaskStore, taskStoreSnapshot, () => 0);
}

function nextTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTask(input: TaskDraft) {
  const timestamp = new Date().toISOString();
  const task: Task = {
    ...input,
    id: input.id || nextTaskId(),
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
    createdBy: input.createdBy || DEFAULT_CURRENT_USER_ID,
  };
  TASKS = [...TASKS, task];
  publishTaskStore();
  return task;
}

function updateTask(taskId: string, patch: Partial<Task>) {
  let updated: Task | undefined;
  TASKS = TASKS.map(task => {
    if (task.id !== taskId) return task;
    updated = { ...task, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  if (updated) publishTaskStore();
  return updated;
}

function commitTaskStore() {
  // Compatibility bridge for an existing interaction that still mutates a task
  // object in place. It converts the collection reference and broadcasts it.
  TASKS = [...TASKS];
  ARCHIVED_TASKS = [...ARCHIVED_TASKS];
  publishTaskStore();
}

function deleteTask(taskId: string) {
  const before = TASKS.length;
  TASKS = TASKS.filter(task => task.id !== taskId);
  ARCHIVED_TASKS = ARCHIVED_TASKS.filter(task => task.id !== taskId);
  if (TASKS.length !== before) publishTaskStore();
}

function archiveCanonicalTask(taskId: string) {
  const task = TASKS.find(item => item.id === taskId);
  if (!task) return;
  TASKS = TASKS.filter(item => item.id !== taskId);
  ARCHIVED_TASKS = [...ARCHIVED_TASKS, { ...task, archived: true, status: "done", isWaiting: false, updatedAt: new Date().toISOString(), lastUpdate: "Archived just now" }];
  publishTaskStore();
}

const STRATEGIC_PROJECTS = [
  { id: "p1", name: "Villa Website Revamp", org: "Villa Khayangan" as OrgName, progress: 65, tasks: 12, done: 8, deadline: "Sep 2024", status: "on_track" as const },
  { id: "p2", name: "Apotik Management System", org: "Apotik" as OrgName, progress: 30, tasks: 18, done: 5, deadline: "Dec 2024", status: "at_risk" as const },
  { id: "p3", name: "Finance Automation", org: "Villa Khayangan" as OrgName, progress: 80, tasks: 10, done: 8, deadline: "Aug 2024", status: "on_track" as const },
];

// A person or team is created once in Binnie. Membership stores the role and
// area for each organization, allowing one person to contribute in more than one place.
const PEOPLE_DIRECTORY: DirectoryPerson[] = [
  { id: "person-charlotte", name: "Charlotte", type: "person", active: true, accountStatus: "active_user", memberships: [{ organization: "Villa Khayangan", role: "Owner", area: "Operations" }] },
  { id: "person-bu-desti", name: "Bu Desti", type: "person", active: true, accountStatus: "no_account", email: "desti@villakhayangan.com", phone: "+62 812 5555 0182", notes: "Leads day-to-day operations and supports pricing reviews.", memberships: [{ organization: "Villa Khayangan", role: "Manager", area: "Operations" }, { organization: "Apotik", role: "Advisor", area: "Operations" }] },
  { id: "person-purchasing-manager", name: "Purchasing Manager", type: "person", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Procurement Manager", area: "Purchasing" }, { organization: "Apotik", role: "Procurement", area: "Operations" }] },
  { id: "person-hr-manager", name: "HR Manager", type: "person", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "HR Manager", area: "HR" }] },
  { id: "team-marketing", name: "Marketing Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Marketing", area: "Marketing" }] },
  { id: "team-design", name: "Design Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Design", area: "Design" }] },
  { id: "team-finance", name: "Finance Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Finance", area: "Finance" }] },
  { id: "team-purchasing", name: "Purchasing Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Purchasing", area: "Purchasing" }] },
  { id: "team-hr", name: "HR Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "HR", area: "HR" }] },
  { id: "team-operations", name: "Operations Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Operations", area: "Operations" }, { organization: "Apotik", role: "Operations", area: "Operations" }] },
  { id: "team-development", name: "Development Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "System Development", area: "System Development" }] },
  { id: "team-maintenance", name: "Maintenance Team", type: "team", active: true, accountStatus: "no_account", memberships: [{ organization: "Villa Khayangan", role: "Maintenance", area: "Maintenance" }] },
];

function getDirectoryPerson(nameOrId: string) {
  return PEOPLE_DIRECTORY.find(person => person.name === nameOrId || person.id === nameOrId);
}

function getDirectoryPeople(ids?: string[]) {
  return (ids || []).map(id => PEOPLE_DIRECTORY.find(person => person.id === id)).filter((person): person is DirectoryPerson => Boolean(person));
}

function directoryNames(ids?: string[]) {
  return getDirectoryPeople(ids).map(person => person.name);
}

function getTaskAssigneeIds(task: Task) {
  if (task.assigneeIds?.length) return Array.from(new Set(task.assigneeIds));
  const legacy = task.assignee ? getDirectoryPerson(task.assignee)?.id : undefined;
  return legacy ? [legacy] : [];
}

function getTaskAssignees(task: Task) {
  return getDirectoryPeople(getTaskAssigneeIds(task));
}

function taskAssigneeNames(task: Task) {
  const names = getTaskAssignees(task).map(person => person.name);
  return names.length ? names : task.assignee ? [task.assignee] : [];
}

function taskHasAssignee(task: Task, person: DirectoryPerson | string) {
  const entity = typeof person === "string" ? getDirectoryPerson(person) : person;
  return entity ? getTaskAssigneeIds(task).includes(entity.id) : task.assignee === person;
}

function setTaskAssignees(task: Task, assigneeIds: string[], actor = "You") {
  const ids = Array.from(new Set(assigneeIds.filter(id => PEOPLE_DIRECTORY.some(person => person.id === id))));
  const names = directoryNames(ids);
  const previousPrimary = task.assignee;
  const nextActionBy = task.nextActionBy === previousPrimary ? names[0] || "Unassigned" : task.nextActionBy;
  Object.assign(task, {
    assigneeIds: ids,
    assignee: names[0],
    isDelegated: names.length > 0,
    nextActionBy,
    lastUpdate: "Assignees updated just now",
    activity: [...(task.activity || []), { type: "assigned" as const, actor, text: names.length ? `Assigned to ${names.join(" · ")}` : "Cleared task assignees", time: "Just now" }],
  });
  commitTaskStore();
}

// ─── SHARED TASK SELECTORS ───────────────────────────────────────────────────
// Views use these selectors instead of retaining their own copies of work.
function isActiveTask(task: Task) {
  return task.status !== "done" && !task.archived;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTaskRelevantDate(task: Task) {
  if (task.startDate) return task.startDate;
  if (task.targetDate) return task.targetDate;
  if (task.deadlineDate) return task.deadlineDate;
  const today = getWorkspaceCalendarDate();
  if (task.isToday || task.deadline === "Today") return isoDate(today);
  if (task.deadline === "Tomorrow") { const tomorrow = new Date(today); tomorrow.setUTCDate(today.getUTCDate() + 1); return isoDate(tomorrow); }
  if (task.deadline === "Yesterday") { const yesterday = new Date(today); yesterday.setUTCDate(today.getUTCDate() - 1); return isoDate(yesterday); }
  return undefined;
}

function isTaskOverdue(task: Task) {
  const relevant = getTaskRelevantDate(task);
  return Boolean(task.isOverdue || (relevant && relevant < isoDate(getWorkspaceCalendarDate()) && isActiveTask(task)));
}

function currentDirectoryName(currentUserId = DEFAULT_CURRENT_USER_ID) {
  return PEOPLE_DIRECTORY.find(person => person.id === currentUserId)?.name || "";
}

function taskIsForCurrentUser(task: Task, currentUserId = DEFAULT_CURRENT_USER_ID) {
  return getTaskAssigneeIds(task).includes(currentUserId) || task.nextActionBy === "me" || task.nextActionBy === currentDirectoryName(currentUserId);
}

function getTasksForToday(tasks = TASKS, currentUserId = DEFAULT_CURRENT_USER_ID) {
  const today = isoDate(getWorkspaceCalendarDate());
  return tasks.filter(task => isActiveTask(task) && getTaskRelevantDate(task) === today && taskIsForCurrentUser(task, currentUserId));
}

function getTasksForWeek(tasks = TASKS, weekStart?: Date) {
  const today = getWorkspaceCalendarDate();
  const monday = weekStart ? new Date(weekStart) : new Date(today);
  if (!weekStart) monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const start = isoDate(monday);
  const end = new Date(monday); end.setUTCDate(end.getUTCDate() + 6);
  return tasks.filter(task => {
    const relevant = getTaskRelevantDate(task);
    return Boolean(isActiveTask(task) && relevant && relevant >= start && relevant <= isoDate(end));
  });
}

function getTasksForMonth(tasks = TASKS, date = getWorkspaceCalendarDate()) {
  const prefix = isoDate(date).slice(0, 7);
  return tasks.filter(task => isActiveTask(task) && getTaskRelevantDate(task)?.startsWith(prefix));
}

function getDelegatedTasks(tasks = TASKS, currentUserId = DEFAULT_CURRENT_USER_ID) {
  return tasks.filter(task => {
    if (!isActiveTask(task)) return false;
    const delegatedToSomeoneElse = getTaskAssigneeIds(task).some(id => id !== currentUserId);
    return task.createdBy ? task.createdBy === currentUserId && delegatedToSomeoneElse : task.isDelegated && delegatedToSomeoneElse;
  });
}

function getWaitingTasks(tasks = TASKS) {
  return tasks.filter(task => isActiveTask(task) && task.status === "waiting");
}

function getTasksForOrganization(organization: OrgName, tasks = TASKS) {
  return tasks.filter(task => task.org === organization && !task.archived);
}

function getTasksForArea(area: AreaName, organization?: OrgName, tasks = TASKS) {
  return tasks.filter(task => !task.archived && (!organization || task.org === organization) && taskInvolvesArea(task, area));
}

function getTasksForProject(project: string, tasks = TASKS) {
  return tasks.filter(task => task.project === project && !task.archived);
}

function getTasksForAssignee(assigneeId: string, tasks = TASKS) {
  return tasks.filter(task => !task.archived && getTaskAssigneeIds(task).includes(assigneeId));
}

function getPersonMembership(person: DirectoryPerson, organization?: OrgName) {
  return organization ? person.memberships.find(membership => membership.organization === organization) : person.memberships[0];
}

function getPersonAccountability(name: string): PersonAccountability {
  const entity = getDirectoryPerson(name);
  const involved = TASKS.filter(task => taskHasAssignee(task, entity || name) || task.nextActionBy === name || Boolean(entity && task.contributorIds?.includes(entity.id)));
  const waitingOnThem = involved.filter(task => task.status !== "done" && task.nextActionBy === name && (task.status === "waiting" || task.isWaiting || task.status === "blocked")).length;
  const waitingOnMe = involved.filter(task => task.status !== "done" && task.nextActionBy === "me").length;
  const updates = involved.flatMap(task => task.activity || []);
  return {
    active: involved.filter(task => task.status !== "done").length,
    ready: involved.filter(task => task.status === "ready" && !task.blockedBy).length,
    inProgress: involved.filter(task => task.status === "in_progress").length,
    waitingOnThem,
    waitingOnMe,
    blocked: involved.filter(task => task.status === "blocked").length,
    overdue: involved.filter(task => task.isOverdue).length,
    review: involved.filter(task => task.status === "review").length,
    lastUpdate: updates[0]?.time || "No updates yet",
    oldestUnanswered: waitingOnThem ? `${Math.max(...involved.filter(task => task.nextActionBy === name).map(task => Number.parseInt(task.waitingSince || "0", 10) || 1))} days` : "—",
  };
}

function getDirectoryAssignees(organization?: OrgName) {
  return PEOPLE_DIRECTORY.filter(person => person.active && (!organization || person.memberships.some(membership => membership.organization === organization)));
}

function resolveDirectoryAssignee(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  const exact = PEOPLE_DIRECTORY.find(person => person.name.toLowerCase() === normalized);
  const partial = PEOPLE_DIRECTORY.find(person => normalized.includes(person.name.toLowerCase()) || person.name.toLowerCase().includes(normalized));
  return (exact || partial)?.name || value?.trim();
}

function replaceDirectoryPerson(id: string, update: (person: DirectoryPerson) => DirectoryPerson) {
  const index = PEOPLE_DIRECTORY.findIndex(person => person.id === id);
  if (index < 0) return undefined;
  const current = PEOPLE_DIRECTORY[index];
  const next = update({ ...current, memberships: current.memberships.map(membership => ({ ...membership })) });
  PEOPLE_DIRECTORY[index] = next;
  return next;
}

const FOLLOWUP_DATA: FollowUpPerson[] = [
  {
    person: "Bu Desti", section: "today",
    items: [
      { title: "Review website accommodation prices", taskId: "t1", daysWaiting: 4, status: "overdue", note: "No update for 4 days" },
      { title: "Restaurant SOP documentation", taskId: "t4", daysWaiting: 2, status: "due_today", note: "Update expected today" },
      { title: "August promotion pricing", taskId: "new1", daysWaiting: 1, status: "due_today", note: "Response due today" },
    ],
    suggestedMessage: "Bu Desti, mau follow up untuk beberapa hal ya Bu:\n\n1. Review website accommodation prices — sudah 4 hari belum ada update\n2. Restaurant SOP update — targetnya hari ini\n3. August promotion pricing — response seharusnya hari ini\n\nMohon dibantu update perkembangannya ya Bu. Terima kasih 🙏",
  },
  {
    person: "Purchasing Manager", section: "today",
    items: [
      { title: "Supplier quotation comparison", taskId: "t6", daysWaiting: 2, status: "due_soon", note: "Due Thursday" },
      { title: "Negotiate supplier contract terms", taskId: "t12", daysWaiting: 3, status: "no_update", note: "No update since Monday" },
    ],
    suggestedMessage: "Pak, mau follow up untuk 2 hal ya Pak:\n\n1. Quotation comparison supplier — due hari Kamis\n2. Negosiasi kontrak supplier — belum ada update sejak Senin\n\nMohon dibantu ya Pak. Terima kasih 🙏",
  },
  {
    person: "Marketing Team", section: "later",
    items: [
      { title: "Q3 campaign calendar", taskId: "new2", daysWaiting: 6, status: "no_update", note: "6 days without update" },
    ],
    suggestedMessage: "Tim Marketing, mau tanya update untuk Q3 campaign calendar ya. Sudah 6 hari belum ada kabar. Terima kasih 🙏",
  },
];

const ORG_RESOURCES: Record<string, OrganizationResource[]> = {
  "Villa Khayangan": [
    { label: "Google Drive", url: "https://drive.google.com/", type: "drive" },
    { label: "Main Website", url: "https://example.com/", type: "website", area: "Marketing" },
    { label: "Finance Dashboard", url: "", type: "dashboard", area: "Finance" },
    { label: "Design System", url: "", type: "figma", project: "Villa Website Revamp" },
  ],
  "Apotik": [
    { label: "Inventory Sheet", url: "https://docs.google.com/spreadsheets/", type: "sheet" },
    { label: "Operations Drive", url: "https://drive.google.com/", type: "drive" },
  ],
  "Personal": [
    { label: "Personal Drive", url: "https://drive.google.com/", type: "drive" },
    { label: "Budget Tracker", url: "https://docs.google.com/spreadsheets/", type: "sheet" },
  ],
};

const PROJECT_DETAILS: Record<string, ProjectDetail> = {
  "p1": {
    id: "p1", name: "Villa Website Revamp", org: "Villa Khayangan", area: "System Development",
    progress: 65, deadline: "Sep 2024", status: "on_track", tasks: 12, done: 8,
    currentFocus: ["Mobile booking flow redesign", "Payment gateway integration", "Accommodation pricing section"],
    resources: [
      { label: "Website Revamp Figma", url: "https://www.figma.com/", type: "figma" },
      { label: "Accommodation Pricing Sheet", url: "https://docs.google.com/spreadsheets/", type: "sheet" },
      { label: "Main Website", url: "https://villakhayangan.com/", type: "website" },
    ],
    files: [
      { id: "p1-requirements", name: "Website Requirements.pdf", type: "pdf", size: "2.4 MB", url: "data:text/plain;charset=utf-8,Website%20Requirements" },
      { id: "p1-pricing", name: "Pricing Draft.xlsx", type: "excel", size: "840 KB", url: "data:text/plain;charset=utf-8,Pricing%20Draft" },
    ],
    recentActivity: [
      { type: "submitted", actor: "Design Team", text: "Submitted mobile booking mockups for review", time: "Today" },
      { type: "commented", actor: "You", text: "Left comments on payment flow design", time: "Yesterday" },
      { type: "updated", actor: "Bu Desti", text: "Checked accommodation pricing section", time: "3 days ago" },
    ],
  },
  "p2": {
    id: "p2", name: "Apotik Management System", org: "Apotik", area: "System Development",
    progress: 30, deadline: "Dec 2024", status: "at_risk", tasks: 18, done: 5,
    currentFocus: ["Inventory management module", "Prescription tracking", "Supplier data integration"],
    resources: [
      { label: "GitHub Repo", url: "#", type: "github" },
      { label: "Requirements", url: "#", type: "drive" },
      { label: "Design File", url: "#", type: "figma" },
    ],
    recentActivity: [
      { type: "updated", actor: "You", text: "Reviewed system architecture document", time: "2 days ago" },
      { type: "assigned", actor: "You", text: "Assigned inventory module to dev team", time: "4 days ago" },
    ],
  },
  "p3": {
    id: "p3", name: "Finance Automation", org: "Villa Khayangan", area: "Finance",
    progress: 80, deadline: "Aug 2024", status: "on_track", tasks: 10, done: 8,
    currentFocus: ["Purchasing receipt flow fix", "Monthly auto-reconciliation"],
    resources: [
      { label: "Finance Sheet", url: "#", type: "sheet" },
      { label: "GitHub Repo", url: "#", type: "github" },
      { label: "Documentation", url: "#", type: "drive" },
    ],
    recentActivity: [
      { type: "updated", actor: "You", text: "Working on purchasing receipt flow fix", time: "Today" },
      { type: "approved", actor: "You", text: "Approved automated reconciliation v1", time: "3 days ago" },
    ],
  },
};

const MILESTONES: Milestone[] = [
  { id: "m1", name: "Pricing Approved", date: "2026-08-19", project: "Villa Website Revamp", owner: "Finance", status: "planned" },
  { id: "m2", name: "Website Ready", date: "2026-08-26", project: "Villa Website Revamp", owner: "System Development", status: "planned" },
  { id: "m3", name: "Campaign Launch", date: "2026-09-02", project: "Villa Website Revamp", owner: "Marketing", status: "planned" },
  { id: "m4", name: "Reconciliation Live", date: "2026-08-22", project: "Finance Automation", owner: "Finance", status: "planned" },
  { id: "m5", name: "Inventory Pilot", date: "2026-09-09", project: "Apotik Management System", owner: "Operations", status: "at_risk" },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────

const ORG_COLORS: Record<string, { bg: string; text: string; dot: string; border: string; card: string }> = {
  "Villa Khayangan": { bg: "bg-[var(--org-villa-bg)]", text: "text-[var(--org-villa-text)]", dot: "bg-[var(--org-villa-dot)]", border: "border-[var(--org-villa-border)]", card: "bg-[var(--org-villa-card)]" },
  "Apotik": { bg: "bg-[var(--org-apotik-bg)]", text: "text-[var(--org-apotik-text)]", dot: "bg-[var(--org-apotik-dot)]", border: "border-[var(--org-apotik-border)]", card: "bg-[var(--org-apotik-card)]" },
  "Personal": { bg: "bg-[var(--org-personal-bg)]", text: "text-[var(--org-personal-text)]", dot: "bg-[var(--org-personal-dot)]", border: "border-[var(--org-personal-border)]", card: "bg-[var(--org-personal-card)]" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  urgent: { label: "Needs attention", color: "text-overdue", bg: "bg-overdue/10", dot: "bg-overdue" },
  high: { label: "Important", color: "text-[#a87955]", bg: "bg-[#fff1e7]", dot: "bg-[#dfa17c]" },
  medium: { label: "Planned", color: "text-warning", bg: "bg-[#fff9e4]", dot: "bg-[#e2c66d]" },
  low: { label: "When there’s room", color: "text-muted-foreground", bg: "bg-muted", dot: "bg-[#a8afbd]" },
};

const AREA_COLORS: Record<string, string> = {
  "System Development": "text-[var(--area-system)]",
  "Operations": "text-[var(--area-operations)]",
  "Marketing": "text-[var(--area-marketing)]",
  "Finance": "text-[var(--area-finance)]",
  "HR": "text-[var(--area-hr)]",
};

const PERSON_COLORS: Record<string, string> = {
  "Bu Desti": "var(--person-slate)",
  "Purchasing Manager": "var(--person-sage)",
  "HR Manager": "var(--person-clay)",
  "Design Team": "var(--person-rose)",
  "Bank Officer": "var(--person-blue)",
  "Marketing Team": "var(--person-violet)",
  "You": "var(--person-stone)",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getPersonColor(name: string) {
  return PERSON_COLORS[name] || "var(--person-slate)";
}

function personColorStyle(color: string, borderWidth = 1) {
  return {
    backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
    color,
    border: `${borderWidth}px solid color-mix(in srgb, ${color} 27%, transparent)`,
  };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function OrgBadge({ org }: { org: OrgName }) {
  const c = ORG_COLORS[org] || ORG_COLORS.Personal;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium tracking-[0.01em]", c.bg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {org}
    </span>
  );
}

function AreaBadge({ area }: { area: AreaName }) {
  return <span className={cn("text-[11px] font-medium", AREA_COLORS[area] || "text-muted-foreground")}>{area}</span>;
}

function PriorityDot({ priority }: { priority: Priority }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", PRIORITY_CONFIG[priority].dot)} />;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const c = PRIORITY_CONFIG[priority];
  return <span className={cn("rounded-full px-2 py-1 text-[10px] font-medium", c.bg, c.color)}>{c.label}</span>;
}

function Avatar({ name, size = "sm" }: { name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const color = getPersonColor(name);
  const sz = size === "xs" ? "w-5 h-5 text-[9px]" : size === "md" ? "w-8 h-8 text-sm" : size === "lg" ? "w-10 h-10 text-sm" : "w-6 h-6 text-[10px]";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold flex-shrink-0", sz)}
      style={personColorStyle(color)}>
      {getInitials(name)}
    </div>
  );
}

function StatusDot({ status }: { status: TaskStatus }) {
  const configs: Record<TaskStatus, string> = {
    ready: "bg-primary", in_progress: "bg-success",
    waiting: "bg-info", blocked: "bg-overdue", review: "bg-review", done: "bg-success",
  };
  return <span className={cn("w-2 h-2 rounded-full flex-shrink-0", configs[status])} />;
}

function LinkIcon({ type }: { type: TaskLink["type"] }) {
  const configs: Record<ResourceType, { icon: ReactNode; color: string; bg: string }> = {
    website: { icon: <Globe className="w-3 h-3" />, color: "text-info", bg: "bg-[#edf4fb]" },
    sheet: { icon: <BarChart2 className="w-3 h-3" />, color: "text-success", bg: "bg-[#edf7f0]" },
    figma: { icon: <Layers className="w-3 h-3" />, color: "text-review", bg: "bg-[#f4effa]" },
    github: { icon: <GitBranch className="w-3 h-3" />, color: "text-[#6e7485]", bg: "bg-muted" },
    drive: { icon: <FolderKanban className="w-3 h-3" />, color: "text-warning", bg: "bg-[#fff9e4]" },
    doc: { icon: <FileText className="w-3 h-3" />, color: "text-info", bg: "bg-[#edf4fb]" },
    dashboard: { icon: <BarChart2 className="w-3 h-3" />, color: "text-info", bg: "bg-[#edf4fb]" },
    notion: { icon: <FileText className="w-3 h-3" />, color: "text-foreground", bg: "bg-muted" },
    other: { icon: <Link2 className="w-3 h-3" />, color: "text-muted-foreground", bg: "bg-muted" },
  };
  const c = configs[type];
  return (
    <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded", c.bg, c.color)}>
      {c.icon}
    </span>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-5 group">
      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
      {label}
    </button>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick, compact = false }: { task: Task; onClick: () => void; compact?: boolean }) {
  const isMyAction = task.nextActionBy === "me";
  const assignees = getTaskAssignees(task);
  const assigneeNames = taskAssigneeNames(task);
  return (
    <button onClick={onClick}
      className={cn(
        "w-full text-left group rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_10px_22px_rgb(35_41_61_/_0.065)]",
        compact ? "p-3.5" : "p-4.5",
        task.isOverdue && "border-overdue/25 bg-[#fff8f7]",
        task.status === "waiting" && "border-info/20 bg-[#fbfdff]",
        task.status === "blocked" && "border-overdue/25 bg-overdue/[0.035]",
        task.status === "review" && "border-review/25 bg-[#fdfbff]",
        task.status === "done" && "border-success/20 bg-[#fbfdfb]",
      )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0"><PriorityDot priority={task.priority} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm font-medium leading-snug text-foreground", compact && "text-[13px]")}>{task.title}</p>
            {task.isOverdue && <span className="flex-shrink-0 rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">Past target</span>}
            {task.status === "blocked" && <span className="flex shrink-0 items-center gap-1 rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue"><GitBranch className="h-3 w-3" />Blocked</span>}
            {task.status === "review" && <span className="flex-shrink-0 rounded-full bg-review/10 px-2 py-1 text-[10px] font-medium text-review">Ready to review</span>}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <OrgBadge org={task.org} />
            <span className="text-muted-foreground text-[11px]">·</span>
            {isSharedTask(task) ? <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><span>Lead:</span><AreaBadge area={task.area} /><span>· with {getTaskAreas(task).filter(area => area !== task.area).join(" · ")}</span></span> : <AreaBadge area={task.area} />}
            {task.deadline && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="w-3 h-3" />{task.deadline}
              </span>
            )}
          </div>
          {!compact && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <StatusDot status={task.status} />
                <span className="text-[11px] text-muted-foreground capitalize">{task.status.replace("_", " ")}</span>
              </div>
              {assigneeNames.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="flex -space-x-1.5">{assignees.slice(0, 2).map(person => <Avatar key={person.id} name={person.name} size="xs" />)}</span>
                  <span className="max-w-44 truncate text-[11px] text-muted-foreground">{assigneeNames.slice(0, 2).join(" · ")}{assigneeNames.length > 2 ? ` · +${assigneeNames.length - 2}` : ""}</span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[11px] font-mono text-muted-foreground">Next:</span>
                <span className={cn("text-[11px] font-medium", isMyAction ? "text-warning" : "text-muted-foreground")}>
                  {isMyAction ? "Me" : task.nextActionBy}
                </span>
              </div>
            </div>
          )}
          {task.blockedBy && !compact && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-overdue"><GitBranch className="h-3 w-3" />Blocked by {task.blockedBy.label}</p>}
        </div>
      </div>
    </button>
  );
}

// ─── COMPACT TASK ROW ─────────────────────────────────────────────────────────

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const isMyAction = task.nextActionBy === "me";
  const hasResources = (task.links?.length || 0) + (task.files?.length || 0) > 0;
  const assignees = getTaskAssignees(task);
  return (
    <button onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border/70 transition-colors hover:bg-primary/[0.025] group",
        task.isOverdue && "bg-[#fffafa]"
      )}>
      <PriorityDot priority={task.priority} />
      <p className="text-[13px] text-foreground flex-1 truncate pr-2">{task.title}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="hidden sm:inline-flex"><OrgBadge org={task.org} /></span>
        <span className="hidden lg:inline-flex items-center gap-1"><AreaBadge area={task.area} />{isSharedTask(task) && <span title={`Shared with ${getTaskAreas(task).filter(area => area !== task.area).join(", ")}`} className="text-primary">↔</span>}</span>
        <span className="hidden sm:inline-flex">{assignees.length
          ? <span className="flex -space-x-1.5" title={taskAssigneeNames(task).join(", ")}>{assignees.slice(0, 2).map(person => <Avatar key={person.id} name={person.name} size="xs" />)}{assignees.length > 2 && <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full border border-card bg-muted px-1 text-[8px] text-muted-foreground">+{assignees.length - 2}</span>}</span>
          : <span className="w-5 h-5" />}</span>
        <div className="flex items-center gap-1">
          <StatusDot status={task.status} />
        </div>
        {task.deadline
          ? <span className={cn("hidden w-24 text-right text-[11px] font-medium sm:inline", task.isOverdue ? "text-overdue" : "text-muted-foreground")}>{task.deadline}</span>
          : <span className="hidden w-24 text-right text-[11px] font-mono text-muted-foreground/40 sm:inline">No date</span>}
        <span className={cn("hidden w-20 text-right text-[11px] font-medium lg:inline", isMyAction ? "text-warning" : "text-muted-foreground")}>
          → {isMyAction ? "Me" : task.nextActionBy.split(" ")[0]}
        </span>
        {hasResources
          ? <span className="hidden h-3 w-3 flex-shrink-0 rounded-full bg-primary/35 sm:inline" title="Has resources" />
          : <span className="hidden h-3 w-3 flex-shrink-0 sm:inline" />}
      </div>
    </button>
  );
}

// ─── TASK DETAIL DRAWER ───────────────────────────────────────────────────────

function TaskDetailDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const [, setRevision] = useState(0);
  const [waitingCheckOpen, setWaitingCheckOpen] = useState(false);
  const [blockingKind, setBlockingKind] = useState<DependencyKind>("task");
  const [areasEditOpen, setAreasEditOpen] = useState(false);
  const [assigneesEditOpen, setAssigneesEditOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function markDone() {
    Object.assign(task, { status: "done" as TaskStatus, isWaiting: false, isOverdue: false, nextActionBy: "me", lastUpdate: "Just now" });
    TASKS.filter(candidate => candidate.status === "blocked" && candidate.blockedBy?.taskId === task.id).forEach(candidate => {
      Object.assign(candidate, { status: "ready" as TaskStatus, isWaiting: false, blockedBy: undefined, nextActionBy: candidate.assignee || candidate.area, lastUpdate: `${task.title} completed — ready to move` });
    });
    commitTaskStore();
    onClose();
  }

  function requestRevision() {
    Object.assign(task, { status: "ready" as TaskStatus, isWaiting: false, nextActionBy: task.assignee || "me", lastUpdate: "Revision requested just now" });
    commitTaskStore();
    onClose();
  }

  function reschedule() {
    Object.assign(task, { deadline: "Tomorrow", isOverdue: false, lastUpdate: "Rescheduled just now" });
    commitTaskStore();
    onClose();
  }

  function markWaiting(canStillMove: boolean) {
    if (canStillMove) {
      Object.assign(task, { status: "waiting" as TaskStatus, isWaiting: true, lastUpdate: "Waiting noted just now" });
    } else {
      Object.assign(task, {
        status: "blocked" as TaskStatus,
        isWaiting: false,
        blockedBy: task.blockedBy || { kind: blockingKind, type: "blocking", label: blockingKind === "task" ? "A dependent task" : blockingKind === "department" ? "Another department" : blockingKind === "decision" ? "A decision" : blockingKind === "external" ? "An external response" : "Another dependency" },
        lastUpdate: "Blocker noted just now",
      });
    }
    commitTaskStore();
    setWaitingCheckOpen(false);
    setRevision(current => current + 1);
  }

  function setLeadArea(area: AreaName) {
    Object.assign(task, { area, involvedAreas: Array.from(new Set([area, ...(task.involvedAreas || [])])) });
    commitTaskStore();
    setRevision(current => current + 1);
  }

  function toggleInvolvedArea(area: AreaName) {
    const existing = getTaskAreas(task);
    const next = existing.includes(area) ? existing.filter(item => item !== area) : [...existing, area];
    Object.assign(task, { involvedAreas: Array.from(new Set([task.area, ...next])) });
    commitTaskStore();
    setRevision(current => current + 1);
  }

  function toggleTaskAssignee(id: string) {
    const current = getTaskAssigneeIds(task);
    setTaskAssignees(task, current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    setRevision(value => value + 1);
  }

  const assignedPeople = getTaskAssignees(task);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-[#293047]/15 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Task details: ${task.title}`} className="relative h-full w-full max-w-[34rem] border-l border-border bg-card shadow-[-18px_0_48px_rgb(38_48_71_/_0.12)] sm:w-[32rem]">
        <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <PriorityDot priority={task.priority} />
              <OrgBadge org={task.org} />
              <span className="text-[10px] text-muted-foreground">Lead:</span><AreaBadge area={task.area} />
            </div>
            <h2 className="binnie-heading text-lg font-bold leading-snug text-foreground">{task.title}</h2>
          </div>
          <button aria-label="Close task details" onClick={onClose} className="flex-shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { label: "Status", value: <div className="flex items-center gap-1.5"><StatusDot status={task.status} /><span className="capitalize text-sm">{task.status.replace("_", " ")}</span></div> },
              { label: "Priority", value: <PriorityBadge priority={task.priority} /> },
              { label: "Assigned To", value: assignedPeople.length ? <div className="flex flex-wrap items-center gap-1.5">{assignedPeople.map(person => <span key={person.id} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-1 text-sm text-foreground"><Avatar name={person.name} size="xs" />{person.name}</span>)}</div> : <span className="text-sm text-muted-foreground">Unassigned</span> },
              { label: "Next Action By", value: <span className={cn("text-sm font-medium", task.nextActionBy === "me" ? "text-warning" : "text-primary")}>{task.nextActionBy === "me" ? "You" : task.nextActionBy}</span> },
              { label: "Start / Target", value: <span className={cn("text-sm font-medium", task.isOverdue ? "text-overdue" : "text-foreground")}>{task.startDate || "—"} <span className="text-muted-foreground">→</span> {task.targetDate || task.deadline || "—"}</span> },
              { label: "Project", value: <span className="text-sm text-foreground">{task.project || "—"}</span> },
              { label: "Lead Area", value: <AreaBadge area={task.area} /> },
              { label: "Involved Areas", value: <span className="text-sm text-foreground">{getTaskAreas(task).filter(area => area !== task.area).join(" · ") || "No additional areas"}</span> },
              { label: "Contributors", value: <span className="text-sm text-foreground">{directoryNames(task.contributorIds).join(" · ") || "—"}</span> },
              { label: "Blocked By", value: task.blockedBy ? <span className="flex items-center gap-1.5 text-sm font-medium text-overdue"><GitBranch className="h-3.5 w-3.5" />{task.blockedBy.label}</span> : <span className="text-sm text-muted-foreground">No blocking dependency</span> },
              { label: "Waiting Since", value: <span className="text-sm font-mono text-muted-foreground">{task.waitingSince || "—"}</span> },
              { label: "Response Due", value: <span className="text-sm font-mono text-muted-foreground">{task.responseDue || "—"}</span> },
              { label: "Last Update", value: <span className="text-sm text-muted-foreground">{task.lastUpdate || "—"}</span> },
              { label: "Est. Time", value: <span className="text-sm font-mono text-muted-foreground">{task.estimatedHours ? `${task.estimatedHours}h` : "—"}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-muted/55 p-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                {value}
              </div>
            ))}
          </div>
          <section className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-foreground">Shared work</p><p className="mt-0.5 text-[10px] text-muted-foreground">One task stays visible to every involved department.</p></div><button onClick={() => setAreasEditOpen(current => !current)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10">{areasEditOpen ? "Done" : "Edit"}</button></div>
            {areasEditOpen && <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2"><label className="text-[10px] font-medium text-muted-foreground">Lead Area<select value={task.area} onChange={event => setLeadArea(event.target.value as AreaName)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground">{captureOrgAreas(task.org).map(area => <option key={area}>{area}</option>)}</select></label><div><p className="text-[10px] font-medium text-muted-foreground">Involved Areas</p><div className="mt-1 flex flex-wrap gap-1">{captureOrgAreas(task.org).map(area => <button key={area} onClick={() => toggleInvolvedArea(area)} className={cn("rounded-full border px-2 py-1 text-[10px]", getTaskAreas(task).includes(area) ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{area}</button>)}</div></div></div>}
          </section>
          <section className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-foreground">Assigned to</p><p className="mt-0.5 text-[10px] text-muted-foreground">People and teams can collaborate on one shared task.</p></div><button onClick={() => setAssigneesEditOpen(current => !current)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10">{assigneesEditOpen ? "Done" : "+ Add assignee"}</button></div>
            {assignedPeople.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{assignedPeople.map(person => <span key={person.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] text-foreground"><Avatar name={person.name} size="xs" />{person.name}{assigneesEditOpen && <button onClick={() => toggleTaskAssignee(person.id)} aria-label={`Remove ${person.name}`} className="text-muted-foreground hover:text-overdue"><X className="h-3 w-3" /></button>}</span>)}</div>}
            {assigneesEditOpen && <div className="mt-3 border-t border-border pt-3"><p className="text-[10px] font-medium text-muted-foreground">Add people or teams</p><div className="mt-2 flex flex-wrap gap-1.5">{getDirectoryAssignees(task.org).map(person => <button key={person.id} onClick={() => toggleTaskAssignee(person.id)} className={cn("rounded-full border px-2.5 py-1 text-[10px] font-medium", getTaskAssigneeIds(task).includes(person.id) ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{person.name}{person.type === "team" ? " · Team" : ""}</button>)}</div></div>}
          </section>
          {task.links && task.links.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Resources</h3>
              <div className="space-y-1.5">
                {task.links.map((link, i) => link.url === "#" ? <div key={i} className="flex items-center gap-2.5 rounded-xl bg-muted/55 p-3"><LinkIcon type={link.type} /><span className="flex-1 text-sm text-foreground">{link.label}</span><span className="text-[10px] text-muted-foreground">Not connected</span></div> : (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-xl bg-muted/55 p-3 transition-colors hover:bg-secondary"><LinkIcon type={link.type} /><span className="flex-1 text-sm text-foreground">{link.label}</span><ExternalLink className="w-3 h-3 text-muted-foreground transition-colors group-hover:text-foreground" /></a>
                ))}
              </div>
            </div>
          )}
          {task.files && task.files.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Files</h3>
              <div className="space-y-1.5">
                {task.files.map((file, i) => {
                  const colors: Record<TaskFile["type"], string> = { pdf: "text-overdue", excel: "text-success", screenshot: "text-info", doc: "text-primary" };
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl bg-muted/55 p-3">
                      <FileText className={cn("w-4 h-4 flex-shrink-0", colors[file.type])} />
                      <span className="text-sm text-foreground flex-1 truncate">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground">Attached</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {task.notes && (
            <div>
              <h3 className="mb-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Notes</h3>
              <p className="rounded-xl bg-muted/45 p-3 text-[13px] leading-relaxed text-muted-foreground">{task.notes}</p>
            </div>
          )}
          {task.originalCapture && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Original Capture</h3>
              <div className="rounded-xl border border-border bg-muted/45 p-3">
                <p className="text-[13px] text-muted-foreground italic leading-relaxed">&ldquo;{task.originalCapture}&rdquo;</p>
              </div>
            </div>
          )}
          {task.blockedBy && (
            <div className="rounded-2xl border border-overdue/20 bg-overdue/[0.045] p-4">
              <div className="flex items-start gap-2.5"><GitBranch className="mt-0.5 h-4 w-4 flex-shrink-0 text-overdue" /><div><p className="text-[12px] font-semibold text-foreground">Real dependency</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">This task is blocked by {task.blockedBy.label}{task.blockedBy.owner ? ` · next action: ${task.blockedBy.owner}` : ""}. It will stay visible separately from work that can still move.</p></div></div>
            </div>
          )}
          {task.activity && task.activity.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Activity</h3>
              <div className="space-y-3">
                {task.activity.map((act, i) => {
                  const actorColor = getPersonColor(act.actor);
                  return (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={personColorStyle(actorColor)}>
                          {getInitials(act.actor)}
                        </div>
                        {i < (task.activity?.length ?? 0) - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-[13px] text-foreground">{act.text}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{act.actor} · {act.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {waitingCheckOpen && <div className="mx-4 mb-1 rounded-2xl border border-info/20 bg-info/[0.055] p-3 sm:mx-5"><p className="text-[12px] font-semibold text-foreground">Does this stop the task from moving forward?</p><p className="mt-1 text-[11px] text-muted-foreground">Waiting can still leave room for other progress. Only use Blocked for a real dependency.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => markWaiting(true)} className="rounded-lg border border-info/20 bg-card px-3 py-2 text-[11px] font-medium text-info">No, I can still continue</button><button onClick={() => markWaiting(false)} className="rounded-lg bg-overdue px-3 py-2 text-[11px] font-medium text-white">Yes, this task is blocked</button><select value={blockingKind} onChange={event => setBlockingKind(event.target.value as DependencyKind)} aria-label="Blocking dependency type" className="rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-muted-foreground"><option value="task">Another task</option><option value="department">Another department</option><option value="decision">Waiting for approval</option><option value="external">External dependency</option><option value="other">Other</option></select></div></div>}
        <div className="flex flex-wrap gap-2 border-t border-border p-4 sm:p-5">
          <button onClick={markDone} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">
            {task.status === "review" ? "Approve" : "Mark Done"}
          </button>
          {task.status === "review" && (
            <button onClick={requestRevision} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-primary/10">
              Request Revision
            </button>
          )}
          {task.status !== "done" && <button onClick={() => setWaitingCheckOpen(current => !current)} className="rounded-xl border border-info/20 bg-info/[0.06] px-3 py-2.5 text-[11px] font-medium text-info transition-colors hover:bg-info/10">Mark waiting</button>}
          <button aria-label="Reschedule for tomorrow" onClick={reschedule} className="rounded-xl border border-border bg-muted p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Calendar className="w-4 h-4" />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────

type CaptureField = "org" | "area";
type InlineCapturePreview = ParsedTask & { uncertain: CaptureField[] };
type CaptureLearning = Record<string, { org?: OrgName; area?: AreaName; assignee?: string }>;

const BINNIE_CAPTURE_LEARNING_STORAGE_KEY = "binnie-capture-learning";
const CAPTURE_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const CAPTURE_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const CAPTURE_WEEKDAY_ALIASES: Record<string, string> = { minggu: "sunday", senin: "monday", selasa: "tuesday", rabu: "wednesday", kamis: "thursday", jumat: "friday", jumaat: "friday", sabtu: "saturday" };
const CAPTURE_MONTH_ALIASES: Record<string, string> = { januari: "january", februari: "february", maret: "march", april: "april", mei: "may", juni: "june", juli: "july", agustus: "august", september: "september", oktober: "october", november: "november", desember: "december" };

function captureKey(raw: string) {
  return raw.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\b(?:marketing|finance|operations|system development|hr|purchasing|deadline|target|due|by|end|of|the|this)\b/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(word => word.length > 2).slice(0, 4).join("-");
}

function readCaptureLearning(raw: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = JSON.parse(window.localStorage.getItem(BINNIE_CAPTURE_LEARNING_STORAGE_KEY) || "{}") as CaptureLearning;
    return stored[captureKey(raw)];
  } catch { return undefined; }
}

function rememberCaptureCorrection(raw: string, patch: { org?: OrgName; area?: AreaName; assignee?: string }) {
  if (typeof window === "undefined" || !captureKey(raw)) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(BINNIE_CAPTURE_LEARNING_STORAGE_KEY) || "{}") as CaptureLearning;
    stored[captureKey(raw)] = { ...stored[captureKey(raw)], ...patch };
    window.localStorage.setItem(BINNIE_CAPTURE_LEARNING_STORAGE_KEY, JSON.stringify(stored));
  } catch { /* Local learning is optional. */ }
}

function captureOrgAreas(org?: OrgName) {
  return org ? ORGS_META.find(item => item.name === org)?.areas || [] : Array.from(new Set(ORGS_META.flatMap(item => item.areas)));
}

function getOrganizationAliases(org?: OrgName) {
  if (!org) return [];
  const meta = ORGS_META.find(item => item.name === org);
  if (typeof window === "undefined") return meta?.aliases || [];
  try {
    const saved = JSON.parse(window.localStorage.getItem("binnie-organization-aliases") || "{}") as Record<string, string[]>;
    return Array.from(new Set([...(meta?.aliases || []), ...(saved[org] || [])]));
  } catch { return meta?.aliases || []; }
}

function setOrganizationAliases(org: OrgName, aliases: string[]) {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(window.localStorage.getItem("binnie-organization-aliases") || "{}") as Record<string, string[]>;
    saved[org] = aliases.map(alias => alias.trim().toLowerCase()).filter(Boolean);
    window.localStorage.setItem("binnie-organization-aliases", JSON.stringify(saved));
  } catch { /* Aliases make capture smarter but never block the organization settings form. */ }
}

function getAreaSettings(org?: OrgName, area?: AreaName) {
  if (!org || !area) return undefined;
  const meta = ORGS_META.find(item => item.name === org);
  const defaults = meta?.areaSettings?.[area];
  if (typeof window === "undefined") return defaults;
  try {
    const saved = JSON.parse(window.localStorage.getItem("binnie-area-settings") || "{}") as Record<string, Record<string, OrganizationAreaSettings>>;
    return { ...defaults, ...saved[org]?.[area] };
  } catch { return defaults; }
}

function setAreaSettings(org: OrgName, area: AreaName, patch: Partial<OrganizationAreaSettings>) {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(window.localStorage.getItem("binnie-area-settings") || "{}") as Record<string, Record<string, OrganizationAreaSettings>>;
    saved[org] = { ...(saved[org] || {}), [area]: { ...getAreaSettings(org, area), ...patch } };
    window.localStorage.setItem("binnie-area-settings", JSON.stringify(saved));
    // Keep configured aliases in the same local workspace profile as responsibilities.
    setOrganizationAliases(org, getOrganizationAliases(org));
  } catch { /* Area settings are an enhancement, not a requirement for work capture. */ }
}

function getAreaTeam(org?: OrgName, area?: AreaName) {
  if (!org || !area) return undefined;
  const configuredAssignee = getAreaSettings(org, area)?.defaultAssignee;
  const selectedTeam = configuredAssignee ? getDirectoryPerson(configuredAssignee) : undefined;
  if (selectedTeam?.active && selectedTeam.type === "team" && selectedTeam.memberships.some(membership => membership.organization === org && membership.area === area)) return selectedTeam;
  const configuredTeam = getAreaSettings(org, area)?.defaultTeamId;
  const configured = configuredTeam ? PEOPLE_DIRECTORY.find(person => person.id === configuredTeam) : undefined;
  if (configured?.active && configured.type === "team" && configured.memberships.some(membership => membership.organization === org && membership.area === area)) return configured;
  return PEOPLE_DIRECTORY.find(person => person.active && person.type === "team" && person.memberships.some(membership => membership.organization === org && membership.area === area));
}

function captureDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(date);
}

function captureISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseCaptureDate(text: string): { label: string; iso: string; kind: CaptureDateKind; confidence: CaptureConfidence } | undefined {
  const normalized = [...Object.entries(CAPTURE_WEEKDAY_ALIASES), ...Object.entries(CAPTURE_MONTH_ALIASES)].reduce((value, [local, english]) => value.replace(new RegExp(`\\b${local}\\b`, "g"), english), text.toLowerCase()).replace(/\bbesok\b/g, "tomorrow").replace(/\bminggu depan\b/g, "next week");
  const today = getWorkspaceCalendarDate();
  const date = new Date(today);
  let found = false;
  const isTarget = /\b(?:target|aim for|try by|around|hopefully)\b/.test(normalized);
  const isDeadline = !isTarget && /\b(?:deadline|due|must finish(?: by)?|before|latest|by)\b/.test(normalized);
  const kind: CaptureDateKind = isDeadline ? "deadline" : "target";
  const semanticScope = normalized.match(/\b(?:deadline|due|must finish(?: by)?|before|latest|target|aim for|try by|around|hopefully)\b[^.;\n]*/i)?.[0] || normalized;
  if (/\btomorrow\b/.test(semanticScope)) { date.setUTCDate(date.getUTCDate() + 1); found = true; }
  else if (/\btoday\b/.test(semanticScope)) found = true;
  else if (/\bend of (?:this )?(?:month|the month)\b/.test(semanticScope)) { date.setUTCMonth(date.getUTCMonth() + 1, 0); found = true; }
  else {
    const endOfMonth = semanticScope.match(/\bend(?:\s+of)?\s+(?:the\s+)?([a-z]{3,9})\b/);
    const monthIndex = endOfMonth ? CAPTURE_MONTHS.findIndex(month => month.startsWith(endOfMonth[1].slice(0, 3))) : -1;
    if (monthIndex >= 0) {
      const year = monthIndex < today.getUTCMonth() ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
      date.setTime(Date.UTC(year, monthIndex + 1, 0));
      found = true;
    } else {
      const monthFirst = semanticScope.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i);
      const dayFirst = semanticScope.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s*(\d{4}))?\b/i);
      const monthToken = monthFirst?.[1] || dayFirst?.[2];
      const dayToken = monthFirst?.[2] || dayFirst?.[1];
      const yearToken = monthFirst?.[3] || dayFirst?.[3];
      const explicitMonth = monthToken ? CAPTURE_MONTHS.findIndex(month => month.startsWith(monthToken.slice(0, 3).toLowerCase())) : -1;
      if (explicitMonth >= 0 && dayToken) {
        let year = yearToken ? Number(yearToken) : today.getUTCFullYear();
        const candidate = new Date(Date.UTC(year, explicitMonth, Number(dayToken)));
        if (!yearToken && candidate.getTime() < today.getTime() && explicitMonth < today.getUTCMonth()) year += 1;
        date.setTime(Date.UTC(year, explicitMonth, Number(dayToken)));
        found = true;
      } else if (/\b(?:this|next) week\b/.test(semanticScope)) {
        const daysUntilFriday = (5 - date.getUTCDay() + 7) % 7 || 7;
        date.setUTCDate(date.getUTCDate() + daysUntilFriday + (/\bnext week\b/.test(semanticScope) ? 7 : 0));
        found = true;
      } else {
        const weekdayMatch = semanticScope.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
        if (weekdayMatch) {
          const weekday = CAPTURE_WEEKDAYS.indexOf(weekdayMatch[2]);
          let days = (weekday - date.getUTCDay() + 7) % 7;
          if (weekdayMatch[1] || days === 0) days += 7;
          date.setUTCDate(date.getUTCDate() + days);
          found = true;
        }
      }
    }
  }
  return found ? { label: captureDateLabel(date), iso: captureISODate(date), kind, confidence: "high" } : undefined;
}

function captureMetadataParts(raw: string) {
  const commaParts = raw.split(/\s*,\s*/);
  const useCommas = commaParts.length > 1 && commaParts.slice(1).some(part => /\b(?:deadline|target|due|by|end of|marketing|finance|operations|hr|purchasing|system development)\b/i.test(part));
  const parts = (useCommas ? commaParts : raw.split(/\s*(?:→|\||\/|;)\s*/)).map(part => part.trim()).filter(Boolean);
  // A date often comes first in a quick thought: “deadline tomorrow, ask
  // Marketing to…”. Treat it as metadata, never as the task's title.
  if (parts.length > 1 && /^(?:deadline|due|target|before|by|latest)\b/i.test(parts[0])) {
    return { description: parts.slice(1).join(" "), metadata: parts[0] };
  }
  return { description: parts[0] || raw.trim(), metadata: parts.slice(1).join(" ") };
}

function splitCaptureTasks(input: string) {
  const areaNames = Array.from(new Set(ORGS_META.flatMap(org => org.areas))).map(area => area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((left, right) => right.length - left.length);
  const actionWords = "prepare|update|confirm|review|check|reconcile|create|draft|fix|finalize|improve|approve|publish|plan|send|coordinate|organize|bikin|buat|urus|cek|cari|catat|design|rancang|follow up";
  const metadataOnly = /^(?:deadline|due|target|before|by|latest|must finish|end(?:\s+of)?|besok|tomorrow|minggu depan|next week)\b/i;
  const sentences = input.split(/\n|;/).map(part => part.trim()).filter(Boolean).reduce<string[]>((items, part) => {
    if (metadataOnly.test(part) && items.length) items[items.length - 1] = `${items[items.length - 1]}; ${part}`;
    else items.push(part);
    return items;
  }, []);
  if (!areaNames.length) return sentences.slice(0, 6);
  const areaReference = `(?:${areaNames.join("|")})`;
  // A coordinated group can precede one action: “Finance dan Purchasing
  // finalize budget” is one clause, not two department-specific tasks.
  const actionStart = new RegExp(`\\b${areaReference}(?:\\s*(?:,|dan|and|&)\\s*${areaReference})*\\s+(?:${actionWords})\\b`, "ig");
  return sentences.flatMap(sentence => {
    const starts = Array.from(sentence.matchAll(actionStart)).map(match => match.index ?? 0);
    if (starts.length < 2) return [sentence];
    return starts.map((start, index) => sentence.slice(start, starts[index + 1]).trim());
  }).filter(Boolean).slice(0, 6);
}

function hasCaptureTerm(text: string, term: string) {
  return new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(text);
}

function captureMentionedAreas(text: string, org?: OrgName) {
  const normalized = text.toLowerCase();
  return captureOrgAreas(org).filter(area => hasCaptureTerm(normalized, area) || Boolean(getAreaSettings(org, area)?.aliases?.some(alias => hasCaptureTerm(normalized, alias))));
}

function inferCaptureOrganization(text: string, project?: string, contextOrg?: OrgName, assignee?: string): { org?: OrgName; confidence: CaptureConfidence; project?: string; reason?: string } {
  const normalized = text.toLowerCase();
  const explicit = ORGS_META.find(org => normalized.includes(org.name.toLowerCase()));
  if (explicit) return { org: explicit.name, confidence: "high", reason: "Named in your capture" };
  const aliasedOrg = ORGS_META.find(org => getOrganizationAliases(org.name).some(alias => hasCaptureTerm(normalized, alias)));
  if (aliasedOrg) return { org: aliasedOrg.name, confidence: "high", reason: `Matched “${getOrganizationAliases(aliasedOrg.name).find(alias => hasCaptureTerm(normalized, alias))}”` };
  const projectMatch = Object.values(PROJECT_DETAILS).find(item => normalized.includes(item.name.toLowerCase())) || (project ? Object.values(PROJECT_DETAILS).find(item => item.name === project) : undefined);
  if (projectMatch) return { org: projectMatch.org, project: projectMatch.name, confidence: "high", reason: "Matched the project context" };
  const areaMatches = ORGS_META.map(org => ({ org: org.name, areas: captureMentionedAreas(normalized, org.name) })).sort((left, right) => right.areas.length - left.areas.length);
  if (areaMatches[0]?.areas.length && areaMatches[0].areas.length > (areaMatches[1]?.areas.length || 0)) return { org: areaMatches[0].org, confidence: areaMatches[0].areas.length > 1 ? "high" : "medium", reason: `Matched ${areaMatches[0].areas.join(", ")} in this workspace` };
  const semantic = ORGS_META.map(org => {
    const description = org.desc.toLowerCase();
    const score = (/(hospitality|property)/.test(description) && /\b(?:penginapan|lodging|accommodation|hotel|guest)\b/.test(normalized) ? 3 : 0)
      + (/(pharmacy)/.test(description) && /\b(?:obat|medicine|medication|inventory)\b/.test(normalized) ? 3 : 0)
      + (/(personal)/.test(description) && /\b(?:personal|home|myself)\b/.test(normalized) ? 3 : 0);
    return { org: org.name, score };
  }).sort((left, right) => right.score - left.score);
  if (semantic[0]?.score >= 3) return { org: semantic[0].org, confidence: "medium", reason: "Suggested from the work described" };
  if (assignee) {
    const person = getDirectoryPerson(assignee);
    if (person?.memberships.length === 1) return { org: person.memberships[0].organization, confidence: "medium", reason: `Suggested from ${person.name}'s membership` };
    const words = normalized.split(/[^a-z0-9]+/).filter(word => word.length > 3);
    const relatedOrgs = Array.from(new Set(TASKS.filter(task => task.assignee === assignee && words.some(word => task.title.toLowerCase().includes(word))).map(task => task.org)));
    if (relatedOrgs.length === 1) return { org: relatedOrgs[0], confidence: "medium", reason: "Suggested from similar assigned work" };
  }
  if (contextOrg) return { org: contextOrg, confidence: "high", reason: "Inherited from this workspace" };
  return { confidence: "unknown" };
}

function inferCaptureArea(text: string, org?: OrgName, contextArea?: AreaName, involvedAreas: AreaName[] = []): { area?: AreaName; confidence: CaptureConfidence; reason?: string } {
  const normalized = text.toLowerCase();
  const areas = captureOrgAreas(org);
  const explicitAreas = involvedAreas.length ? involvedAreas : captureMentionedAreas(text, org);
  if (explicitAreas.length === 1) return { area: explicitAreas[0], confidence: "high", reason: "Named in your capture" };
  if (explicitAreas.length > 1 && /\b(?:budget|cash|payment|invoice|finance)\b/.test(normalized) && explicitAreas.includes("Finance")) return { area: "Finance", confidence: "medium", reason: "Finance usually leads budget work" };
  if (contextArea) return { area: contextArea, confidence: "high", reason: "Inherited from this area" };
  const taskType = [
    { area: "Maintenance", terms: ["ac", "aircon", "electricity", "plumbing", "broken", "repair", "teknisi", "water heater", "lamp"] },
    { area: "Marketing", terms: ["instagram", "promo", "campaign", "content", "social media"] },
    { area: "Purchasing", terms: ["supplier", "purchase", "quotation", "procurement"] },
    { area: "Finance", terms: ["petty cash", "payment", "reconciliation", "invoice"] },
    { area: "Operations", terms: ["medicine", "obat", "inventory", "sop"] },
  ].find(candidate => areas.includes(candidate.area) && candidate.terms.some(term => hasCaptureTerm(normalized, term)));
  if (taskType) return { area: taskType.area, confidence: "medium", reason: "Suggested from similar operational work" };
  return { confidence: "unknown" };
}

function inferCaptureAssignee(text: string, org?: OrgName, area?: AreaName, explicitAssignee?: string, learnedAssignee?: string, areaWasExplicit = false): { assignee?: string; confidence: CaptureConfidence; reason?: string } {
  if (explicitAssignee) return { assignee: explicitAssignee, confidence: "high", reason: "Named in your capture" };
  const areaTeam = getAreaTeam(org, area);
  if (areaWasExplicit && areaTeam) return { assignee: areaTeam.name, confidence: "high", reason: `${areaTeam.name} is the linked team for ${area}` };
  const defaultAssignee = getAreaSettings(org, area)?.defaultAssignee;
  if (defaultAssignee && getDirectoryAssignees(org).some(person => person.name === defaultAssignee)) return { assignee: defaultAssignee, confidence: "medium", reason: `${defaultAssignee} is the default owner for ${area}` };
  if (areaTeam) return { assignee: areaTeam.name, confidence: "medium", reason: `${areaTeam.name} is the linked team for ${area}` };
  if (learnedAssignee) return { assignee: learnedAssignee, confidence: "medium", reason: "Suggested from a previous correction" };
  if (!org || !area) return { confidence: "unknown" };
  const terms = text.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3 && !["deadline", "target", "before", "after"].includes(term));
  const candidates = TASKS.filter(task => task.org === org && task.area === area && task.assignee)
    .map(task => ({ assignee: task.assignee!, score: terms.filter(term => task.title.toLowerCase().includes(term)).length }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  if (candidates[0] && candidates.filter(candidate => candidate.score === candidates[0].score).length === 1) return { assignee: candidates[0].assignee, confidence: "medium", reason: "Suggested from similar previous work" };
  return { confidence: "unknown" };
}

function inferCaptureAssignees(text: string, org: OrgName | undefined, leadArea: AreaName | undefined, involvedAreas: AreaName[], explicitIds: string[], learnedAssignee?: string) {
  // Keep every explicit entity. Area mentions add the configured team, while a
  // named person remains a separate collaborator rather than replacing it.
  // Put the lead team's assignment first for compact card display while still
  // retaining every explicitly involved team and person on the same task.
  const assignmentAreas = Array.from(new Set([...(leadArea ? [leadArea] : []), ...involvedAreas]));
  const explicitAreaTeamIds = assignmentAreas.map(area => getAreaTeam(org, area)?.id).filter((id): id is string => Boolean(id));
  const explicitEntityIds = explicitIds.filter(id => PEOPLE_DIRECTORY.some(person => person.id === id));
  const assigneeIds = Array.from(new Set([...explicitAreaTeamIds, ...explicitEntityIds]));
  if (assigneeIds.length) return { assigneeIds, confidence: "high" as const, reason: "Named people and department teams are kept together" };

  const fallback = inferCaptureAssignee(text, org, leadArea, undefined, learnedAssignee, false);
  const fallbackId = fallback.assignee ? getDirectoryPerson(fallback.assignee)?.id : undefined;
  return { assigneeIds: fallbackId ? [fallbackId] : [], confidence: fallback.confidence, reason: fallback.reason };
}

function cleanCaptureTitle(description: string) {
  let source = description
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(?:ask|assign(?:\s+to)?|follow up with)\s+[^,]+?\s+to\s+/i, "")
    .replace(/^\s*(?:task\s+for\s+me|my\s+task|remind\s+me\s+to|i\s+need\s+to|i\s+should|need\s+to|please|can\s+you|could\s+you|buat\s+saya|tugas\s+saya|untuk\s+saya|aku\s+harus|saya\s+harus|tolong)\b[\s,:-]*/i, "")
    .replace(/\b(?:for\s+)?(?:deadline|target)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:→|/\-]+|[\s,;:→|/\-]+$/g, "")
    .trim();
  source = source
    .replace(/\bfinish\s+finali[sz]ing\b/i, "finalize")
    .replace(/\b(?:with|sama|bersama)\s+(?:(?:[a-z]+\s+)?team|marketing|finance|purchasing|operations|hr|design)(?:\s*(?:,|and|dan|&)\s*(?:(?:[a-z]+\s+)?team|marketing|finance|purchasing|operations|hr|design))*\b/gi, "")
    .replace(/\b(?:today|tomorrow|besok|this\s+week|next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  PEOPLE_DIRECTORY.forEach(person => { source = source.replace(new RegExp(`^${person.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), ""); });
  const departmentPrefix = Array.from(new Set(ORGS_META.flatMap(org => org.areas))).sort((left, right) => right.length - left.length).map(area => area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (departmentPrefix) source = source.replace(new RegExp(`^(?:${departmentPrefix})(?:\\s+team)?\\s+`, "i"), "");
  for (let index = 0; index < 3; index += 1) {
    source = source.replace(/^(?:and|dan|&|,)\s*/i, "");
    PEOPLE_DIRECTORY.forEach(person => { source = source.replace(new RegExp(`^${person.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), ""); });
  }
  const normalized = source.toLowerCase();
  const monthAlias = Object.entries(CAPTURE_MONTH_ALIASES).find(([local]) => hasCaptureTerm(normalized, local))?.[1] || CAPTURE_MONTHS.find(month => hasCaptureTerm(normalized, month) || hasCaptureTerm(normalized, month.slice(0, 3)));
  if (/\breview\s+marketing\s+proposal\b/.test(normalized)) return "Review the marketing proposal";
  if (/\b(?:finalize|finalise|selesaikan)\b/.test(normalized) && /\bbudget\b/.test(normalized)) return `Finalize the ${monthAlias ? `${monthAlias[0].toUpperCase()}${monthAlias.slice(1)} ` : ""}budget`;
  if (/\b(?:finalize|finalise)\b/.test(normalized) && /\bsignage\b/.test(normalized)) return "Finalize the signage";
  if (/\b(?:finalize|finalise)\b/.test(normalized) && /\bmarketing\b/.test(normalized) && /\bproposal\b/.test(normalized)) return "Finalize the marketing proposal";
  if (/\b(?:bikin|buat|create|prepare)\b/.test(normalized) && /\bposter\b/.test(normalized) && /\b(?:promo|promotion)\b/.test(normalized)) return /\bweekend\b/.test(normalized) ? "Create weekend promotional poster" : "Create the promotional poster";
  if (/\b(?:bikin|buat|create|prepare|design)\b/.test(normalized) && /\bbanner\b/.test(normalized) && /\b(?:promo|promotion)\b/.test(normalized)) return "Create the promotional banner";
  if (/\b(?:bikin|buat|create|prepare)\b/.test(normalized) && /\b(?:promo|campaign)\b/.test(normalized)) return "Create the promotion campaign";
  if (/\b(?:design|create|buat|bikin)\b/.test(normalized) && /\bsignage\b/.test(normalized) && /\b(?:penginapan|accommodation|villa)\b/.test(normalized)) return "Design the accommodation signage";
  if (/\b(?:penginapan|accommodation)\b/.test(normalized) && /\b(?:list barang|inventory|tempel|wall)\b/.test(normalized)) return "Create an inventory display for each accommodation unit";
  if (/\bwifi\b/.test(normalized) && /\b(?:info|information)\b/.test(normalized)) return /\b(?:penginapan|lodging|accommodation|hotel|guest)\b/.test(normalized) ? "Update lodging Wi-Fi information" : "Update Wi-Fi information";
  if (/\bwifi\b/.test(normalized)) return /\b(?:penginapan|lodging|accommodation|hotel|guest)\b/.test(normalized) ? "Improve lodging Wi-Fi" : "Improve Wi-Fi";
  if (/\b(?:fix|repair)\b/.test(normalized) && /\b(?:ac|aircon)\b/.test(normalized) || /\b(?:ac|aircon)\b/.test(normalized) && /\b(?:room|kamar)\b/.test(normalized)) {
    const room = normalized.match(/\b(?:room|kamar)\s*(\d+)\b/);
    if (room) return `Fix AC in Room ${room[1]}`;
    if (/\bkhayangan\b/.test(normalized)) return "Fix AC in Khayangan room";
    return "Fix room AC";
  }
  if (/\b(?:expired|expiry)\b/.test(normalized) && /\b(?:medicine|medication|obat)\b/.test(normalized)) return "Check expired medicine inventory";
  if (/\bpetty cash\b/.test(normalized)) {
    const month = CAPTURE_MONTHS.find(value => normalized.includes(value)) || CAPTURE_MONTHS.find(value => normalized.includes(value.slice(0, 3)));
    return `Reconcile ${month ? `${month[0].toUpperCase()}${month.slice(1)} ` : ""}petty cash`;
  }
  if (/\b(?:harga|price|pricing)\b/.test(normalized) && /\b(?:website|kamar|room)\b/.test(normalized)) return /\bupdate\b/.test(normalized) ? "Update website pricing" : /\b(?:kamar|room)\b/.test(normalized) ? "Check room prices" : /\breview\b/.test(normalized) ? "Review website accommodation prices" : "Check website accommodation prices";
  if (/^call\s+supplier\b/i.test(source)) return "Call the supplier";
  source = source.replace(/\b(?:after|once|waiting for|depends on|cannot start until|blocked by)\b.*$/i, "").replace(/\b(?:by|on)\s+(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b.*$/i, "").trim();
  if (!source) {
    const fallback = description.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
    return fallback ? fallback[0].toUpperCase() + fallback.slice(1) : "";
  }
  source = source
    .replace(/^bikin\b/i, "Create")
    .replace(/^buat\b/i, "Create")
    .replace(/^cek\b/i, "Check")
    .replace(/^cari\b/i, "Find")
    .replace(/^urus\b/i, "Coordinate")
    .replace(/^catat\b/i, "Record")
    .replace(/^design\b/i, "Design")
    .replace(/^buatkan\b/i, "Create");
  // “Review” is a valid action when the capture says it. It is never a generic
  // fallback for a raw thought: Binnie's review UI must not leak into task names.
  const title = source;
  return title[0].toUpperCase() + title.slice(1);
}

function captureIsForCurrentUser(raw: string) {
  return /\b(?:for\s+me|my\s+task|i\s+need\s+to|remind\s+me\s+to|i\s+should|buat\s+saya|tugas\s+saya|untuk\s+saya|aku\s+harus|saya\s+harus)\b/i.test(raw);
}

function formatCaptureAreas(areas: AreaName[]) {
  if (areas.length < 2) return areas[0] || "";
  if (areas.length === 2) return `${areas[0]} and ${areas[1]}`;
  return `${areas.slice(0, -1).join(", ")}, and ${areas[areas.length - 1]}`;
}

function captureNotesForAreas(areas: AreaName[]) {
  return areas.length > 1 ? `Coordinate with ${formatCaptureAreas(areas)}.` : undefined;
}

function createCapturePreviews(input: string, organization?: OrgName, defaultArea?: AreaName, project?: string, currentUserId?: string): InlineCapturePreview[] {
  return splitCaptureTasks(input).map(raw => {
    const { description, metadata } = captureMetadataParts(raw);
    const text = `${raw} ${metadata}`;
    const learned = readCaptureLearning(raw);
    const assigneeMatch = raw.match(/\b(?:ask|assign(?:\s+to)?|follow up with)\s+(.+?)\s+to\b/i);
    const namedAssigneeIds = PEOPLE_DIRECTORY.filter(person => hasCaptureTerm(raw, person.name)).map(person => person.id);
    const askedAssignee = resolveDirectoryAssignee(assigneeMatch?.[1]);
    const askedAssigneeId = askedAssignee ? getDirectoryPerson(askedAssignee)?.id : undefined;
    const explicitAssigneeIds = Array.from(new Set([
      ...namedAssigneeIds,
      ...(askedAssigneeId ? [askedAssigneeId] : []),
      ...(captureIsForCurrentUser(raw) && currentUserId ? [currentUserId] : []),
    ]));
    const explicitAssignee = directoryNames(explicitAssigneeIds)[0] || askedAssignee;
    const inferredOrg = inferCaptureOrganization(text, project, organization, explicitAssignee);
    const org = learned?.org || inferredOrg.org;
    const orgConfidence = learned?.org ? "medium" as const : inferredOrg.confidence;
    const explicitInvolvedAreas = captureMentionedAreas(text, org);
    const inferredArea = inferCaptureArea(text, org, defaultArea, explicitInvolvedAreas);
    const area = learned?.area || inferredArea.area;
    const areaConfidence = learned?.area ? "medium" as const : inferredArea.confidence;
    const involvedAreas = Array.from(new Set([...(explicitInvolvedAreas.length ? explicitInvolvedAreas : area ? [area] : []), ...(area && !explicitInvolvedAreas.includes(area) ? [area] : [])]));
    const inferredAssignees = inferCaptureAssignees(text, org, area, explicitInvolvedAreas, explicitAssigneeIds, learned?.assignee);
    const assigneeNames = directoryNames(inferredAssignees.assigneeIds);
    const date = parseCaptureDate(text);
    const dependencyMatch = raw.match(/\b(?:after|once|waiting for|depends on|cannot start until|blocked by)\s+(.+)$/i);
    const blockedByTitle = dependencyMatch ? cleanCaptureTitle(dependencyMatch[1]) : undefined;
    const priorityExplicit = /\b(?:urgent|asap|critical|must finish today|important|high priority|whenever|no rush|someday)\b/i.test(raw);
    const priority: Priority = /\b(?:urgent|asap|critical)\b/i.test(raw) ? "urgent" : /\b(?:must finish today|important|high priority)\b/i.test(raw) ? "high" : /\b(?:whenever|no rush|someday)\b/i.test(raw) ? "low" : "medium";
    const confidence = [orgConfidence, areaConfidence].includes("low") ? "low" : [orgConfidence, areaConfidence, inferredAssignees.confidence].includes("medium") ? "medium" : "high";
    return {
      title: cleanCaptureTitle(description), org, area, involvedAreas, assignee: assigneeNames[0], assigneeIds: inferredAssignees.assigneeIds, priority, priorityExplicit, originalText: raw,
      project: inferredOrg.project || project,
      suggestedStatus: blockedByTitle ? "blocked" as TaskStatus : "ready" as TaskStatus,
      blockedByTitle, link: raw.match(/https?:\/\/\S+/i)?.[0],
      notes: captureNotesForAreas(involvedAreas),
      deadline: date?.kind === "deadline" ? date.label : undefined,
      targetDate: date?.kind === "target" ? date.label : undefined,
      dateISO: date?.iso, dateKind: date?.kind,
      orgConfidence, areaConfidence, assigneeConfidence: inferredAssignees.confidence, dateConfidence: date?.confidence || "unknown", overallConfidence: confidence,
      orgReason: learned?.org ? "Suggested from a previous correction" : inferredOrg.reason,
      areaReason: learned?.area ? "Suggested from a previous correction" : inferredArea.reason,
      assigneeReason: inferredAssignees.reason,
      uncertain: [],
    };
  });
}

function filesFromCapture(names: string[]): TaskFile[] | undefined {
  if (!names.length) return undefined;
  return names.map(name => ({
    name,
    type: /\.(xlsx?|csv)$/i.test(name) ? "excel" : /\.(png|jpe?g|webp|gif)$/i.test(name) ? "screenshot" : /\.pdf$/i.test(name) ? "pdf" : "doc",
  }));
}

function saveCapturedTask(capture: ParsedTask, attachments: string[] = [], context?: { project?: string; area?: AreaName }, createdBy = DEFAULT_CURRENT_USER_ID) {
  const taskOrg = capture.org || (context?.project ? PROJECT_DETAILS[context.project]?.org : undefined) || "Uncategorized";
  // Explicitly parsed lead area always wins over the page context. The context is
  // only a fallback for a capture that did not identify an owning department.
  const taskArea = capture.area || context?.area || (capture.involvedAreas?.length === 1 ? capture.involvedAreas[0] : "Unassigned");
  const taskInvolvedAreas = Array.from(new Set([...(taskArea !== "Unassigned" ? [taskArea] : []), ...(capture.involvedAreas || [])].filter(Boolean)));
  const legacyAssigneeId = capture.assignee ? getDirectoryPerson(capture.assignee)?.id : undefined;
  const taskAssigneeIds = Array.from(new Set([...(capture.assigneeIds || []), ...(legacyAssigneeId ? [legacyAssigneeId] : [])]));
  const assignedNames = directoryNames(taskAssigneeIds);
  const primaryAssignee = assignedNames[0] || capture.assignee;
  const isDelegated = taskAssigneeIds.some(id => id !== createdBy);
  const dependencyTask = capture.blockedByTitle ? TASKS.find(task => task.title.toLowerCase().includes(capture.blockedByTitle!.toLowerCase()) || capture.blockedByTitle!.toLowerCase().includes(task.title.toLowerCase())) : undefined;
  return createTask({
    title: capture.title,
    org: taskOrg,
    area: taskArea,
    involvedAreas: taskInvolvedAreas.length ? taskInvolvedAreas : undefined,
    assigneeIds: taskAssigneeIds,
    project: context?.project || capture.project,
    priority: capture.priority,
    status: capture.suggestedStatus || "ready",
    assignee: primaryAssignee,
    nextActionBy: primaryAssignee || "Unassigned",
    deadline: capture.deadline,
    deadlineDate: capture.dateKind === "deadline" ? capture.dateISO : undefined,
    targetDate: capture.dateKind === "target" ? capture.dateISO : undefined,
    responseDue: capture.followUpDate,
    isDelegated,
    isWaiting: capture.suggestedStatus === "waiting",
    blockedBy: capture.suggestedStatus === "blocked" ? dependencyTask ? { kind: "task", type: "blocking", label: dependencyTask.title, taskId: dependencyTask.id, owner: dependencyTask.area } : { kind: "decision", type: "blocking", label: capture.blockedByTitle || "A decision or approval" } : undefined,
    isToday: capture.dateISO === captureISODate(getWorkspaceCalendarDate()),
    files: filesFromCapture(attachments),
    links: capture.link ? [{ label: "Captured link", url: capture.link, type: "website" }] : undefined,
    originalCapture: capture.originalText,
    description: capture.notes,
    notes: capture.notes,
    createdBy,
    lastUpdate: "Just now",
    activity: [{ type: "assigned", actor: "You", text: assignedNames.length ? `Created from Smart Inbox and assigned to ${assignedNames.join(" · ")}` : "Created from Smart Inbox", time: "Just now" }],
  });
}

function CapturedWorkReviewCard({
  preview,
  editing,
  currentUserId,
  onChange,
  onConfirm,
  onDiscard,
  onToggleEdit,
}: {
  preview: InlineCapturePreview;
  editing: boolean;
  currentUserId?: string;
  onChange: (patch: Partial<InlineCapturePreview>) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onToggleEdit: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const availableAreas = captureOrgAreas(preview.org);
  const candidateOrganizations = preview.involvedAreas?.length
    ? ORGS_META.filter(org => preview.involvedAreas?.every(area => org.areas.includes(area)))
    : [];
  const assignees = (preview.assigneeIds || [])
    .map(id => getDirectoryPerson(id))
    .filter((person): person is DirectoryPerson => Boolean(person))
    .map(person => person.id === currentUserId ? "Me" : person.name);
  const areasToShow = preview.involvedAreas?.length ? preview.involvedAreas : preview.area ? [preview.area] : [];
  const statusLabel = PLANNING_COLUMNS.find(column => column.id === (preview.suggestedStatus || "ready"))?.label || "Ready";
  const updateDate = (kind: CaptureDateKind, iso: string) => onChange({
    dateKind: kind,
    dateISO: iso || undefined,
    deadline: kind === "deadline" && iso ? captureDateLabel(new Date(`${iso}T00:00:00Z`)) : undefined,
    targetDate: kind === "target" && iso ? captureDateLabel(new Date(`${iso}T00:00:00Z`)) : undefined,
  });
  const chooseOrganization = (org: OrgName) => onChange({ org, orgConfidence: "high" });
  const toggleArea = (area: AreaName) => {
    const involvedAreas = preview.involvedAreas?.includes(area)
      ? preview.involvedAreas.filter(item => item !== area)
      : [...(preview.involvedAreas || []), area];
    onChange({ involvedAreas, area: preview.area || area });
  };
  const addAssignee = (id: string) => {
    if (!id) return;
    const assigneeIds = Array.from(new Set([...(preview.assigneeIds || []), id]));
    onChange({ assigneeIds, assignee: directoryNames(assigneeIds)[0], assigneeConfidence: "high" });
  };

  return (
    <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/25">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{preview.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-muted-foreground">
            {preview.org && <span title={preview.orgConfidence === "medium" ? preview.orgReason : undefined} className="inline-flex items-center gap-1"><OrgBadge org={preview.org} />{preview.orgConfidence === "medium" && <span className="text-primary">✦</span>}</span>}
            {areasToShow.length > 0 && <span title={preview.areaConfidence === "medium" ? preview.areaReason : undefined}>{areasToShow.join(" + ")}{preview.areaConfidence === "medium" && <span className="ml-1 text-primary">✦</span>}</span>}
            {assignees.length > 0 && <span title={preview.assigneeConfidence === "medium" ? preview.assigneeReason : undefined}>Assigned to {assignees.join(" + ")}{preview.assigneeConfidence === "medium" && <span className="ml-1 text-primary">✦</span>}</span>}
            {!preview.org && areasToShow.length === 0 && assignees.length === 0 && <span>Inbox</span>}
            <span>{statusLabel}</span>
            {preview.deadline && <span className="inline-flex items-center gap-1 font-mono"><Calendar className="h-3 w-3" />Deadline: {preview.deadline}</span>}
            {preview.targetDate && <span className="inline-flex items-center gap-1 font-mono"><Calendar className="h-3 w-3" />Target: {preview.targetDate}</span>}
            {preview.suggestedStatus === "blocked" && <span className="inline-flex items-center gap-1 text-overdue"><GitBranch className="h-3 w-3" />Blocked by {preview.blockedByTitle || "a dependency"}</span>}
            {preview.link && <span className="inline-flex items-center gap-1 text-info"><Link2 className="h-3 w-3" />Link attached</span>}
          </div>

          {!preview.org && candidateOrganizations.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground">Which organization is this for?</span>
              {candidateOrganizations.map(org => <button key={org.name} onClick={() => chooseOrganization(org.name)} className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary">{org.name}</button>)}
            </div>
          )}

          {editing && (
            <div className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-[10px] font-medium text-muted-foreground">Task title<input value={preview.title} onChange={event => onChange({ title: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></label>
              <label className="text-[10px] font-medium text-muted-foreground">Organization<select value={preview.org || ""} onChange={event => chooseOrganization(event.target.value as OrgName)} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground"><option value="">No organization</option>{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Lead area<select value={preview.area || ""} onChange={event => { const area = event.target.value as AreaName; onChange({ area: area || undefined, areaConfidence: "high", involvedAreas: area ? Array.from(new Set([...(preview.involvedAreas || []), area])) : preview.involvedAreas }); }} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground"><option value="">No lead area</option>{availableAreas.map(area => <option key={area}>{area}</option>)}</select></label>
              <div className="sm:col-span-2"><p className="text-[10px] font-medium text-muted-foreground">Involved areas</p><div className="mt-1 flex flex-wrap gap-1.5">{availableAreas.map(area => <button key={area} onClick={() => toggleArea(area)} className={cn("rounded-full border px-2.5 py-1 text-[10px] font-medium", preview.involvedAreas?.includes(area) ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{area}</button>)}</div></div>
              <label className="text-[10px] font-medium text-muted-foreground">Add assignee<select value="" onChange={event => addAssignee(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground"><option value="">Choose person or team</option>{getDirectoryAssignees(preview.org).filter(person => !preview.assigneeIds?.includes(person.id)).map(person => <option key={person.id} value={person.id}>{person.name}{person.type === "team" ? " · Team" : ""}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Project<select value={preview.project || ""} onChange={event => onChange({ project: event.target.value || undefined })} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground"><option value="">No project</option>{Object.values(PROJECT_DETAILS).filter(project => !preview.org || project.org === preview.org).map(project => <option key={project.id} value={project.name}>{project.name}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Status<select value={preview.suggestedStatus || "ready"} onChange={event => onChange({ suggestedStatus: event.target.value as TaskStatus })} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground">{PLANNING_COLUMNS.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Priority<select value={preview.priority} onChange={event => onChange({ priority: event.target.value as Priority, priorityExplicit: true })} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground">{Object.entries(PRIORITY_CONFIG).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Target date<input type="date" value={preview.dateKind === "target" ? preview.dateISO || "" : ""} onChange={event => updateDate("target", event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></label>
              <label className="text-[10px] font-medium text-muted-foreground">Deadline<input type="date" value={preview.dateKind === "deadline" ? preview.dateISO || "" : ""} onChange={event => updateDate("deadline", event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></label>
              <label className="text-[10px] font-medium text-muted-foreground">Follow-up date<input type="date" value={preview.followUpDate || ""} onChange={event => onChange({ followUpDate: event.target.value || undefined })} className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></label>
              <label className="text-[10px] font-medium text-muted-foreground">Blocked by <span className="font-normal">(optional)</span><input value={preview.blockedByTitle || ""} onChange={event => onChange({ blockedByTitle: event.target.value || undefined, suggestedStatus: event.target.value ? "blocked" : "ready" })} placeholder="Another task or decision" className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></label>
              <label className="text-[10px] font-medium text-muted-foreground">Notes <span className="font-normal">(optional)</span><input value={preview.notes || ""} onChange={event => onChange({ notes: event.target.value || undefined })} placeholder="Add context" className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></label>
            </div>
          )}
          <button onClick={() => setShowOriginal(current => !current)} className="mt-3 text-[10px] text-muted-foreground transition-colors hover:text-foreground">{showOriginal ? "Hide original" : "View original"}</button>
          {showOriginal && <p className="mt-1 text-[10px] italic text-muted-foreground">Original capture: {preview.originalText}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button onClick={onConfirm} disabled={!preview.title.trim()} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-45">Confirm</button>
          <button onClick={onToggleEdit} className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{editing ? "Close" : "Edit"}</button>
          <button onClick={onDiscard} aria-label={`Discard ${preview.title}`} className="rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-overdue/10 hover:text-overdue">Discard</button>
        </div>
      </div>
    </article>
  );
}

function QuickCapture({ organization, project, area, onSaved }: { organization?: OrgName; project?: string; area?: AreaName; onSaved?: () => void }) {
  const currentUserId = useContext(CurrentUserContext);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previews, setPreviews] = useState<InlineCapturePreview[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [undoTaskIds, setUndoTaskIds] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const captureInputRef = useRef<HTMLTextAreaElement>(null);

  function organize() {
    if (!input.trim()) return;
    setProcessing(true);
    setMessage("");
    setTimeout(() => {
      setPreviews(createCapturePreviews(input, organization, area, project, currentUserId));
      setEditing(null);
      setProcessing(false);
    }, 700);
  }

  function showSaveMessage(notice: string, taskIds: string[]) {
    setMessage(notice);
    setUndoTaskIds(taskIds);
    window.setTimeout(() => {
      setMessage("");
      setUndoTaskIds([]);
    }, 5000);
  }

  function undoSave() {
    undoTaskIds.forEach(deleteTask);
    onSaved?.();
    setUndoTaskIds([]);
    setMessage("Undone");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function updatePreview(index: number, patch: Partial<InlineCapturePreview>) {
    setPreviews(current => current.map((preview, previewIndex) => previewIndex === index ? { ...preview, ...patch } : preview));
  }

  function save(index: number) {
    const preview = previews[index];
    if (!preview?.title.trim()) return;
    rememberCaptureCorrection(preview.originalText, { org: preview.org, area: preview.area, assignee: preview.assignee });
    const created = saveCapturedTask(preview, attachments, { project, area }, currentUserId);
    onSaved?.();
    setPreviews(current => current.filter((_, previewIndex) => previewIndex !== index));
    setEditing(null);
    showSaveMessage(`Added to Binnie${preview.org ? ` · ${preview.org}` : " · Inbox"}${preview.area ? ` · ${preview.area}` : ""}`, [created.id]);
  }

  function saveAll() {
    const confirmable = previews.filter(preview => preview.title.trim());
    const created = confirmable.map(preview => { rememberCaptureCorrection(preview.originalText, { org: preview.org, area: preview.area, assignee: preview.assignee }); const task = saveCapturedTask(preview, attachments, { project, area }, currentUserId); onSaved?.(); return task; });
    setPreviews([]);
    setInput("");
    setEditing(null);
    showSaveMessage(`${confirmable.length} tasks added to your workspace.`, created.map(task => task.id));
  }

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    setAttachments(current => [...current, ...Array.from(files).map(file => file.name)].slice(0, 4));
  }

  function addLink() {
    const link = linkDraft.trim();
    if (!link) return;
    setInput(current => [current.trim(), link].filter(Boolean).join(" "));
    setLinkDraft("");
    setShowLinkInput(false);
    captureInputRef.current?.focus();
  }

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--theme-capture-border)] bg-[var(--theme-capture)] p-4 shadow-[0_10px_28px_rgb(35_41_61_/_0.055)] sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[var(--theme-capture-input)] opacity-75 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-24 h-16 w-16 rounded-full bg-[var(--theme-hero-accent)] blur-xl" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
            <div>
              <h2 className="binnie-heading text-[15px] font-bold text-foreground">Quick Capture</h2>
              <p className="text-[11px] text-muted-foreground">A thought is enough. Binnie handles the structure.</p>
            </div>
            {organization && <OrgBadge org={organization} />}{project && <span className="rounded-full bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">{project}</span>}
          </div>
          {message && <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">{message}{undoTaskIds.length > 0 && <button onClick={undoSave} className="font-semibold underline underline-offset-2">Undo</button>}</span>}
        </div>
        <textarea
          ref={captureInputRef}
          value={input}
          onChange={event => setInput(event.target.value)}
          rows={previews.length ? 2 : 3}
          placeholder="What do you need to remember or do?"
          className="w-full resize-none rounded-2xl border border-[var(--theme-capture-secondary-border)] bg-[var(--theme-capture-input)] px-3.5 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground/80 focus:border-primary/45"
        />
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((attachment, index) => <span key={`${attachment}-${index}`} className="rounded-full bg-[var(--theme-capture-input)] px-2 py-1 text-[10px] text-muted-foreground shadow-sm">{attachment}</span>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--theme-capture-input)] hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Attach file
            <input className="sr-only" type="file" multiple onChange={event => addAttachments(event.target.files)} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--theme-capture-input)] hover:text-foreground">
            <ImagePlus className="h-3.5 w-3.5" /> Screenshot
            <input className="sr-only" type="file" accept="image/*" multiple onChange={event => addAttachments(event.target.files)} />
          </label>
          <button onClick={() => setShowLinkInput(current => !current)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--theme-capture-input)] hover:text-foreground"><Link2 className="h-3.5 w-3.5" /> Add link</button>
          <button onClick={organize} disabled={!input.trim() || processing} className={cn("ml-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition-colors", input.trim() && !processing ? "binnie-capture-organize bg-primary text-primary-foreground hover:bg-primary/85" : "cursor-not-allowed bg-[var(--theme-capture-input)] text-muted-foreground") }>
            <Sparkles className="h-3.5 w-3.5" /> {processing ? "Organizing…" : "Organize with Binnie"}
          </button>
        </div>
        {showLinkInput && <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--theme-capture-secondary-border)] bg-[var(--theme-capture-input)] px-3 py-2"><Link2 className="h-3.5 w-3.5 flex-shrink-0 text-info" /><input autoFocus value={linkDraft} onChange={event => setLinkDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && addLink()} placeholder="Paste a link" className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground" /><button onClick={addLink} disabled={!linkDraft.trim()} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-medium text-primary disabled:opacity-45">Add</button></div>}
        {previews.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-[var(--theme-capture-divider)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium text-secondary-foreground">Binnie found {previews.length} {previews.length === 1 ? "task" : "tasks"}</p>
              {previews.length > 1 && <button onClick={saveAll} className="text-[11px] font-medium text-primary hover:text-primary/80">Confirm All</button>}
            </div>
            {previews.map((preview, index) => <CapturedWorkReviewCard
              key={`${preview.originalText}-${index}`}
              preview={preview}
              editing={editing === index}
              currentUserId={currentUserId}
              onChange={patch => updatePreview(index, patch)}
              onConfirm={() => save(index)}
              onDiscard={() => setPreviews(current => current.filter((_, previewIndex) => previewIndex !== index))}
              onToggleEdit={() => setEditing(editing === index ? null : index)}
            />)}
          </div>
        )}
      </div>
    </section>
  );
}

type HomeCardId =
  | "today" | "needs-attention" | "agenda" | "waiting-on-people" | "needs-my-review"
  | "follow-up" | "this-week" | "strategic-projects" | "recent-work" | "recently-completed" | "organization-workload";

interface HomeCardConfig { id: HomeCardId; visible: boolean }

const BINNIE_HOME_LAYOUT_STORAGE_KEY = "binnie-home-layout";
const BINNIE_SIDEBAR_COLLAPSED_STORAGE_KEY = "binnie-sidebar-collapsed";
const BINNIE_WORKSPACE_THEME_STORAGE_KEY = "binnie-workspace-theme";

// Compatibility migration for preferences saved before the Binnie rename.
const LEGACY_LUMA_STORAGE_KEYS = {
  homeLayout: "luma-home-layout",
  sidebarCollapsed: "luma-sidebar-collapsed",
  workspaceTheme: "luma-workspace-theme",
} as const;

function getStoredPreference(storageKey: string, legacyStorageKey: string) {
  const currentValue = window.localStorage.getItem(storageKey);
  if (currentValue !== null) return currentValue;

  const legacyValue = window.localStorage.getItem(legacyStorageKey);
  if (legacyValue === null) return null;

  window.localStorage.setItem(storageKey, legacyValue);
  window.localStorage.removeItem(legacyStorageKey);
  return legacyValue;
}

const HOME_CARD_META: { id: HomeCardId; label: string; description: string }[] = [
  { id: "today", label: "Today", description: "The work that is yours to move forward." },
  { id: "needs-attention", label: "Needs Attention", description: "Dates and decisions worth a gentle revisit." },
  { id: "agenda", label: "Agenda", description: "Time-based commitments for the day." },
  { id: "waiting-on-people", label: "Waiting on People", description: "Delegated work that needs a response." },
  { id: "needs-my-review", label: "Needs My Review", description: "Work that is ready for your decision." },
  { id: "follow-up", label: "Follow-Up", description: "People and conversations to nudge." },
  { id: "this-week", label: "This Week", description: "A quiet view of progress across organizations." },
  { id: "strategic-projects", label: "Strategic Projects", description: "Projects to continue when you have space." },
  { id: "recent-work", label: "Recent Work", description: "Tasks, projects, files, and links you opened recently." },
  { id: "recently-completed", label: "Recently Completed", description: "A small record of what is already handled." },
  { id: "organization-workload", label: "Organization Workload", description: "Where active work is currently sitting." },
];
const DEFAULT_HOME_CARDS: HomeCardConfig[] = HOME_CARD_META.map(card => ({ id: card.id, visible: true }));

function normalizeHomeCards(value: unknown): HomeCardConfig[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_CARDS;
  const cards = value.reduce<HomeCardConfig[]>((result, item) => {
    if (!item || typeof item !== "object") return result;
    const candidate = item as { id?: unknown; visible?: unknown };
    if (!HOME_CARD_META.some(card => card.id === candidate.id) || result.some(card => card.id === candidate.id)) return result;
    result.push({ id: candidate.id as HomeCardId, visible: typeof candidate.visible === "boolean" ? candidate.visible : true });
    return result;
  }, []);
  return [...cards, ...DEFAULT_HOME_CARDS.filter(defaultCard => !cards.some(card => card.id === defaultCard.id))];
}

function HomeLayoutDrawer({
  open, cards, onToggle, onMove, onReset, onClose,
}: {
  open: boolean; cards: HomeCardConfig[]; onToggle: (id: HomeCardId) => void;
  onMove: (id: HomeCardId, direction: -1 | 1) => void; onReset: () => void; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Customize Home">
      <button aria-label="Close customize home" onClick={onClose} className="absolute inset-0 cursor-default bg-foreground/10 backdrop-blur-[1px]" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-[#fcfcff] shadow-[-20px_0_50px_rgb(44_43_78_/_0.10)]">
        <div className="flex items-start justify-between border-b border-border px-5 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Your workspace</p>
            <h2 className="binnie-heading mt-1 text-xl font-bold text-foreground">Customize Home</h2>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Choose the cards that help you orient quickly, then arrange their order.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="space-y-2">
            {cards.map((card, index) => {
              const meta = HOME_CARD_META.find(item => item.id === card.id)!;
              return (
                <div key={card.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">{meta.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{meta.description}</p>
                  </div>
                  <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
                    <span className="hidden sm:inline">Visible</span>
                    <input type="checkbox" checked={card.visible} onChange={() => onToggle(card.id)} className="h-4 w-4 cursor-pointer rounded border-border accent-primary" aria-label={`Show ${meta.label} on Home`} />
                  </label>
                  <div className="flex flex-col rounded-lg border border-border bg-muted/30">
                    <button onClick={() => onMove(card.id, -1)} disabled={index === 0} className="rounded-t-lg p-1 text-muted-foreground transition-colors hover:bg-white hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${meta.label} up`}><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => onMove(card.id, 1)} disabled={index === cards.length - 1} className="rounded-b-lg border-t border-border p-1 text-muted-foreground transition-colors hover:bg-white hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${meta.label} down`}><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-6">
          <button onClick={onReset} className="rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Reset layout</button>
          <button onClick={onClose} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">Save layout</button>
        </div>
      </aside>
    </div>
  );
}

function HomeView({
  onTaskClick, onNavigate, onProjectClick, onOrgClick, userName,
}: {
  onTaskClick: (task: Task) => void; onNavigate: (view: NavView) => void;
  onProjectClick: (projectId: string) => void; onOrgClick: (org: OrgName) => void; userName: string;
}) {
  const currentUserId = useContext(CurrentUserContext) || DEFAULT_CURRENT_USER_ID;
  const workspaceDate = getWorkspaceCalendarDate();
  const todayTasks = getTasksForToday(TASKS, currentUserId);
  const overdueTasks = TASKS.filter(isTaskOverdue);
  const reviewTasks = TASKS.filter(t => t.status === "review" && taskIsForCurrentUser(t, currentUserId));
  const delegatedTasks = getDelegatedTasks(TASKS, currentUserId);
  const waitingTasks = getWaitingTasks(TASKS);
  const waitingPeople = Array.from(new Map(waitingTasks.flatMap(task => taskAssigneeNames(task).map(name => [name, task] as const))).entries()).map(([name, task]) => ({ name, outstanding: waitingTasks.filter(item => taskAssigneeNames(item).includes(name)).length, overdue: waitingTasks.filter(item => taskAssigneeNames(item).includes(name) && isTaskOverdue(item)).length, oldest: task.waitingSince || "Recently" }));
  const weeklyTasks = getTasksForWeek(TASKS);
  const weekOrgs: { org: OrgName; tasks: number; done: number }[] = (["Villa Khayangan", "Apotik", "Personal"] as OrgName[]).map(org => ({ org, tasks: weeklyTasks.filter(task => task.org === org).length, done: TASKS.filter(task => task.org === org && task.status === "done").length }));
  const [homeCards, setHomeCards] = useState<HomeCardConfig[]>(DEFAULT_HOME_CARDS);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const completedTasks = TASKS.filter(task => task.status === "done");

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const savedLayout = getStoredPreference(BINNIE_HOME_LAYOUT_STORAGE_KEY, LEGACY_LUMA_STORAGE_KEYS.homeLayout);
        if (savedLayout) setHomeCards(normalizeHomeCards(JSON.parse(savedLayout)));
      } catch {
        // A saved layout is optional; the default workspace is always usable.
      } finally {
        setLayoutLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (!layoutLoaded) return;
    window.localStorage.setItem(BINNIE_HOME_LAYOUT_STORAGE_KEY, JSON.stringify(homeCards));
  }, [homeCards, layoutLoaded]);

  const cardClass = (id: HomeCardId, base: string) => cn(base, !homeCards.find(card => card.id === id)?.visible && "hidden");
  const cardStyle = (id: HomeCardId) => ({ order: homeCards.findIndex(card => card.id === id) });
  const toggleCard = (id: HomeCardId) => setHomeCards(cards => cards.map(card => card.id === id ? { ...card, visible: !card.visible } : card));
  const moveCard = (id: HomeCardId, direction: -1 | 1) => setHomeCards(cards => {
    const index = cards.findIndex(card => card.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= cards.length) return cards;
    const reordered = [...cards];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered;
  });
  return (
    <div className="mx-auto max-w-[1400px] p-5 sm:p-8 lg:p-10">
      <div className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-border bg-[var(--theme-hero)] px-5 py-6 shadow-[0_4px_18px_rgb(35_41_61_/_0.035)] sm:px-7">
        <div aria-hidden="true" className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--theme-hero-glow)] blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-0 right-32 h-20 w-20 rounded-full bg-[var(--theme-hero-accent)] blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{formatWorkspaceDate(workspaceDate, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="binnie-heading text-3xl font-bold text-foreground sm:text-[2rem]">Welcome Back, {userName}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Here’s what needs your attention today. Everything else is safely organized for later.</p>
          </div>
          <button onClick={() => setIsCustomizing(true)} className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-white/80 px-3.5 py-2 text-[12px] font-medium text-primary shadow-sm transition-colors hover:bg-primary/10">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Customize Home
          </button>
        </div>
      </div>
      <QuickCapture />
      <div className="mb-8 mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[
          { label: "Today", value: todayTasks.length, sub: "~5h of focused work", color: "text-primary", surface: "binnie-summary-today bg-[#eae6ff]/55", icon: <CalendarDays className="w-4 h-4" />, view: "today" as NavView },
          { label: "Needs attention", value: overdueTasks.length, sub: "A gentle nudge", color: "text-overdue", surface: "binnie-summary-attention bg-[#f7dde6]/45", icon: <AlertTriangle className="w-4 h-4" />, view: "overdue" as NavView },
          { label: "Delegated", value: delegatedTasks.length, sub: "Across your teams", color: "text-success", surface: "binnie-summary-delegated bg-[#dcede7]/55", icon: <Users className="w-4 h-4" />, view: "delegated" as NavView },
          { label: "Waiting", value: waitingTasks.length, sub: "For a response", color: "text-info", surface: "binnie-summary-waiting bg-[#ddebfa]/55", icon: <Hourglass className="w-4 h-4" />, view: "waiting" as NavView },
        ].map(({ label, value, sub, color, surface, icon, view }) => (
          <button key={label} onClick={() => onNavigate(view)} className={cn("binnie-card binnie-card-hover p-4 text-left sm:p-5", surface)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
              <span className={cn(color, "opacity-60")}>{icon}</span>
            </div>
            <p className={cn("binnie-heading text-3xl font-bold", color)}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={cardClass("today", "binnie-card overflow-hidden lg:col-span-2")} style={cardStyle("today")}>
            <div className="binnie-summary-today flex items-center justify-between border-b border-border bg-[#eae6ff]/35 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <h2 className="binnie-heading text-[15px] font-bold text-foreground">Today</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-muted-foreground">
                  <Timer className="w-3 h-3 inline mr-1" />
                  ~{todayTasks.reduce((a, t) => a + (t.estimatedHours || 0), 0)}h estimated
                </span>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium text-secondary-foreground">{todayTasks.length} tasks</span>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {todayTasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} compact />)}
              {todayTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success/45" />Nothing urgent right now.
                </div>
              )}
            </div>
          </div>
          <div className={cardClass("needs-attention", "binnie-card overflow-hidden")} style={cardStyle("needs-attention")}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-warning" />
              <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
            </div>
            <div className="divide-y divide-border">
              {overdueTasks.length > 0 && (
                <div className="p-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.09em] text-overdue">Target dates to revisit</p>
                  <div className="space-y-1.5">
                    {overdueTasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} compact />)}
                  </div>
                </div>
              )}
              {reviewTasks.length > 0 && (
                <div className="p-4">
                  <p className="text-[11px] font-mono text-pink-400 uppercase tracking-wider mb-2">Submitted for Review</p>
                  <div className="space-y-1.5">
                    {reviewTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-3 rounded-xl border border-review/20 bg-review/[0.045] p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t.assignee} submitted · {t.org} · {t.area}</p>
                        </div>
                        <button onClick={() => onTaskClick(t)} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary">Open review</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={cardClass("recent-work", "binnie-card overflow-hidden")} style={cardStyle("recent-work")}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /><h2 className="text-sm font-semibold text-foreground">Recent Work</h2></div>
              <button onClick={() => onNavigate("all-tasks")} className="text-[11px] font-medium text-primary hover:text-primary/80">View All</button>
            </div>
            <div className="p-2.5">
              {[
                { label: "Purchasing System", sub: "Project · Villa Khayangan", type: "project" as const, id: "p1" },
                { label: "Supplier Comparison.xlsx", sub: "File · Purchasing System", type: "file" as const, taskId: "t2" },
                { label: "Khayangan Website", sub: "Website · Villa Khayangan", type: "website" as const, taskId: "t1" },
                { label: "Review accommodation prices", sub: "Task · Marketing", type: "task" as const, taskId: "t1" },
                { label: "Villa Khayangan", sub: "Organization", type: "organization" as const, org: "Villa Khayangan" as OrgName },
              ].map(item => {
                const Icon = item.type === "project" ? FolderKanban : item.type === "file" ? FileText : item.type === "website" ? Globe : item.type === "organization" ? Building2 : ListTodo;
                const onClick = () => {
                  if (item.type === "project") onProjectClick(item.id);
                  else if (item.type === "organization") onOrgClick(item.org);
                  else onTaskClick(TASKS.find(task => task.id === item.taskId)!);
                };
                return <button key={item.label} onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/55"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary"><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{item.label}</span><span className="block truncate text-[11px] text-muted-foreground">{item.sub}</span></span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></button>;
              })}
            </div>
          </div>
          <div className={cardClass("waiting-on-people", "binnie-card overflow-hidden")} style={cardStyle("waiting-on-people")}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-info" />
              <h2 className="text-sm font-semibold text-foreground">Waiting on People</h2>
            </div>
            <div className="p-3 space-y-2">
              {waitingPeople.map(person => {
                const color = getPersonColor(person.name);
                return (
                  <button key={person.name} onClick={() => onNavigate("delegated")} className="flex w-full items-center gap-3 rounded-xl bg-muted/55 p-3 text-left transition-colors hover:bg-secondary">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={personColorStyle(color)}>
                      {getInitials(person.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{person.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{person.outstanding} outstanding · Oldest: {person.oldest}</p>
                    </div>
                    {person.overdue > 0 && <span className="rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">{person.overdue} due</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={cardClass("this-week", "binnie-card overflow-hidden")} style={cardStyle("this-week")}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-success" />
              <h2 className="text-sm font-semibold text-foreground">This Week</h2>
            </div>
            <div className="p-4 space-y-3">
              {weekOrgs.map(({ org, tasks, done }) => {
                const c = ORG_COLORS[org];
                const pct = Math.round((done / tasks) * 100);
                return (
                  <button key={org} onClick={() => onOrgClick(org)} className="block w-full rounded-lg p-1 text-left transition-colors hover:bg-muted/55">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("text-[12px] font-medium", c.text)}>{org}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{done}/{tasks}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={cardClass("strategic-projects", "binnie-card overflow-hidden")} style={cardStyle("strategic-projects")}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-review" />
              <h2 className="text-sm font-semibold text-foreground">Strategic Projects</h2>
            </div>
            <div className="p-3 space-y-2">
              {STRATEGIC_PROJECTS.map(proj => {
                const c = ORG_COLORS[proj.org];
                return (
                  <button key={proj.id} onClick={() => onProjectClick(proj.id)} className="w-full rounded-lg bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[13px] font-medium text-foreground leading-snug">{proj.name}</p>
                      <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", c.bg, c.text)}>{proj.progress}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${proj.progress}%` }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <OrgBadge org={proj.org} />
                      <span className="text-[11px] text-muted-foreground ml-auto">{proj.tasks - proj.done} remaining</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={cardClass("agenda", "binnie-card overflow-hidden")} style={cardStyle("agenda")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-info" /><div><h2 className="text-sm font-semibold text-foreground">Agenda</h2><p className="text-[10px] text-muted-foreground">Time-based commitments · Today</p></div></div>
            <div className="divide-y divide-border px-4 py-1">
              {[
                { time: "09:30", title: "Finance Meeting", context: "Villa Khayangan", taskId: "t2" },
                { time: "11:00", title: "Review Purchasing Flow", context: "Purchasing System", taskId: "t2" },
                { time: "14:00", title: "Marketing Check-In", context: "Villa Khayangan", taskId: "t1" },
                { time: "All day", title: "Finish Apotik Stock Review", context: "Apotik", taskId: "t3" },
              ].map(item => (
                <button key={item.title} onClick={() => onTaskClick(TASKS.find(task => task.id === item.taskId)!)} className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/45">
                  <span className="w-12 flex-shrink-0 text-[11px] font-medium text-info">{item.time}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{item.title}</span><span className="block truncate text-[11px] text-muted-foreground">{item.context}</span></span><ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
          <div className={cardClass("needs-my-review", "binnie-card overflow-hidden")} style={cardStyle("needs-my-review")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-review" /><h2 className="text-sm font-semibold text-foreground">Needs My Review</h2></div>
            <div className="p-3 space-y-1.5">
              {reviewTasks.length ? reviewTasks.map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="flex w-full items-center gap-3 rounded-xl bg-review/[0.05] p-3 text-left transition-colors hover:bg-review/[0.10]"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-review/15 text-review"><Eye className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{task.title}</span><span className="block truncate text-[11px] text-muted-foreground">{task.assignee} · {task.org}</span></span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></button>) : <p className="px-2 py-5 text-center text-[12px] text-muted-foreground">Nothing waiting for your review.</p>}
            </div>
          </div>
          <div className={cardClass("follow-up", "binnie-card overflow-hidden")} style={cardStyle("follow-up")}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-warning" /><h2 className="text-sm font-semibold text-foreground">Follow-Up</h2></div><button onClick={() => onNavigate("followup")} className="text-[11px] font-medium text-primary hover:text-primary/80">View Follow-Ups</button></div>
            <div className="p-3 space-y-2">
              {FOLLOWUP_DATA.slice(0, 3).map(person => { const overdue = person.items.filter(item => item.status === "overdue").length; const oldest = Math.max(...person.items.map(item => item.daysWaiting)); return <button key={person.person} onClick={() => onNavigate("followup")} className="flex w-full items-center gap-3 rounded-xl bg-muted/45 p-3 text-left transition-colors hover:bg-muted/75"><Avatar name={person.person} size="sm" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-foreground">{person.person}</span><span className="block text-[11px] text-muted-foreground">{person.items.length} items · Oldest waiting: {oldest} days</span></span>{overdue > 0 && <span className="rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">{overdue} overdue</span>}</button>; })}
            </div>
          </div>
          <div className={cardClass("recently-completed", "binnie-card overflow-hidden")} style={cardStyle("recently-completed")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-success" /><h2 className="text-sm font-semibold text-foreground">Recently Completed</h2></div>
            <div className="p-3 space-y-1.5">
              {completedTasks.length ? completedTasks.slice(0, 3).map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-success/[0.06]"><CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{task.title}</span><span className="block text-[11px] text-muted-foreground">{task.org} · {task.area}</span></span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></button>) : <p className="px-2 py-5 text-center text-[12px] text-muted-foreground">Nothing to show just yet.</p>}
            </div>
          </div>
          <div className={cardClass("organization-workload", "binnie-card overflow-hidden")} style={cardStyle("organization-workload")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-primary" /><h2 className="text-sm font-semibold text-foreground">Organization Workload</h2></div>
            <div className="p-4 space-y-3">
              {(["Villa Khayangan", "Apotik", "Personal"] as OrgName[]).map(org => { const active = TASKS.filter(task => task.org === org && task.status !== "done").length; const total = TASKS.filter(task => task.org === org).length; const color = ORG_COLORS[org]; return <button key={org} onClick={() => onOrgClick(org)} className="block w-full rounded-xl p-1 text-left transition-colors hover:bg-muted/55"><div className="mb-1.5 flex items-center justify-between"><span className={cn("text-[12px] font-medium", color.text)}>{org}</span><span className="text-[11px] text-muted-foreground">{active} active</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((active / total) * 100)}%` }} /></div></button>; })}
            </div>
          </div>
        </div>
      <HomeLayoutDrawer open={isCustomizing} cards={homeCards} onToggle={toggleCard} onMove={moveCard} onReset={() => setHomeCards(DEFAULT_HOME_CARDS)} onClose={() => setIsCustomizing(false)} />
    </div>
  );
}

// ─── SMART INBOX VIEW ─────────────────────────────────────────────────────────

type CaptureConfidence = "high" | "medium" | "low" | "unknown";
type CaptureDateKind = "deadline" | "target";
interface ParsedTask {
  title: string;
  org?: OrgName;
  area?: AreaName;
  involvedAreas?: AreaName[];
  assignee?: string;
  assigneeIds?: string[];
  contributorIds?: string[];
  deadline?: string;
  targetDate?: string;
  followUpDate?: string;
  dateISO?: string;
  dateKind?: CaptureDateKind;
  priority: Priority;
  priorityExplicit?: boolean;
  originalText: string;
  link?: string;
  project?: string;
  suggestedStatus?: TaskStatus;
  blockedByTitle?: string;
  notes?: string;
  orgConfidence: CaptureConfidence;
  areaConfidence: CaptureConfidence;
  assigneeConfidence: CaptureConfidence;
  dateConfidence: CaptureConfidence;
  overallConfidence: CaptureConfidence;
  orgReason?: string;
  areaReason?: string;
  assigneeReason?: string;
}

function InboxView() {
  const currentUserId = useContext(CurrentUserContext);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<InlineCapturePreview[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [undoTaskIds, setUndoTaskIds] = useState<string[]>([]);

  function handleProcess() {
    if (!input.trim()) return;
    setProcessing(true);
    setTimeout(() => { setEditing(null); setProcessing(false); setParsed(createCapturePreviews(input, undefined, undefined, undefined, currentUserId)); }, 700);
  }

  function showSaveMessage(notice: string, taskIds: string[]) {
    setMessage(notice);
    setUndoTaskIds(taskIds);
    window.setTimeout(() => {
      setMessage("");
      setUndoTaskIds([]);
    }, 5000);
  }

  function undoSave() {
    undoTaskIds.forEach(deleteTask);
    setUndoTaskIds([]);
    setMessage("Undone");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    setAttachments(current => [...current, ...Array.from(files).map(file => file.name)].slice(0, 4));
  }

  function addLink() {
    const link = linkDraft.trim();
    if (!link) return;
    setAttachments(current => [...current, link].slice(0, 4));
    setLinkDraft("");
    setShowLinkInput(false);
  }

  function updateParsed(index: number, patch: Partial<InlineCapturePreview>) {
    setParsed(current => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task));
  }

  function confirmTask(index: number) {
    const task = parsed[index];
    if (!task?.title.trim()) return;
    rememberCaptureCorrection(task.originalText, { org: task.org, area: task.area, assignee: task.assignee });
    const created = saveCapturedTask(task, attachments, undefined, currentUserId);
    setParsed(current => current.filter((_, taskIndex) => taskIndex !== index));
    setEditing(null);
    showSaveMessage(`Added to Binnie${task.org ? ` · ${task.org}` : " · Inbox"}${task.area ? ` · ${task.area}` : ""}`, [created.id]);
  }

  function confirmAll() {
    const tasks = parsed.filter(task => task.title.trim());
    const created = tasks.map(task => { rememberCaptureCorrection(task.originalText, { org: task.org, area: task.area, assignee: task.assignee }); return saveCapturedTask(task, attachments, undefined, currentUserId); });
    setParsed([]);
    setInput("");
    setEditing(null);
    showSaveMessage(`${tasks.length} tasks added to your workspace.`, created.map(task => task.id));
  }

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Smart Inbox</p>
        <h1 className="binnie-heading text-3xl font-bold text-foreground">A place to set it down.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Write whatever is on your mind. Tasks, reminders, ideas, follow-ups, or anything you want to remember. Binnie will turn it into clear next steps.</p>
        </div>
        {message && <span role="status" className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-[11px] font-medium text-success">{message}{undoTaskIds.length > 0 && <button onClick={undoSave} className="font-semibold underline underline-offset-2">Undo</button>}</span>}
      </div>
      <div className="binnie-card mb-6 overflow-hidden focus-within:border-primary/40">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="Write whatever is on your mind…"
          className="min-h-[180px] w-full resize-none bg-transparent p-5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground sm:p-6" />
        {attachments.length > 0 && <div className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-6">{attachments.map((attachment, index) => <span key={`${attachment}-${index}`} className="inline-flex max-w-full truncate rounded-full bg-secondary px-2.5 py-1 text-[10px] text-secondary-foreground">{attachment}</span>)}</div>}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-1">
            <label className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><Paperclip className="w-3.5 h-3.5" /> File<input className="sr-only" type="file" multiple onChange={event => addAttachments(event.target.files)} /></label>
            <button onClick={() => setShowLinkInput(current => !current)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><Link2 className="w-3.5 h-3.5" /> Link</button>
            <label className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><FileText className="w-3.5 h-3.5" /> Doc<input className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md" multiple onChange={event => addAttachments(event.target.files)} /></label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {input && <span className="text-[11px] font-mono text-muted-foreground">{input.length} chars</span>}
            <button onClick={handleProcess} disabled={!input.trim() || processing}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                input.trim() && !processing ? "binnie-capture-organize bg-primary text-primary-foreground hover:bg-primary/85" : "cursor-not-allowed bg-muted text-muted-foreground")}>
              {processing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Organizing…</> : <><Sparkles className="w-3.5 h-3.5" />Organize with Binnie</>}
            </button>
          </div>
        </div>
        {showLinkInput && <div className="flex items-center gap-2 border-t border-border bg-muted/25 px-4 py-3 sm:px-6"><Link2 className="h-3.5 w-3.5 flex-shrink-0 text-info" /><input autoFocus value={linkDraft} onChange={event => setLinkDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && addLink()} placeholder="Paste a link" className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground" /><button onClick={addLink} disabled={!linkDraft.trim()} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary disabled:opacity-45">Add link</button></div>}
      </div>
      {processing && (
        <div className="binnie-card mb-6 border-primary/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Put it down. Binnie sorts it out.</p>
              <p className="text-[11px] text-muted-foreground">Looking for tasks, people, dates, and helpful context</p>
            </div>
          </div>
          <div className="space-y-2">
            {["Identifying tasks and sub-tasks…", "Detecting organizations and areas…", "Extracting people and deadlines…"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                <span className="text-[12px] text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {parsed.length > 0 && !processing && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium text-muted-foreground">Binnie found {parsed.length} {parsed.length === 1 ? "task" : "tasks"}</p>
            {parsed.length > 1 && <button onClick={confirmAll} className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80">Confirm All</button>}
          </div>
          <div className="space-y-3">
            {parsed.map((preview, index) => <CapturedWorkReviewCard
              key={`${preview.originalText}-${index}`}
              preview={preview}
              editing={editing === index}
              currentUserId={currentUserId}
              onChange={patch => updateParsed(index, patch)}
              onConfirm={() => confirmTask(index)}
              onDiscard={() => setParsed(current => current.filter((_, taskIndex) => taskIndex !== index))}
              onToggleEdit={() => setEditing(editing === index ? null : index)}
            />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DELEGATED VIEW ───────────────────────────────────────────────────────────

function DelegatedView({ onTaskClick, onFollowUp, onPersonClick }: { onTaskClick: (task: Task) => void; onFollowUp: () => void; onPersonClick: (person: string) => void }) {
  const currentUserId = useContext(CurrentUserContext) || DEFAULT_CURRENT_USER_ID;
  const delegated = getDelegatedTasks(TASKS, currentUserId);
  const byPerson: Record<string, Task[]> = {};
  delegated.forEach(t => { if (t.assignee) { byPerson[t.assignee] = [...(byPerson[t.assignee] || []), t]; } });

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Delegated</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Delegated Work</h1>
        <p className="text-sm text-muted-foreground mt-1">{delegated.length} tasks across {Object.keys(byPerson).length} people</p>
      </div>
      <div className="space-y-6">
        {Object.entries(byPerson).map(([person, tasks]) => {
          const color = getPersonColor(person);
          const overdue = tasks.filter(t => t.isOverdue).length;
          return (
            <div key={person} className="binnie-card overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={personColorStyle(color)}>
                  {getInitials(person)}
                </div>
                <button onClick={() => onPersonClick(person)} className="flex-1 text-left">
                  <h2 className="text-sm font-semibold text-foreground">{person}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{tasks.length} active · Last update: {tasks[0]?.lastUpdate || "Unknown"}</p>
                </button>
                <div className="flex items-center gap-2">
                  {overdue > 0 && <span className="rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">{overdue} to revisit</span>}
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{tasks.length} tasks</span>
                  <button onClick={onFollowUp} aria-label={`Follow up with ${person}`} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><Send className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {tasks.map(task => (
                  <button key={task.id} onClick={() => onTaskClick(task)}
                    className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary/25 hover:bg-primary/[0.025]", task.isOverdue ? "border-overdue/20 bg-overdue/[0.035]" : "border-transparent bg-muted/45")}>
                    <PriorityDot priority={task.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5"><OrgBadge org={task.org} /><span className="text-muted-foreground text-[11px]">·</span><AreaBadge area={task.area} /></div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {task.waitingSince && <p className="text-[11px] font-mono text-muted-foreground">Waiting {task.waitingSince}</p>}
                      {task.isOverdue && <p className="text-[10px] font-medium text-overdue">Response due for a check-in</p>}
                      {task.deadline && !task.isOverdue && <p className="text-[11px] font-mono text-muted-foreground">Due {task.deadline}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── NEEDS MY REVIEW VIEW ─────────────────────────────────────────────────────

function ReviewView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const [, setRevision] = useState(0);
  const reviewTasks = TASKS.filter(t => t.status === "review" && t.nextActionBy === "me");
  function approve(task: Task) {
    Object.assign(task, { status: "done" as TaskStatus, isWaiting: false, isOverdue: false, nextActionBy: "me", lastUpdate: "Approved just now" });
    commitTaskStore();
    setRevision(current => current + 1);
  }
  function requestRevision(task: Task) {
    Object.assign(task, { status: "ready" as TaskStatus, isWaiting: false, nextActionBy: task.assignee || "me", lastUpdate: "Revision requested just now" });
    commitTaskStore();
    setRevision(current => current + 1);
  }
  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Review Queue</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Needs My Review</h1>
        <p className="text-sm text-muted-foreground mt-1">{reviewTasks.length} submissions waiting for your response</p>
      </div>
      <div className="space-y-4">
        {reviewTasks.map(task => {
          const submitActivity = task.activity?.find(a => a.type === "submitted");
          return (
            <div key={task.id} className="binnie-card overflow-hidden border-review/20">
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  {task.assignee && <Avatar name={task.assignee} size="md" />}
                  <div className="flex-1">
                    <p className="text-[12px] text-muted-foreground mb-1">{task.assignee} submitted for review · {submitActivity?.time || "Recently"}</p>
                    <h3 className="text-base font-semibold text-foreground">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <OrgBadge org={task.org} /><span className="text-muted-foreground text-[11px]">·</span><AreaBadge area={task.area} />
                    </div>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </div>
                {task.files && (
                  <div className="flex gap-2 mb-4">
                    {task.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border text-[11px] text-muted-foreground">
                        <FileText className="w-3 h-3" />{f.name}
                      </div>
                    ))}
                  </div>
                )}
                {task.links && (
                  <div className="flex gap-2 mb-4">
                    {task.links.map((l, i) => l.url === "#" ? <span key={i} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground"><LinkIcon type={l.type} />{l.label} · not connected</span> : (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-info transition-colors hover:text-foreground"><LinkIcon type={l.type} />{l.label}</a>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => approve(task)} className="flex items-center gap-1.5 rounded-xl bg-success/10 px-4 py-2 text-[13px] font-medium text-success transition-colors hover:bg-success/15"><Check className="w-4 h-4" /> Approve</button>
                  <button onClick={() => requestRevision(task)} className="flex items-center gap-1.5 rounded-xl bg-warning/10 px-4 py-2 text-[13px] font-medium text-warning transition-colors hover:bg-warning/15"><RotateCcw className="w-4 h-4" /> Request Revision</button>
                  <button onClick={() => onTaskClick(task)} className="ml-auto flex items-center gap-1.5 rounded-xl bg-muted px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><Eye className="w-4 h-4" /> Open Details</button>
                </div>
              </div>
            </div>
          );
        })}
        {reviewTasks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-sm">Nothing waiting for your review.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WAITING VIEW ─────────────────────────────────────────────────────────────

function WaitingView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const currentUserId = useContext(CurrentUserContext) || DEFAULT_CURRENT_USER_ID;
  const [tab, setTab] = useState<"others" | "me" | "blocked" | "external">("others");
  const tabs = [
    { id: "others" as const, label: "Waiting on Others", tasks: getWaitingTasks(TASKS).filter(t => getTaskAssigneeIds(t).some(id => id !== currentUserId)) },
    { id: "me" as const, label: "Waiting on Me", tasks: TASKS.filter(t => t.status === "review" && taskIsForCurrentUser(t, currentUserId)) },
    { id: "blocked" as const, label: "Blocked", tasks: TASKS.filter(t => t.status === "blocked") },
    { id: "external" as const, label: "External", tasks: getWaitingTasks(TASKS).filter(t => !getTaskAssigneeIds(t).length) },
  ];
  const current = tabs.find(t => t.id === tab)!;
  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Status Board</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Waiting</h1>
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/45 p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-shrink-0 px-3 py-2 text-[12px] font-medium transition-all", tab === t.id ? "rounded-lg border border-border bg-card text-foreground shadow-sm" : "rounded-lg text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.tasks.length > 0 && <span className={cn("ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{t.tasks.length}</span>}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {current.tasks.map(task => (
          <button key={task.id} onClick={() => onTaskClick(task)}
            className="binnie-card binnie-card-hover w-full p-4 text-left">
            <div className="flex items-start gap-3">
              <PriorityDot priority={task.priority} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">{task.title}</p>
                <div className="flex items-center gap-2 mb-2 flex-wrap"><OrgBadge org={task.org} /><AreaBadge area={task.area} /></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Next Action By", value: task.nextActionBy === "me" ? "You" : task.nextActionBy },
                    { label: "Waiting Since", value: task.waitingSince || "—" },
                    { label: "Response Due", value: task.responseDue || task.deadline || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">{label}</p>
                      <p className="text-[12px] font-mono text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
        {current.tasks.length === 0 && (
          <div className="py-12 text-center text-muted-foreground"><Hourglass className="mx-auto mb-3 h-10 w-10 opacity-20" /><p className="text-sm">You’re not waiting on anyone right now.</p></div>
        )}
      </div>
    </div>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────

function TodayView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const currentUserId = useContext(CurrentUserContext) || DEFAULT_CURRENT_USER_ID;
  const todayTasks = getTasksForToday(TASKS, currentUserId);
  const workspaceDate = getWorkspaceCalendarDate();
  return (
    <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{formatWorkspaceDate(workspaceDate, { weekday: "long", day: "numeric", month: "short" })}</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Today</h1>
        <p className="text-sm text-muted-foreground mt-1">{todayTasks.length} tasks · ~{todayTasks.reduce((a, t) => a + (t.estimatedHours || 0), 0)}h estimated</p>
      </div>
      <div className="space-y-2">
        {todayTasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />)}
      </div>
    </div>
  );
}

// ─── OVERDUE VIEW ─────────────────────────────────────────────────────────────

function OverdueView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const overdue = TASKS.filter(isTaskOverdue);
  return (
    <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-overdue">A few dates to revisit</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Overdue</h1>
        <p className="text-sm text-muted-foreground mt-1">{overdue.length} tasks past their deadline</p>
      </div>
      <div className="space-y-2">
        {overdue.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />)}
        {overdue.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-sm">Nothing urgent right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── THIS WEEK VIEW ───────────────────────────────────────────────────────────

function ThisWeekView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const workspaceDate = getWorkspaceCalendarDate();
  const weekdayIndex = (workspaceDate.getUTCDay() + 6) % 7;
  const monday = new Date(workspaceDate);
  monday.setUTCDate(workspaceDate.getUTCDate() - weekdayIndex);
  const weekDays = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { date, index, label: formatWorkspaceDate(date, { weekday: "short", day: "numeric" }) };
  });
  const weekTasks = getTasksForWeek(TASKS, monday);
  return (
    <div className="h-full overflow-auto p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Week of {formatWorkspaceDate(monday, { day: "numeric", month: "short" })}</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>This Week</h1>
      </div>
      <div className="overflow-x-auto pb-2">
      <div className="grid min-h-[400px] min-w-[58rem] grid-cols-[repeat(5,minmax(10rem,1fr))] gap-4">
        {weekDays.map(({ date, index, label }) => {
          const tasks = weekTasks.filter(task => getTaskRelevantDate(task) === isoDate(date));
          const isToday = index === weekdayIndex;
          const tint = ["bg-[#eae6ff]/60", "bg-[#dcede7]/60", "bg-[#ddebfa]/60", "bg-[#f8e3d3]/55", "bg-[#f5e7b8]/45"][index];
          return (
            <div key={date.toISOString()} className={cn("binnie-board-column flex flex-col", tint, isToday && "border-primary/45 shadow-[0_8px_22px_rgb(142_148_242_/_0.10)]")}>
              <div className={cn("border-b px-2 pb-3", isToday ? "border-primary/25" : "border-border/75")}>
                <p className={cn("text-[12px] font-semibold", isToday ? "text-primary" : "text-foreground")}>{label}{isToday && <span className="ml-1.5 rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">Today</span>}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{tasks.length} tasks</p>
              </div>
              <div className="space-y-2.5 pt-3 flex-1">
                {tasks.map(t => (
                  <button key={t.id} onClick={() => onTaskClick(t)}
                    className="w-full rounded-xl border border-white/80 bg-white/85 p-3 text-left shadow-[0_2px_8px_rgb(35_41_61_/_0.035)] transition-all hover:-translate-y-px hover:bg-white">
                    <div className="flex items-start gap-1.5"><PriorityDot priority={t.priority} /><p className="text-[11px] text-foreground leading-snug">{t.title}</p></div>
                    <div className="mt-1"><OrgBadge org={t.org} /></div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ─── ALL TASKS VIEW (NEW) ─────────────────────────────────────────────────────

type QuickFilter = "no-deadline" | "due-soon" | "overdue" | "review" | "has-files" | "high-priority";
type SortBy = "deadline" | "priority" | "updated" | "org";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as a migration fallback while task data is local mock state.
function LegacyAllTasksView({ onTaskClick, onNewTask }: { onTaskClick: (task: Task) => void; onNewTask: () => void }) {
  const [search, setSearch] = useState("");
  const [secondaryFilters, setSecondaryFilters] = useState<QuickFilter[]>([]);
  const [ownershipTab, setOwnershipTab] = useState<"all" | "mine" | "delegated" | "waiting" | "done">("all");
  const [taskLayout, setTaskLayout] = useState<"list" | "board">("list");
  const [sortBy, setSortBy] = useState<SortBy>("deadline");
  const [showFilters, setShowFilters] = useState(false);
  const [filterOrg, setFilterOrg] = useState<OrgName | null>(null);
  const [filterArea, setFilterArea] = useState<AreaName | null>(null);
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [filterDeadline, setFilterDeadline] = useState<"all" | "today" | "tomorrow" | "overdue" | "no-deadline">("all");

  const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  let tasks = TASKS.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.org.toLowerCase().includes(q) && !t.area.toLowerCase().includes(q) && !(t.assignee || "").toLowerCase().includes(q)) return false;
    }
    if (filterOrg && t.org !== filterOrg) return false;
    if (filterArea && t.area !== filterArea) return false;
    if (filterProject && t.project !== filterProject) return false;
    if (filterAssignee && t.assignee !== filterAssignee) return false;
    if (ownershipTab === "mine" && t.nextActionBy !== "me") return false;
    if (ownershipTab === "delegated" && !t.isDelegated) return false;
    if (ownershipTab === "waiting" && !t.isWaiting) return false;
    if (ownershipTab === "done" && t.status !== "done") return false;
    if (filterDeadline === "today" && !t.isToday && t.deadline !== "Today") return false;
    if (filterDeadline === "tomorrow" && t.deadline !== "Tomorrow") return false;
    if (filterDeadline === "overdue" && !t.isOverdue) return false;
    if (filterDeadline === "no-deadline" && t.deadline) return false;
    if (secondaryFilters.includes("no-deadline") && t.deadline) return false;
    if (secondaryFilters.includes("overdue") && !t.isOverdue) return false;
    if (secondaryFilters.includes("due-soon") && !t.isToday && t.deadline !== "Tomorrow") return false;
    if (secondaryFilters.includes("review") && t.status !== "review") return false;
    if (secondaryFilters.includes("has-files") && !t.files?.length) return false;
    if (secondaryFilters.includes("high-priority") && t.priority !== "urgent" && t.priority !== "high") return false;
    return true;
  });

  tasks = [...tasks].sort((a, b) => {
    if (sortBy === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortBy === "org") return a.org.localeCompare(b.org);
    return 0;
  });

  const secondaryFilterOptions: { id: QuickFilter; label: string; count: number }[] = [
    { id: "no-deadline", label: "No Deadline", count: TASKS.filter(t => !t.deadline).length },
    { id: "due-soon", label: "Due Soon", count: TASKS.filter(t => t.isToday || t.deadline === "Tomorrow").length },
    { id: "overdue", label: "Overdue", count: TASKS.filter(t => t.isOverdue).length },
    { id: "review", label: "Needs Review", count: TASKS.filter(t => t.status === "review").length },
    { id: "has-files", label: "Has Files", count: TASKS.filter(t => t.files?.length).length },
    { id: "high-priority", label: "High Priority", count: TASKS.filter(t => t.priority === "urgent" || t.priority === "high").length },
  ];
  const areas = Array.from(new Set(TASKS.map(task => task.area)));
  const projects = Array.from(new Set(TASKS.map(task => task.project).filter((project): project is string => Boolean(project))));
  const assignees = Array.from(new Set(TASKS.map(task => task.assignee).filter((assignee): assignee is string => Boolean(assignee))));
  const activeFilterCount = secondaryFilters.length + Number(Boolean(filterOrg)) + Number(Boolean(filterArea)) + Number(Boolean(filterProject)) + Number(Boolean(filterAssignee)) + Number(filterDeadline !== "all");
  const toggleSecondaryFilter = (filter: QuickFilter) => setSecondaryFilters(current => current.includes(filter) ? current.filter(item => item !== filter) : [...current, filter]);
  const clearAllFilters = () => {
    setSecondaryFilters([]);
    setFilterOrg(null);
    setFilterArea(null);
    setFilterProject(null);
    setFilterAssignee(null);
    setFilterDeadline("all");
  };
  const boardColumns: { id: TaskStatus; label: string; tint: string; dot: string }[] = [
    { id: "ready", label: "Ready", tint: "binnie-tint-primary", dot: "bg-primary" },
    { id: "in_progress", label: "In Progress", tint: "binnie-tint-mint", dot: "bg-success" },
    { id: "waiting", label: "Waiting", tint: "binnie-tint-blue", dot: "bg-info" },
    { id: "blocked", label: "Blocked", tint: "bg-overdue/[0.06]", dot: "bg-overdue" },
    { id: "review", label: "Review", tint: "bg-[#f7dde6]/60", dot: "bg-review" },
    { id: "done", label: "Completed", tint: "bg-[#dcede7]/55", dot: "bg-success" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/85 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Task workspace</p>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Tasks</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors focus-within:border-primary/40 sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
                className="bg-transparent text-sm text-foreground outline-none placeholder-muted-foreground flex-1 min-w-0" />
              {search && <button onClick={() => setSearch("")}><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] transition-colors", showFilters ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground")}>
              <SlidersHorizontal className="w-3.5 h-3.5" />{activeFilterCount ? `Filters · ${activeFilterCount}` : "Filters"}
            </button>
            <div className="relative">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                className="appearance-none bg-muted/40 border border-border rounded-lg px-3 py-2 text-[12px] text-muted-foreground pr-7 outline-none hover:text-foreground transition-colors cursor-pointer">
                <option value="deadline">Sort: Deadline</option>
                <option value="priority">Sort: Priority</option>
                <option value="org">Sort: Organization</option>
                <option value="updated">Sort: Updated</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button onClick={onNewTask} className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">
              <Plus className="w-3.5 h-3.5" />New Task
            </button>
            <div className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-1" aria-label="Task layout">
              <button onClick={() => setTaskLayout("list")} aria-label="List layout" aria-pressed={taskLayout === "list"} className={cn("rounded-lg p-1.5 transition-colors", taskLayout === "list" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><ListTodo className="h-3.5 w-3.5" /></button>
              <button onClick={() => setTaskLayout("board")} aria-label="Board layout" aria-pressed={taskLayout === "board"} className={cn("rounded-lg p-1.5 transition-colors", taskLayout === "board" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Layers className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
        <div className="mb-3 flex w-fit items-center gap-1 rounded-xl border border-border bg-card/75 p-1">
          {[
            { id: "all" as const, label: "All" },
            { id: "mine" as const, label: "Mine" },
            { id: "delegated" as const, label: "Delegated" },
            { id: "waiting" as const, label: "Waiting" },
            { id: "done" as const, label: "Done" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setOwnershipTab(tab.id)} className={cn("rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors", ownershipTab === tab.id ? "bg-primary/12 text-primary shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{tab.label}</button>
          ))}
        </div>
        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 rounded-2xl border border-border bg-card/90 p-4 shadow-[0_8px_24px_rgb(35_41_61_/_0.06)]">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[12px] font-semibold text-foreground">Refine your view</p><p className="mt-0.5 text-[10px] text-muted-foreground">Add one or more conditions without changing your task view.</p></div>{activeFilterCount > 0 && <button onClick={clearAllFilters} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">Clear all</button>}</div>
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Task conditions</p>
              <div className="flex flex-wrap gap-1.5">
                {secondaryFilterOptions.map(filter => <button key={filter.id} onClick={() => toggleSecondaryFilter(filter.id)} className={cn("rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors", secondaryFilters.includes(filter.id) ? filter.id === "overdue" ? "border-overdue/25 bg-overdue/10 text-overdue" : "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground")}>{filter.label}<span className="ml-1.5 font-mono opacity-65">{filter.count}</span></button>)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-[10px] font-medium text-muted-foreground">Organization<select value={filterOrg || ""} onChange={event => setFilterOrg(event.target.value as OrgName || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All organizations</option>{ORGS_META.map(org => <option key={org.name} value={org.name}>{org.name}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Area<select value={filterArea || ""} onChange={event => setFilterArea(event.target.value as AreaName || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All areas</option>{areas.map(area => <option key={area} value={area}>{area}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Project<select value={filterProject || ""} onChange={event => setFilterProject(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All projects</option>{projects.map(project => <option key={project} value={project}>{project}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Assignee<select value={filterAssignee || ""} onChange={event => setFilterAssignee(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">Anyone</option>{assignees.map(assignee => <option key={assignee} value={assignee}>{assignee}</option>)}</select></label>
              <label className="text-[10px] font-medium text-muted-foreground">Deadline<select value={filterDeadline} onChange={event => setFilterDeadline(event.target.value as typeof filterDeadline)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any target date</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="overdue">Past target</option><option value="no-deadline">No target date</option></select></label>
            </div>
          </div>
        )}
      </div>

      {/* Column headers */}
      {taskLayout === "list" && <div className="hidden items-center gap-3 border-b border-border bg-muted/25 px-4 py-2 md:flex">
        <span className="w-2 flex-shrink-0" />
        <span className="text-[10px] font-mono text-muted-foreground uppercase flex-1">Task</span>
        <div className="flex items-center gap-2 flex-shrink-0 text-[10px] font-mono text-muted-foreground">
          <span className="w-24">Organization</span>
          <span className="hidden lg:block w-20">Area</span>
          <span className="w-5 text-center">Who</span>
          <span className="w-4 text-center">St.</span>
          <span className="w-24 text-right">Deadline</span>
          <span className="w-20 text-right">Next Action</span>
          <span className="w-3" />
        </div>
      </div>}

      {/* Task list or soft board */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No tasks match your filters.</p>
          </div>
        ) : taskLayout === "list" ? (
          tasks.map(task => <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task)} />)
        ) : (
          <div className="h-full overflow-x-auto p-4 sm:p-5">
            <div className="grid min-w-[90rem] grid-cols-6 gap-4">
              {boardColumns.map(column => {
                const columnTasks = tasks.filter(task => task.status === column.id);
                return (
                  <section key={column.id} className={cn("binnie-board-column", column.tint)}>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", column.dot)} /><h2 className="text-[12px] font-semibold text-foreground">{column.label}</h2></div>
                      <span className="rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{columnTasks.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {columnTasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} compact />)}
                      {columnTasks.length === 0 && <p className="rounded-xl border border-dashed border-border/75 bg-white/35 px-3 py-5 text-center text-[11px] text-muted-foreground">Nothing here right now.</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-3">
        <span className="text-[11px] font-mono text-muted-foreground">{tasks.length} of {TASKS.length} tasks</span>
        {(search || activeFilterCount > 0) && (
          <span className="text-[11px] text-primary">Filtered</span>
        )}
      </div>
    </div>
  );
}

// ─── TASKS WORKSPACE ──────────────────────────────────────────────────────────

type TaskScope = "month" | "carried" | "unscheduled" | "done";
type TaskStateFilter = "all" | "mine" | "delegated" | "waiting" | "review";
type TaskDeadlineFilter = "all" | "today" | "this-week" | "overdue" | "no-date";

function TaskWorkspaceRow({ task, onClick, archived = false }: { task: Task; onClick: () => void; archived?: boolean }) {
  const nextAction = task.status === "review"
    ? "Needs my review"
    : task.status === "blocked"
      ? `Blocked by ${task.blockedBy?.label || task.nextActionBy}`
    : task.isWaiting
      ? `Waiting on ${task.nextActionBy === "me" ? "you" : task.nextActionBy}`
      : task.isDelegated
        ? `Assigned to ${task.assignee || task.nextActionBy}`
        : task.status === "in_progress"
          ? "In progress · Next: Me"
          : "Next: Me";
  const target = task.deadline ? `${task.isOverdue ? "Past target · " : "Target "}${task.deadline}` : "No target date";
  return (
    <button onClick={onClick} className={cn("group flex w-full items-start gap-3 border-b border-border/70 px-4 py-5 text-left transition-colors hover:bg-primary/[0.025] sm:px-5", task.isOverdue && "bg-overdue/[0.025]")}>
      <span className="mt-1.5 flex-shrink-0"><PriorityDot priority={task.priority} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-3"><span className="min-w-0 flex-1"><span className="block text-[14px] font-medium leading-6 text-foreground">{task.title}</span><span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground"><OrgBadge org={task.org} /><span>·</span><AreaBadge area={task.area} />{task.project && <><span>·</span><span className="truncate">{task.project}</span></>}</span></span><ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></span>
        <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]"><span className={cn("inline-flex items-center gap-1.5", task.status === "review" ? "text-review" : task.status === "blocked" ? "text-overdue" : task.isWaiting ? "text-info" : "text-muted-foreground")}><StatusDot status={task.status} />{nextAction}</span><span className="text-border">·</span><span className={cn(task.isOverdue ? "text-overdue" : "text-muted-foreground")}>{target}</span>{archived && <><span className="text-border">·</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Archived</span></>}</span>
      </span>
    </button>
  );
}

function AllTasksView({ onTaskClick, onNewTask }: { onTaskClick: (task: Task) => void; onNewTask: () => void }) {
  const currentUserId = useContext(CurrentUserContext) || DEFAULT_CURRENT_USER_ID;
  const [scope, setScope] = useState<TaskScope>("month");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("deadline");
  const [showFilters, setShowFilters] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showStaleReview, setShowStaleReview] = useState(true);
  const [filterOrg, setFilterOrg] = useState<OrgName | null>(null);
  const [filterArea, setFilterArea] = useState<AreaName | null>(null);
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<TaskStateFilter>("all");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterDeadline, setFilterDeadline] = useState<TaskDeadlineFilter>("all");
  const [hasFilesOnly, setHasFilesOnly] = useState(false);

  const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const allSearchableTasks = [...TASKS, ...ARCHIVED_TASKS];
  const isActive = isActiveTask;
  const hasCurrentMonthTarget = (task: Task) => getTasksForMonth([task]).length > 0;
  const isInScope = (task: Task) => {
    if (scope === "month") return isActive(task) && !task.carriedOver && hasCurrentMonthTarget(task);
    if (scope === "carried") return isActive(task) && Boolean(task.carriedOver || isTaskOverdue(task));
    if (scope === "unscheduled") return isActive(task) && !getTaskRelevantDate(task);
    return task.status === "done" && !task.archived && (task.completedInCurrentMonth || hasCurrentMonthTarget(task));
  };
  const matchesFilters = (task: Task) => {
    if (filterOrg && task.org !== filterOrg) return false;
    if (filterArea && task.area !== filterArea) return false;
    if (filterProject && task.project !== filterProject) return false;
    if (filterAssignee && task.assignee !== filterAssignee) return false;
    if (filterState === "mine" && !taskIsForCurrentUser(task, currentUserId)) return false;
    if (filterState === "delegated" && !getDelegatedTasks([task], currentUserId).length) return false;
    if (filterState === "waiting" && task.status !== "waiting") return false;
    if (filterState === "review" && task.status !== "review") return false;
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterDeadline === "today" && !getTasksForToday([task], currentUserId).length) return false;
    if (filterDeadline === "this-week" && !getTasksForWeek([task]).length) return false;
    if (filterDeadline === "overdue" && !isTaskOverdue(task)) return false;
    if (filterDeadline === "no-date" && getTaskRelevantDate(task)) return false;
    if (hasFilesOnly && !task.files?.length) return false;
    return true;
  };
  const matchesSearch = (task: Task) => {
    const query = search.trim().toLowerCase();
    return !query || [task.title, task.org, task.area, task.project, task.assignee, task.deadline].filter(Boolean).some(value => value!.toLowerCase().includes(query));
  };
  const sourceTasks = showArchive ? ARCHIVED_TASKS : search.trim() ? allSearchableTasks : TASKS.filter(isInScope);
  const tasks = sourceTasks.filter(task => matchesSearch(task) && matchesFilters(task)).sort((a, b) => sortBy === "priority" ? priorityOrder[a.priority] - priorityOrder[b.priority] : sortBy === "org" ? a.org.localeCompare(b.org) : 0);
  const areas = Array.from(new Set(allSearchableTasks.map(task => task.area)));
  const projects = Array.from(new Set(allSearchableTasks.map(task => task.project).filter((project): project is string => Boolean(project))));
  const assignees = Array.from(new Set(allSearchableTasks.map(task => task.assignee).filter((assignee): assignee is string => Boolean(assignee))));
  const carriedTasks = TASKS.filter(task => isActive(task) && (task.carriedOver || isTaskOverdue(task)));
  const longStaleTasks = carriedTasks.filter(task => (task.staleDays || 0) > 30);
  const activeFilterCount = Number(Boolean(filterOrg)) + Number(Boolean(filterArea)) + Number(Boolean(filterProject)) + Number(Boolean(filterAssignee)) + Number(filterState !== "all") + Number(filterPriority !== "all") + Number(filterDeadline !== "all") + Number(hasFilesOnly);
  const clearFilters = () => { setFilterOrg(null); setFilterArea(null); setFilterProject(null); setFilterAssignee(null); setFilterState("all"); setFilterPriority("all"); setFilterDeadline("all"); setHasFilesOnly(false); };
  const scopeTabs: { id: TaskScope; label: string; count: number }[] = [
    { id: "month", label: "This Month", count: TASKS.filter(task => isActive(task) && !task.carriedOver && hasCurrentMonthTarget(task)).length },
    { id: "carried", label: "Carried Over", count: carriedTasks.length },
    { id: "unscheduled", label: "Unscheduled", count: TASKS.filter(task => isActive(task) && !getTaskRelevantDate(task)).length },
    { id: "done", label: "Done", count: TASKS.filter(task => task.status === "done" && !task.archived && (task.completedInCurrentMonth || hasCurrentMonthTarget(task))).length },
  ];
  const scopeHelp: Record<TaskScope, string> = { month: "Current work with a target this month.", carried: "Unfinished work brought forward from an earlier period.", unscheduled: "Active work without a target date yet.", done: "Completed work from this month." };

  if (showArchive) return <div className="mx-auto w-full max-w-4xl p-5 sm:p-8 lg:p-10"><button onClick={() => setShowArchive(false)} className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" />Back to Tasks</button><div className="mb-6"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">History</p><h1 className="binnie-heading mt-1 text-3xl font-bold text-foreground">Archive</h1><p className="mt-1.5 text-sm text-muted-foreground">Completed work that is safely kept for reference.</p></div><div className="overflow-hidden rounded-[1.35rem] border border-border bg-card">{tasks.length ? tasks.map(task => <TaskWorkspaceRow key={task.id} task={task} archived onClick={() => onTaskClick(task)} />) : <p className="px-5 py-14 text-center text-sm text-muted-foreground">No archived tasks match these filters.</p>}</div></div>;

  return <div className="mx-auto w-full max-w-4xl p-5 sm:p-8 lg:p-10"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="binnie-heading text-3xl font-bold text-foreground">Tasks</h1><p className="mt-1.5 text-sm text-muted-foreground">Everything that still needs your attention.</p></div><button onClick={() => setShowArchive(true)} className="w-fit rounded-xl px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Archive</button></div><div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/75 p-1">{scopeTabs.map(tab => <button key={tab.id} onClick={() => setScope(tab.id)} className={cn("rounded-lg px-3 py-2 text-[12px] font-medium transition-colors", scope === tab.id ? "bg-primary/12 text-primary shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{tab.label}<span className="ml-1.5 text-[10px] opacity-65">{tab.count}</span></button>)}</div><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center"><p className="flex-1 text-[11px] text-muted-foreground">{scopeHelp[scope]}</p><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:flex-none"><Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks and archive…" className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}</div><button onClick={() => setShowFilters(current => !current)} className={cn("rounded-xl border px-3 py-2 text-[12px] transition-colors", showFilters ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground")}><span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />{activeFilterCount ? `Filters · ${activeFilterCount}` : "Filters"}</span></button><select value={sortBy} onChange={event => setSortBy(event.target.value as SortBy)} className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground"><option value="deadline">Sort: Target date</option><option value="priority">Sort: Priority</option><option value="org">Sort: Organization</option><option value="updated">Sort: Updated</option></select><button onClick={onNewTask} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"><Plus className="h-3.5 w-3.5" />New Task</button></div></div>{showFilters && <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_24px_rgb(35_41_61_/_0.06)]"><div className="mb-3 flex items-center justify-between"><div><p className="text-[12px] font-semibold text-foreground">Refine your view</p><p className="mt-0.5 text-[10px] text-muted-foreground">Filters stay tucked away until you need them.</p></div>{activeFilterCount > 0 && <button onClick={clearFilters} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">Clear all</button>}</div><div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-[10px] font-medium text-muted-foreground">Organization<select value={filterOrg || ""} onChange={event => setFilterOrg(event.target.value as OrgName || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All organizations</option>{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Area<select value={filterArea || ""} onChange={event => setFilterArea(event.target.value as AreaName || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All areas</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Project<select value={filterProject || ""} onChange={event => setFilterProject(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All projects</option>{projects.map(project => <option key={project}>{project}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Assignee<select value={filterAssignee || ""} onChange={event => setFilterAssignee(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">Anyone</option>{assignees.map(assignee => <option key={assignee}>{assignee}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Work state<select value={filterState} onChange={event => setFilterState(event.target.value as TaskStateFilter)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any state</option><option value="mine">Mine</option><option value="delegated">Delegated</option><option value="waiting">Waiting</option><option value="review">Needs review</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Priority<select value={filterPriority} onChange={event => setFilterPriority(event.target.value as Priority | "all")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any priority</option><option value="urgent">Needs attention</option><option value="high">Important</option><option value="medium">Planned</option><option value="low">When there’s room</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Deadline<select value={filterDeadline} onChange={event => setFilterDeadline(event.target.value as TaskDeadlineFilter)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any target date</option><option value="today">Today</option><option value="this-week">This week</option><option value="overdue">Past target</option><option value="no-date">No target date</option></select></label><label className="mt-5 inline-flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={hasFilesOnly} onChange={event => setHasFilesOnly(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />Has files</label></div></div>}{showStaleReview && longStaleTasks.length > 0 && <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-warning/20 bg-warning/[0.07] p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-[13px] font-semibold text-foreground">{longStaleTasks.length} {longStaleTasks.length === 1 ? "task has" : "tasks have"} been carried over for more than 30 days.</p><p className="mt-1 text-[11px] text-muted-foreground">Take a quiet moment to decide what still matters.</p></div><div className="flex gap-2"><button onClick={() => setScope("carried")} className="rounded-xl bg-card px-3 py-2 text-[11px] font-medium text-foreground shadow-sm">Review them</button><button onClick={() => setShowStaleReview(false)} className="rounded-xl px-3 py-2 text-[11px] text-muted-foreground hover:bg-card/50">Not now</button></div></div>}<div className="overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-[0_3px_16px_var(--theme-shadow)]">{tasks.length ? tasks.map(task => <TaskWorkspaceRow key={task.id} task={task} archived={Boolean(task.archived)} onClick={() => onTaskClick(task)} />) : <div className="px-5 py-14 text-center"><ListTodo className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">Nothing to show here right now.</p><p className="mt-1 text-[12px] text-muted-foreground">The rest of your work is safely organized.</p></div>}</div><p className="mt-3 text-[11px] text-muted-foreground">{search ? `${tasks.length} search result${tasks.length === 1 ? "" : "s"} across current work and archive.` : `${tasks.length} task${tasks.length === 1 ? "" : "s"} in this view.`}</p></div>;
}

// ─── PEOPLE DIRECTORY ────────────────────────────────────────────────────────

type PeopleSort = "followup" | "overdue" | "active" | "name";
type PersonWorkFilter = "all" | "assigned" | "waiting-on-them" | "waiting-on-me" | "overdue";

const personAreas = Array.from(new Set(TASKS.map(task => task.area)));

function personRole(person: DirectoryPerson, organization?: OrgName) {
  const membership = getPersonMembership(person, organization);
  return [membership?.role, membership?.area].filter(Boolean).join(" · ") || (person.type === "team" ? "Team" : "No role set");
}

function MembershipPills({ person, compact = false }: { person: DirectoryPerson; compact?: boolean }) {
  return <div className="flex flex-wrap gap-1.5">{person.memberships.slice(0, compact ? 1 : 3).map(membership => <span key={membership.organization} className="rounded-full border border-border bg-muted/45 px-2 py-1 text-[10px] text-muted-foreground">{membership.organization}{membership.area ? ` · ${membership.area}` : ""}</span>)}{person.memberships.length > (compact ? 1 : 3) && <span className="rounded-full border border-border bg-muted/45 px-2 py-1 text-[10px] text-muted-foreground">+{person.memberships.length - (compact ? 1 : 3)}</span>}</div>;
}

function PersonManagerDrawer({ open, onClose, onSaved, organizationContext, initialPerson }: { open: boolean; onClose: () => void; onSaved: (person: DirectoryPerson) => void; organizationContext?: OrgName; initialPerson?: DirectoryPerson | null }) {
  const emptyMembership = (): OrganizationMembership => ({ organization: organizationContext || "", role: "", area: "" });
  const [name, setName] = useState(() => initialPerson?.name || "");
  const [type, setType] = useState<DirectoryEntityType>(() => initialPerson?.type || "person");
  const [memberships, setMemberships] = useState<OrganizationMembership[]>(() => initialPerson ? initialPerson.memberships.map(membership => ({ ...membership })) : [emptyMembership()]);
  const [email, setEmail] = useState(() => initialPerson?.email || "");
  const [phone, setPhone] = useState(() => initialPerson?.phone || "");
  const [notes, setNotes] = useState(() => initialPerson?.notes || "");
  const [existingQuery, setExistingQuery] = useState("");
  const [showCreate, setShowCreate] = useState(!organizationContext || Boolean(initialPerson));
  const [error, setError] = useState("");

  if (!open) return null;
  const existingMatches = getDirectoryAssignees().filter(person => person.name.toLowerCase().includes(existingQuery.trim().toLowerCase())).slice(0, 5);
  const updateMembership = (index: number, patch: Partial<OrganizationMembership>) => setMemberships(current => current.map((membership, membershipIndex) => membershipIndex === index ? { ...membership, ...patch } : membership));
  const addMembership = () => setMemberships(current => [...current, { organization: "", role: "", area: "" }]);
  const removeMembership = (index: number) => setMemberships(current => current.length === 1 ? current : current.filter((_, membershipIndex) => membershipIndex !== index));
  const attachExisting = (person: DirectoryPerson) => {
    if (!organizationContext) return;
    if (person.memberships.some(membership => membership.organization === organizationContext)) { setError(`${person.name} is already connected to ${organizationContext}.`); return; }
    const updated = replaceDirectoryPerson(person.id, current => ({ ...current, memberships: [...current.memberships, { organization: organizationContext, role: "", area: "" }] }));
    if (updated) onSaved(updated);
    onClose();
  };
  const save = () => {
    const cleanName = name.trim();
    const cleanMemberships = memberships.filter(membership => membership.organization).map(membership => ({ ...membership, role: membership.role?.trim(), area: membership.area || undefined }));
    if (!cleanName) { setError("Add a name before saving."); return; }
    if (memberships.some(membership => !membership.organization && (membership.role?.trim() || membership.area))) { setError("Choose an organization before adding a role or department."); return; }
    if (new Set(cleanMemberships.map(membership => membership.organization)).size !== cleanMemberships.length) { setError("Use each organization once, then set its role and department on that membership."); return; }
    const duplicate = PEOPLE_DIRECTORY.find(person => person.name.toLowerCase() === cleanName.toLowerCase() && person.id !== initialPerson?.id);
    if (duplicate) { setError(`${duplicate.name} already exists in Binnie. Add them to an organization instead of creating a duplicate.`); return; }
    const values = { name: cleanName, type, memberships: cleanMemberships, email: email.trim() || undefined, phone: phone.trim() || undefined, notes: notes.trim() || undefined };
    const next = initialPerson
      ? replaceDirectoryPerson(initialPerson.id, current => ({ ...current, ...values }))
      : { id: `person-${Date.now()}`, ...values, active: true, accountStatus: "no_account" as DirectoryAccountStatus };
    if (!next) { setError("This person could not be found."); return; }
    if (!initialPerson) PEOPLE_DIRECTORY.push(next);
    onSaved(next);
    onClose();
  };

  return <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-label={initialPerson ? `Edit ${initialPerson.name}` : "Add person"}>
    <button aria-label="Close person manager" onClick={onClose} className="absolute inset-0 cursor-default bg-foreground/10 backdrop-blur-[1px]" />
    <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-[-20px_0_50px_rgb(35_41_61_/_0.12)]">
      <div className="flex items-start justify-between border-b border-border px-5 py-5"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">People directory</p><h2 className="binnie-heading mt-1 text-xl font-bold text-foreground">{initialPerson ? "Edit person" : organizationContext ? `Add person to ${organizationContext}` : "Add person"}</h2><p className="mt-1 text-[11px] text-muted-foreground">People can exist without a Binnie account.</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
      <div className="flex-1 overflow-y-auto p-5">
        {organizationContext && !initialPerson && <section className="mb-5 rounded-2xl border border-border bg-muted/30 p-3.5"><p className="text-[12px] font-semibold text-foreground">Add an existing Binnie person</p><p className="mt-0.5 text-[10px] text-muted-foreground">Create a membership instead of a duplicate record.</p><div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={existingQuery} onChange={event => setExistingQuery(event.target.value)} placeholder="Search people…" className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground" /></div>{existingQuery && <div className="mt-2 space-y-1.5">{existingMatches.map(person => <button key={person.id} onClick={() => attachExisting(person)} className="flex w-full items-center gap-2 rounded-xl border border-border bg-card p-2.5 text-left hover:border-primary/30"><Avatar name={person.name} size="xs" /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-foreground">{person.name}</span><span className="block truncate text-[10px] text-muted-foreground">{personRole(person)}{person.memberships.some(membership => membership.organization === organizationContext) ? ` · already in ${organizationContext}` : ""}</span></span><Plus className="h-3.5 w-3.5 text-primary" /></button>)}{!existingMatches.length && <p className="px-1 py-2 text-[11px] text-muted-foreground">No match yet. Create a new person below.</p>}</div>}<button onClick={() => setShowCreate(current => !current)} className="mt-3 text-[11px] font-medium text-primary">{showCreate ? "Hide new person form" : "+ Create new person"}</button></section>}
        {showCreate && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-[1fr_9rem]"><label className="text-[11px] font-medium text-muted-foreground">Name<input value={name} onChange={event => setName(event.target.value)} placeholder={type === "team" ? "Enter team name" : "Enter name"} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Record type<select value={type} onChange={event => setType(event.target.value as DirectoryEntityType)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option value="person">Person</option><option value="team">Team</option></select></label></div>
          <section><div className="mb-2 flex items-center justify-between"><div><p className="text-[11px] font-medium text-muted-foreground">Organization memberships <span className="font-normal">(optional)</span></p><p className="mt-0.5 text-[10px] text-muted-foreground">Role and department can be different in each organization.</p></div><button onClick={addMembership} className="text-[11px] font-medium text-primary">+ Add organization</button></div><div className="space-y-2">{memberships.map((membership, index) => <div key={`${membership.organization || "new"}-${index}`} className="grid gap-2 rounded-xl border border-border bg-muted/25 p-3 sm:grid-cols-[1.15fr_1fr_1fr_auto]"><select value={membership.organization} onChange={event => updateMembership(index, { organization: event.target.value })} className="rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground"><option value="">Select organization</option>{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select><input value={membership.role || ""} onChange={event => updateMembership(index, { role: event.target.value })} placeholder="Role or title" className="rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground placeholder:text-muted-foreground" /><select value={membership.area || ""} onChange={event => updateMembership(index, { area: event.target.value || undefined })} className="rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground"><option value="">Select department</option>{personAreas.map(area => <option key={area}>{area}</option>)}</select><button onClick={() => removeMembership(index)} disabled={memberships.length === 1} aria-label="Remove organization" className="rounded-lg p-2 text-muted-foreground hover:bg-overdue/10 hover:text-overdue disabled:opacity-30"><X className="h-3.5 w-3.5" /></button></div>)}</div></section>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-medium text-muted-foreground">Email <span className="font-normal">(optional)</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Phone / WhatsApp <span className="font-normal">(optional)</span><input value={phone} onChange={event => setPhone(event.target.value)} placeholder="Phone or WhatsApp" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /></label></div><label className="block text-[11px] font-medium text-muted-foreground">Notes <span className="font-normal">(optional)</span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add notes" className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /></label></div>}
        {error && <p className="mt-4 rounded-xl border border-overdue/20 bg-overdue/[0.06] px-3 py-2 text-[11px] text-overdue">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4"><button onClick={onClose} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button>{showCreate && <button onClick={save} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">{initialPerson ? "Save changes" : `Add ${type === "team" ? "team" : "person"}`}</button>}</div>
    </aside>
  </div>;
}

function PeopleView({ onPersonClick }: { onPersonClick: (name: string) => void }) {
  const [sort, setSort] = useState<PeopleSort>("followup");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [organization, setOrganization] = useState<OrgName | "all">("all");
  const [area, setArea] = useState<AreaName | "all">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "open" | "waiting-them" | "waiting-me" | "overdue">("all");
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  void directoryRevision;
  const accountability = PEOPLE_DIRECTORY.map(person => ({ person, summary: getPersonAccountability(person.name) }));
  const owesUpdate = accountability.filter(item => item.summary.waitingOnThem > 0).length;
  const waitingForMe = accountability.filter(item => item.summary.waitingOnMe > 0).length;
  const overdueCount = accountability.reduce((count, item) => count + item.summary.overdue, 0);
  const filtered = accountability.filter(({ person, summary }) => {
    const searchable = [person.name, person.type, person.email, ...person.memberships.flatMap(membership => [membership.organization, membership.role, membership.area])].filter(Boolean).join(" ").toLowerCase();
    if (query && !searchable.includes(query.toLowerCase())) return false;
    if (organization !== "all" && !person.memberships.some(membership => membership.organization === organization)) return false;
    if (area !== "all" && !person.memberships.some(membership => membership.area === area)) return false;
    if (activityFilter === "open" && !summary.active) return false;
    if (activityFilter === "waiting-them" && !summary.waitingOnThem) return false;
    if (activityFilter === "waiting-me" && !summary.waitingOnMe) return false;
    if (activityFilter === "overdue" && !summary.overdue) return false;
    return true;
  }).sort((left, right) => sort === "name" ? left.person.name.localeCompare(right.person.name) : sort === "overdue" ? right.summary.overdue - left.summary.overdue : sort === "active" ? right.summary.active - left.summary.active : right.summary.waitingOnThem - left.summary.waitingOnThem || right.summary.overdue - left.summary.overdue);
  const activeFilterCount = Number(organization !== "all") + Number(area !== "all") + Number(activityFilter !== "all");

  return <div className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Accountability</p><h1 className="binnie-heading text-3xl font-bold text-foreground">People</h1><p className="mt-1.5 text-sm text-muted-foreground">Keep track of who owns what and where work is waiting.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-[13rem] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground" />{query && <button onClick={() => setQuery("")} aria-label="Clear people search"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}</div><button onClick={() => setFiltersOpen(current => !current)} className={cn("rounded-xl border px-3 py-2 text-[12px] font-medium", filtersOpen ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}><SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />{activeFilterCount ? `Filters · ${activeFilterCount}` : "Filter"}</button><button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" />Add Person</button></div></div>
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ value: owesUpdate, label: "updates you’re waiting for", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" }, { value: waitingForMe, label: "people waiting for you", color: "text-info", bg: "bg-info/10", border: "border-info/20" }, { value: overdueCount, label: "dates worth revisiting", color: "text-overdue", bg: "bg-overdue/10", border: "border-overdue/20" }].map(item => <div key={item.label} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", item.bg, item.border)}><span className={cn("binnie-heading text-2xl font-bold", item.color)}>{item.value}</span><span className={cn("text-[12px]", item.color)}>{item.label}</span></div>)}</div>
    {filtersOpen && <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[10px] font-medium text-muted-foreground">Organization<select value={organization} onChange={event => setOrganization(event.target.value as OrgName | "all")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground"><option value="all">All organizations</option>{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Department<select value={area} onChange={event => setArea(event.target.value as AreaName | "all")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground"><option value="all">All departments</option>{personAreas.map(item => <option key={item}>{item}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Work context<select value={activityFilter} onChange={event => setActivityFilter(event.target.value as typeof activityFilter)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground"><option value="all">Any context</option><option value="open">Has open work</option><option value="waiting-them">Waiting on them</option><option value="waiting-me">Waiting on me</option><option value="overdue">Overdue work</option></select></label><div className="flex items-end"><button onClick={() => { setOrganization("all"); setArea("all"); setActivityFilter("all"); }} className="rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Clear filters</button></div></div>}
    <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[11px] text-muted-foreground">Sort by</span>{([{ id: "followup", label: "Needs Follow-Up" }, { id: "overdue", label: "Most Overdue" }, { id: "active", label: "Most Active" }, { id: "name", label: "Name" }] as { id: PeopleSort; label: string }[]).map(option => <button key={option.id} onClick={() => setSort(option.id)} className={cn("rounded-full border px-2.5 py-1 text-[11px]", sort === option.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{option.label}</button>)}</div>
    <div className="space-y-2.5">{filtered.map(({ person, summary }) => <button key={person.id} onClick={() => onPersonClick(person.name)} className="binnie-card binnie-card-hover group w-full p-4 text-left"><div className="flex items-center gap-3"><Avatar name={person.name} size="md" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13px] font-semibold text-foreground">{person.name}</p><span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{person.type}</span>{!person.active && <span className="rounded-full bg-overdue/10 px-1.5 py-0.5 text-[9px] font-medium text-overdue">Inactive</span>}</div><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{personRole(person)}</p><div className="mt-2"><MembershipPills person={person} compact /></div></div><div className="hidden grid-cols-4 gap-4 text-center sm:grid">{[{ value: summary.active, label: "Active" }, { value: summary.waitingOnThem, label: "On them" }, { value: summary.waitingOnMe, label: "On me" }, { value: summary.overdue, label: "Overdue" }].map(item => <span key={item.label}><span className={cn("block text-base font-semibold", item.label === "Overdue" && item.value ? "text-overdue" : item.label === "On them" && item.value ? "text-warning" : "text-foreground")}>{item.value}</span><span className="block text-[9px] text-muted-foreground">{item.label}</span></span>)}</div><ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" /></div></button>)}{!filtered.length && <div className="binnie-card py-14 text-center"><Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No people added yet.</p><p className="mt-1 text-[12px] text-muted-foreground">Add people so Binnie can help you delegate work and keep track of follow-ups.</p><button onClick={() => setAddOpen(true)} className="mt-4 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">+ Add Person</button></div>}</div>
    {addOpen && <PersonManagerDrawer open onClose={() => setAddOpen(false)} onSaved={() => setDirectoryRevision(current => current + 1)} />}
  </div>;
}

function PersonDetailView({ personName, onBack, onTaskClick, onFollowUp }: { personName: string; onBack: () => void; onTaskClick: (t: Task) => void; onFollowUp: () => void }) {
  const [revision, setRevision] = useState(0);
  const [workFilter, setWorkFilter] = useState<PersonWorkFilter>("all");
  const [moreOpen, setMoreOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeMembership, setRemoveMembership] = useState<OrganizationMembership | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const person = getDirectoryPerson(personName);
  void revision;
  if (!person) return <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10"><BackButton label="People" onClick={onBack} /><div className="binnie-card p-8 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/35" /><p className="text-sm font-medium text-foreground">This person is not in the Binnie directory yet.</p></div></div>;
  const summary = getPersonAccountability(person.name);
  const directlyAssignedTasks = getTasksForAssignee(person.id);
  const personTasks = TASKS.filter(task => directlyAssignedTasks.some(assigned => assigned.id === task.id) || task.nextActionBy === person.name || task.contributorIds?.includes(person.id));
  const visibleTasks = personTasks.filter(task => workFilter === "all" || workFilter === "assigned" ? (workFilter === "all" || task.assignee === person.name) : workFilter === "waiting-on-them" ? task.nextActionBy === person.name && task.status !== "done" : workFilter === "waiting-on-me" ? task.nextActionBy === "me" : Boolean(task.isOverdue));
  const defaultMembership = person.memberships[0];
  const removeActiveTasks = removeMembership ? TASKS.filter(task => task.org === removeMembership.organization && task.status !== "done" && (task.assignee === person.name || task.nextActionBy === person.name)) : [];
  const saveAssignedTask = () => {
    if (!taskTitle.trim() || !defaultMembership) return;
    createTask({ title: taskTitle.trim(), org: defaultMembership.organization, area: defaultMembership.area || "Operations", priority: "medium", status: "ready", assignee: person.name, assigneeIds: [person.id], nextActionBy: person.name, isDelegated: true, isWaiting: false, activity: [{ type: "assigned", actor: "You", text: `Assigned to ${person.name}`, time: "Just now" }] });
    setTaskTitle(""); setAssignOpen(false); setRevision(current => current + 1);
  };
  const completeMembershipRemoval = (reassign: boolean) => {
    if (!removeMembership) return;
    if (reassign) {
      const next = getDirectoryAssignees(removeMembership.organization).find(candidate => candidate.name !== person.name)?.name || "Unassigned";
      removeActiveTasks.forEach(task => { const nextId = getDirectoryPerson(next)?.id; setTaskAssignees(task, nextId ? [nextId] : []); Object.assign(task, { nextActionBy: next, isDelegated: next !== "Unassigned", lastUpdate: `Reassigned from ${person.name}` }); });
      commitTaskStore();
    }
    replaceDirectoryPerson(person.id, current => ({ ...current, memberships: current.memberships.filter(membership => membership.organization !== removeMembership.organization) }));
    setRemoveMembership(null); setRevision(current => current + 1);
  };
  const deactivate = () => { replaceDirectoryPerson(person.id, current => ({ ...current, active: false, accountStatus: "disabled" })); setMoreOpen(false); setRevision(current => current + 1); };

  return <div className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10"><BackButton label="People" onClick={onBack} /><div className="binnie-card mb-6 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><Avatar name={person.name} size="lg" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="binnie-heading text-2xl font-bold text-foreground">{person.name}</h1><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{person.type === "team" ? "Team" : "Person"}</span>{!person.active && <span className="rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">Inactive</span>}</div><p className="mt-1 text-sm text-muted-foreground">{personRole(person)}</p><div className="mt-3"><MembershipPills person={person} /></div>{person.email && <p className="mt-3 text-[11px] text-muted-foreground">{person.email}{person.phone ? ` · ${person.phone}` : ""}</p>}</div><div className="flex flex-wrap gap-2"><button onClick={() => setAssignOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" />Assign Task</button><button onClick={onFollowUp} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground"><Send className="h-3.5 w-3.5" />Follow Up</button><div className="relative"><button onClick={() => setMoreOpen(current => !current)} aria-label="Person actions" className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>{moreOpen && <div className="absolute right-0 top-[calc(100%+0.35rem)] z-20 w-48 rounded-xl border border-border bg-popover p-1.5 shadow-lg"><button onClick={() => { setMoreOpen(false); setEditOpen(true); }} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Edit Person</button><button onClick={() => { setMoreOpen(false); setEditOpen(true); }} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Manage Organizations</button>{person.active && <button onClick={deactivate} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-overdue hover:bg-overdue/10">Deactivate Person</button>}</div>}</div></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[{ label: "Active", value: summary.active }, { label: "Ready", value: summary.ready }, { label: "In Progress", value: summary.inProgress }, { label: "Waiting on them", value: summary.waitingOnThem }, { label: "Waiting on me", value: summary.waitingOnMe }, { label: "Blocked", value: summary.blocked }, { label: "Overdue", value: summary.overdue }, { label: "Review", value: summary.review }].map(item => <div key={item.label} className="rounded-xl bg-muted/45 p-2.5 text-center"><p className={cn("text-lg font-semibold", item.label === "Blocked" || item.label === "Overdue" ? "text-overdue" : item.label.startsWith("Waiting") ? "text-warning" : "text-foreground")}>{item.value}</p><p className="mt-0.5 text-[9px] leading-3 text-muted-foreground">{item.label}</p></div>)}</div></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,.8fr)]"><section><div className="mb-3 flex flex-wrap items-center gap-2"><div className="mr-auto"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Open Work</p><p className="mt-0.5 text-[11px] text-muted-foreground">Work involving {person.name}.</p></div>{([{ id: "all", label: "All" }, { id: "assigned", label: "Assigned to them" }, { id: "waiting-on-them", label: "Waiting on them" }, { id: "waiting-on-me", label: "Waiting on me" }, { id: "overdue", label: "Overdue" }] as { id: PersonWorkFilter; label: string }[]).map(filter => <button key={filter.id} onClick={() => setWorkFilter(filter.id)} className={cn("rounded-full border px-2 py-1 text-[10px]", workFilter === filter.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{filter.label}</button>)}</div><div className="space-y-2">{visibleTasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />)}{!visibleTasks.length && <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-[12px] text-muted-foreground">No work matches this view.</div>}</div></section><aside className="space-y-6"><section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Organizations</p><button onClick={() => setEditOpen(true)} className="text-[11px] font-medium text-primary">+ Add Organization</button></div><div className="space-y-2">{person.memberships.map(membership => <div key={membership.organization} className="rounded-xl border border-border bg-card p-3"><p className="text-[12px] font-medium text-foreground">{membership.organization}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{[membership.role, membership.area].filter(Boolean).join(" · ") || "No role or department set"}</p><button onClick={() => setRemoveMembership(membership)} className="mt-2 text-[10px] font-medium text-muted-foreground hover:text-overdue">Remove from organization</button></div>)}{!person.memberships.length && <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-[11px] text-muted-foreground">No organization memberships yet.</div>}</div></section><section><p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Recent Activity</p><div className="space-y-2">{personTasks.flatMap(task => (task.activity || []).map(activity => ({ activity, task }))).slice(0, 4).map(({ activity, task }, index) => <button key={`${task.id}-${index}`} onClick={() => onTaskClick(task)} className="w-full rounded-xl border border-border bg-card p-3 text-left hover:border-primary/25"><p className="truncate text-[11px] text-foreground">{activity.text}</p><p className="mt-1 text-[10px] text-muted-foreground">{activity.time} · {task.title}</p></button>)}{!personTasks.length && <p className="rounded-xl border border-border bg-card px-3 py-5 text-center text-[11px] text-muted-foreground">Activity will appear as work moves.</p>}</div></section></aside></div>
    {assignOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label={`Assign a task to ${person.name}`} className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-5 shadow-xl"><div className="mb-4 flex items-start justify-between"><div><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Assign task</p><h2 className="binnie-heading mt-1 text-xl font-bold text-foreground">{person.name}</h2><p className="mt-1 text-[11px] text-muted-foreground">No Binnie account is needed to own work.</p></div><button onClick={() => setAssignOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><label className="block text-[11px] font-medium text-muted-foreground">Task name<input autoFocus value={taskTitle} onChange={event => setTaskTitle(event.target.value)} onKeyDown={event => event.key === "Enter" && saveAssignedTask()} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><p className="mt-3 rounded-xl bg-muted/45 px-3 py-2 text-[11px] text-muted-foreground">{defaultMembership?.organization} · {defaultMembership?.area || "No department"}</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setAssignOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground">Cancel</button><button onClick={saveAssignedTask} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Assign Task</button></div></div></div>}
    {removeMembership && <div className="fixed inset-0 z-[85] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label={`Remove ${person.name} from ${removeMembership.organization}`} className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-5 shadow-xl"><h2 className="binnie-heading text-xl font-bold text-foreground">Remove from {removeMembership.organization}?</h2><p className="mt-2 text-[12px] leading-5 text-muted-foreground">This only removes the organization membership. {person.name} and their work history stay in Binnie.</p>{removeActiveTasks.length > 0 && <div className="mt-4 rounded-xl border border-warning/20 bg-warning/[0.06] p-3"><p className="text-[12px] font-medium text-foreground">{person.name} still owns {removeActiveTasks.length} active {removeActiveTasks.length === 1 ? "task" : "tasks"} here.</p><p className="mt-1 text-[10px] text-muted-foreground">Choose whether to reassign that work or keep its historical ownership.</p></div>}<div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={() => setRemoveMembership(null)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground">Cancel</button>{removeActiveTasks.length > 0 && <button onClick={() => completeMembershipRemoval(true)} className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground">Reassign Tasks</button>}<button onClick={() => completeMembershipRemoval(false)} className="rounded-xl bg-overdue px-3.5 py-2 text-[12px] font-medium text-white">Keep Tasks Assigned</button></div></div></div>}
    {editOpen && <PersonManagerDrawer open initialPerson={person} onClose={() => setEditOpen(false)} onSaved={() => setRevision(current => current + 1)} />}
  </div>;
}

// ─── ORGANIZATION DETAIL VIEW (NEW) ───────────────────────────────────────────

interface OrganizationAreaSettings { aliases?: string[]; defaultAssignee?: string; defaultTeamId?: string }
interface OrganizationMeta { name: OrgName; desc: string; areas: AreaName[]; aliases?: string[]; areaSettings?: Record<string, OrganizationAreaSettings> }

const ORGS_META: OrganizationMeta[] = [
  {
    name: "Villa Khayangan", desc: "Hospitality & property management", aliases: ["khayangan", "villa", "penginapan", "vk"],
    areas: ["System Development", "Operations", "Marketing", "Finance", "HR", "Purchasing", "Maintenance"],
    areaSettings: {
      "System Development": { aliases: ["system", "dev", "it"], defaultAssignee: "Development Team", defaultTeamId: "team-development" },
      Operations: { aliases: ["ops", "operational", "operasional"], defaultAssignee: "Bu Desti", defaultTeamId: "team-operations" },
      Marketing: { aliases: ["marketing", "promo", "content"], defaultAssignee: "Marketing Team", defaultTeamId: "team-marketing" },
      Finance: { aliases: ["finance", "accounting", "cash"], defaultAssignee: "Finance Team", defaultTeamId: "team-finance" },
      HR: { aliases: ["human resources", "people"], defaultAssignee: "HR Manager", defaultTeamId: "team-hr" },
      Purchasing: { aliases: ["purchase", "supplier", "procurement", "quotation"], defaultAssignee: "Purchasing Manager", defaultTeamId: "team-purchasing" },
      Maintenance: { aliases: ["maintenance", "repair", "teknisi"], defaultAssignee: "Maintenance Team", defaultTeamId: "team-maintenance" },
    },
  },
  {
    name: "Apotik", desc: "Pharmacy operations", aliases: ["apotik", "pharmacy", "obat"], areas: ["Operations", "Finance", "HR"],
    areaSettings: { Operations: { aliases: ["ops", "operational", "operasional"], defaultAssignee: "Operations Team", defaultTeamId: "team-operations" }, Finance: { aliases: ["finance", "cash"], defaultAssignee: "Finance Team", defaultTeamId: "team-finance" }, HR: { aliases: ["hr", "people"], defaultAssignee: "HR Manager", defaultTeamId: "team-hr" } },
  },
  { name: "Personal", desc: "Personal projects & finances", aliases: ["personal", "myself"], areas: ["Finance"] },
];

type OrgTaskFilter = "all" | "today" | "mine" | "delegated" | "waiting" | "review" | "overdue";
type OrgTaskSort = "deadline" | "priority" | "title" | "updated";
type ResourceDraft = { label: string; type: ResourceType; url: string; area: string; project: string; description: string };

const EMPTY_RESOURCE_DRAFT: ResourceDraft = { label: "", type: "website", url: "", area: "", project: "", description: "" };

function OrgDetailView({ orgName, onBack, onTaskClick, onProjectClick, onNavigate, onPersonClick }: {
  orgName: OrgName; onBack: () => void; onTaskClick: (t: Task) => void; onProjectClick: (id: string) => void; onNavigate: (view: NavView) => void; onPersonClick: (person: string) => void;
}) {
  const orgMeta = ORGS_META.find(o => o.name === orgName);
  const c = ORG_COLORS[orgName] || ORG_COLORS.Personal;
  const [selectedArea, setSelectedArea] = useState<AreaName | null>(null);
  const [areas, setAreas] = useState<AreaName[]>(() => orgMeta?.areas || []);
  const [projects, setProjects] = useState(() => STRATEGIC_PROJECTS.filter(project => project.org === orgName));
  const [resources, setResources] = useState<OrganizationResource[]>(() => ORG_RESOURCES[orgName] || []);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState(false);
  const [orgTitle, setOrgTitle] = useState(orgName);
  const [orgDescription, setOrgDescription] = useState(orgMeta?.desc || "");
  const [orgAccent, setOrgAccent] = useState("Slate blue");
  const [orgIcon, setOrgIcon] = useState("Rounded marker");
  const [defaultTimezone, setDefaultTimezone] = useState("Asia/Jakarta");
  const [defaultArea, setDefaultArea] = useState<AreaName>(orgMeta?.areas[0] || "Operations");
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [peopleManagerOpen, setPeopleManagerOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [resourceFormOpen, setResourceFormOpen] = useState(false);
  const [resourceManagerOpen, setResourceManagerOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [orgSettingsOpen, setOrgSettingsOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [planningTimelineOpen, setPlanningTimelineOpen] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilterOpen, setTaskFilterOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<OrgTaskFilter>("all");
  const [taskPriority, setTaskPriority] = useState<Priority | "all">("all");
  const [taskProject, setTaskProject] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "dated" | "none">("all");
  const [taskSort, setTaskSort] = useState<OrgTaskSort>("deadline");
  const [showAllWork, setShowAllWork] = useState(false);
  const [quickMenuTaskId, setQuickMenuTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>(EMPTY_RESOURCE_DRAFT);
  const [editingResourceIndex, setEditingResourceIndex] = useState<number | null>(null);
  const [resourceError, setResourceError] = useState("");
  const [projectDraft, setProjectDraft] = useState({ name: "", area: orgMeta?.areas[0] || "Operations", description: "", target: "", owner: "Charlotte", focus: "" });
  const [projectError, setProjectError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [orgName]);

  if (!orgMeta) {
    return <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10"><BackButton label="Organizations" onClick={onBack} /><div className="binnie-card p-8 text-center"><Building2 className="mx-auto mb-3 h-9 w-9 text-muted-foreground/35" /><h1 className="text-lg font-semibold text-foreground">Organization not found</h1><p className="mt-1 text-sm text-muted-foreground">It may have been archived or moved.</p><button onClick={onBack} className="mt-4 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">Back to organizations</button></div></div>;
  }

  const refreshWorkspace = (notice?: string) => {
    // Organization actions edit canonical records; publishing here keeps every
    // other page subscribed to the same store in sync.
    commitTaskStore();
    setWorkspaceRevision(current => current + 1);
    if (notice) {
      setMessage(notice);
      window.setTimeout(() => setMessage(""), 2400);
    }
  };
  void workspaceRevision;

  const orgTasks = getTasksForOrganization(orgName);
  const scopedAreaTasks = selectedArea ? getTasksForArea(selectedArea, orgName) : orgTasks;
  const taskMatchesFilter = (task: Task) => {
    if (taskFilter === "today" && !getTasksForToday([task]).length) return false;
    if (taskFilter === "mine" && task.nextActionBy !== "me") return false;
    if (taskFilter === "delegated" && !getDelegatedTasks([task]).length) return false;
    if (taskFilter === "waiting" && task.status !== "waiting") return false;
    if (taskFilter === "review" && task.status !== "review") return false;
    if (taskFilter === "overdue" && !isTaskOverdue(task)) return false;
    if (taskPriority !== "all" && task.priority !== taskPriority) return false;
    if (taskProject && task.project !== taskProject) return false;
    if (dateFilter === "dated" && !getTaskRelevantDate(task)) return false;
    if (dateFilter === "none" && getTaskRelevantDate(task)) return false;
    if (taskSearch && ![task.title, task.area, task.project || "", task.assignee || "", task.nextActionBy].join(" ").toLowerCase().includes(taskSearch.toLowerCase())) return false;
    return true;
  };
  const filteredTasks = [...scopedAreaTasks.filter(taskMatchesFilter)].sort((left, right) => {
    if (taskSort === "title") return left.title.localeCompare(right.title);
    if (taskSort === "priority") return ["urgent", "high", "medium", "low"].indexOf(left.priority) - ["urgent", "high", "medium", "low"].indexOf(right.priority);
    if (taskSort === "updated") return (right.lastUpdate || "").localeCompare(left.lastUpdate || "");
    return (left.deadline || "zzzz").localeCompare(right.deadline || "zzzz");
  });
  const visibleTasks = showAllWork ? filteredTasks : filteredTasks.slice(0, 8);
  const selectedAreaOwnedCount = selectedArea ? orgTasks.filter(task => task.area === selectedArea && task.status !== "done").length : 0;
  const selectedAreaSharedCount = selectedArea ? orgTasks.filter(task => task.area !== selectedArea && taskInvolvesArea(task, selectedArea) && task.status !== "done").length : 0;
  const scopedProjects = projects.filter(project => !selectedArea || PROJECT_DETAILS[project.id]?.area === selectedArea);
  const scopedPeople = PEOPLE_DIRECTORY.filter(person => person.active && person.memberships.some(membership => membership.organization === orgName && (!selectedArea || membership.area === selectedArea || orgTasks.some(task => taskInvolvesArea(task, selectedArea) && (taskHasAssignee(task, person) || task.nextActionBy === person.name)))));
  const attentionTasks = scopedAreaTasks.filter(task => isTaskOverdue(task) || task.status === "blocked" || task.status === "review" || (task.status === "waiting" && task.waitingSince));
  const readyToStart = scopedAreaTasks.filter(task => task.status === "ready" && !task.blockedBy);
  const teamsWaitingOnThisArea = orgTasks.filter(task => task.status === "blocked" && task.blockedBy && (!selectedArea || task.blockedBy.owner === selectedArea));
  const activityEntries: Array<Activity & { key: string; task?: Task; project?: { id: string } }> = [
    ...orgTasks.flatMap(task => (task.activity || []).slice(-1).map(activity => ({ ...activity, key: `${task.id}-${activity.time}`, task }))),
    ...projects.flatMap(project => (PROJECT_DETAILS[project.id]?.recentActivity || []).slice(0, 1).map(activity => ({ ...activity, key: `${project.id}-${activity.time}`, project }))),
  ].slice(0, showActivity ? 10 : 4);
  const projectNames = projects.map(project => project.name);
  const activeFilterCount = Number(taskFilter !== "all") + Number(taskPriority !== "all") + Number(Boolean(taskProject)) + Number(dateFilter !== "all");
  const accentColor = orgAccent === "Dusty sage" ? "var(--success)" : orgAccent === "Warm stone" ? "var(--warning)" : "var(--org-villa-dot)";

  function completeTask(task: Task) {
    Object.assign(task, { status: "done" as TaskStatus, isWaiting: false, isOverdue: false, nextActionBy: "me", lastUpdate: "Just now", completedInCurrentMonth: true });
    refreshWorkspace("Task completed");
  }

  function rescheduleTask(task: Task) {
    Object.assign(task, { deadline: "Tomorrow", isOverdue: false, lastUpdate: "Rescheduled just now" });
    refreshWorkspace("Rescheduled for tomorrow");
  }

  function reassignTask(task: Task) {
    const people = scopedPeople.map(person => person.name);
    const next = people[(Math.max(people.indexOf(task.assignee || ""), -1) + 1) % Math.max(people.length, 1)] || "Bu Desti";
    const nextId = getDirectoryPerson(next)?.id;
    setTaskAssignees(task, nextId ? [nextId] : []);
    Object.assign(task, { nextActionBy: next, status: "ready" as TaskStatus, isWaiting: false, blockedBy: undefined, lastUpdate: `Assigned to ${next}` });
    refreshWorkspace(`Assigned to ${next}`);
  }

  function duplicateTask(task: Task) {
    createTask({ ...task, title: `Copy of ${task.title}`, status: "ready", isWaiting: false, isOverdue: false, nextActionBy: "me", assignee: undefined, assigneeIds: [], isDelegated: false, lastUpdate: "Just now", blockedBy: undefined });
    refreshWorkspace("Task duplicated");
  }

  function moveTaskToProject(task: Task) {
    const target = projects.find(project => project.name !== task.project);
    if (!target) return refreshWorkspace("Create another project to move this task");
    Object.assign(task, { project: target.name, area: PROJECT_DETAILS[target.id]?.area || task.area, lastUpdate: `Moved to ${target.name}` });
    refreshWorkspace(`Moved to ${target.name}`);
  }

  function moveTaskToNextArea(task: Task) {
    const next = areas[(areas.indexOf(task.area) + 1) % Math.max(areas.length, 1)] || task.area;
    Object.assign(task, { area: next, lastUpdate: `Moved to ${next}` });
    refreshWorkspace(`Moved to ${next}`);
  }

  function archiveTask(task: Task) {
    archiveCanonicalTask(task.id);
    refreshWorkspace("Task archived");
  }

  function saveTaskTitle(task: Task) {
    const title = editingTaskTitle.trim();
    if (!title) return;
    updateTask(task.id, { title, lastUpdate: "Edited just now" });
    setEditingTaskId(null);
    refreshWorkspace("Task updated");
  }

  function addArea() {
    const area = newArea.trim();
    if (!area || areas.includes(area)) return;
    setAreas(current => [...current, area]);
    setNewArea("");
    refreshWorkspace("Area added");
  }

  function renameArea(area: AreaName) {
    const next = window.prompt("Rename area", area)?.trim();
    if (!next || next === area || areas.includes(next)) return;
    setAreas(current => current.map(item => item === area ? next : item));
    TASKS.filter(task => task.org === orgName && taskInvolvesArea(task, area)).forEach(task => { task.area = task.area === area ? next : task.area; task.involvedAreas = getTaskAreas(task).map(item => item === area ? next : item); });
    if (selectedArea === area) setSelectedArea(next);
    refreshWorkspace("Area renamed");
  }

  function moveArea(area: AreaName, direction: -1 | 1) {
    setAreas(current => {
      const index = current.indexOf(area);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function hideArea(area: AreaName) {
    setAreas(current => current.filter(item => item !== area));
    TASKS.filter(task => task.org === orgName && taskInvolvesArea(task, area)).forEach(task => { task.involvedAreas = getTaskAreas(task).filter(item => item !== area); if (task.area === area) task.area = task.involvedAreas[0] || "Unassigned"; });
    if (selectedArea === area) setSelectedArea(null);
    refreshWorkspace("Area hidden from this workspace");
  }

  function openResourceForm(index?: number) {
    const resource = index === undefined ? undefined : resources[index];
    setEditingResourceIndex(index ?? null);
    setResourceDraft(resource ? { label: resource.label, type: resource.type, url: resource.url, area: resource.area || "", project: resource.project || "", description: resource.description || "" } : EMPTY_RESOURCE_DRAFT);
    setResourceError("");
    setResourceManagerOpen(false);
    setResourceFormOpen(true);
  }

  function detectResourceType(url: string): ResourceType {
    const normalized = url.toLowerCase();
    if (normalized.includes("figma")) return "figma";
    if (normalized.includes("github")) return "github";
    if (normalized.includes("notion")) return "notion";
    if (normalized.includes("docs.google")) return "doc";
    if (normalized.includes("sheets.google")) return "sheet";
    if (normalized.includes("drive.google")) return "drive";
    return "website";
  }

  function saveResource() {
    const label = resourceDraft.label.trim();
    const url = resourceDraft.url.trim();
    if (!label) return setResourceError("Give this resource a name.");
    if (url && !/^https?:\/\//i.test(url)) return setResourceError("Use a full URL beginning with https://.");
    const resource: OrganizationResource = { label, url, type: url ? detectResourceType(url) : resourceDraft.type, area: resourceDraft.area || undefined, project: resourceDraft.project || undefined, description: resourceDraft.description.trim() || undefined };
    const next = editingResourceIndex === null ? [...resources, resource] : resources.map((item, index) => index === editingResourceIndex ? resource : item);
    setResources(next);
    ORG_RESOURCES[orgName] = next;
    setResourceFormOpen(false);
    refreshWorkspace(editingResourceIndex === null ? "Resource added" : "Resource updated");
  }

  function createProject() {
    const name = projectDraft.name.trim();
    if (!name) return setProjectError("Give this project a name.");
    const id = `project-${Date.now()}`;
    const deadline = projectDraft.target.trim() || "No target yet";
    const project = { id, name, org: orgName, progress: 0, tasks: 0, done: 0, deadline, status: "on_track" as const };
    STRATEGIC_PROJECTS.push(project);
    PROJECT_DETAILS[id] = { id, name, org: orgName, area: projectDraft.area as AreaName, progress: 0, deadline, status: "on_track", tasks: 0, done: 0, currentFocus: [projectDraft.focus.trim() || "Set a focused next step"], resources: [], recentActivity: [{ type: "assigned", actor: projectDraft.owner || "Charlotte", text: `Created ${name}`, time: "Just now" }] };
    setProjects(current => [...current, project]);
    setProjectDraft({ name: "", area: areas[0] || "Operations", description: "", target: "", owner: "Charlotte", focus: "" });
    setProjectError("");
    setProjectOpen(false);
    refreshWorkspace("Project created");
  }

  const stats: { label: string; value: number; color: string; filter: OrgTaskFilter }[] = [
    { label: "Today", value: orgTasks.filter(task => getTasksForToday([task]).length).length, color: "text-primary", filter: "today" },
    { label: "This Week", value: getTasksForWeek(orgTasks).length, color: "text-foreground", filter: "all" },
    { label: "Dates to revisit", value: orgTasks.filter(isTaskOverdue).length, color: "text-overdue", filter: "overdue" },
    { label: "Waiting", value: orgTasks.filter(task => task.status === "waiting").length, color: "text-info", filter: "waiting" },
    { label: "Delegated", value: getDelegatedTasks(orgTasks).length, color: "text-success", filter: "delegated" },
    { label: "Review", value: orgTasks.filter(task => task.status === "review").length, color: "text-review", filter: "review" },
  ];

  if (loading) {
    return <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10"><BackButton label="Organizations" onClick={onBack} /><div className="animate-pulse space-y-5"><div className="h-20 rounded-2xl bg-muted/70" /><div className="grid grid-cols-3 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 rounded-2xl bg-muted/60" />)}</div><div className="grid gap-6 lg:grid-cols-3"><div className="h-[30rem] rounded-2xl bg-card" /><div className="h-[30rem] rounded-2xl bg-card" /></div></div></div>;
  }

  return (
    <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10">
      <BackButton label="Organizations" onClick={onBack} />
      {selectedArea && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2 text-[11px] text-muted-foreground"><AreaBadge area={selectedArea} /><span>{selectedAreaOwnedCount + selectedAreaSharedCount} active</span><span>· {selectedAreaOwnedCount} owned</span>{selectedAreaSharedCount > 0 && <span className="text-primary">· {selectedAreaSharedCount} shared</span>}</div>}
      {message && <div role="status" className="mb-4 rounded-xl border border-success/20 bg-success/10 px-3.5 py-2 text-[12px] font-medium text-success">{message}</div>}
      {archived && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-4"><div><p className="text-[13px] font-semibold text-foreground">This organization is archived.</p><p className="mt-0.5 text-[11px] text-muted-foreground">Its work remains available for reference.</p></div><button onClick={() => { setArchived(false); refreshWorkspace("Organization restored"); }} className="rounded-xl bg-card px-3 py-2 text-[11px] font-medium text-foreground shadow-sm">Restore organization</button></div>}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">{orgIcon === "Building" ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted" style={{ color: accentColor }}><Building2 className="h-3.5 w-3.5" /></span> : orgIcon === "Spark" ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted" style={{ color: accentColor }}><Sparkles className="h-3.5 w-3.5" /></span> : <div className={cn("h-3 w-3 rounded-sm", c.dot)} style={{ backgroundColor: accentColor }} />}<h1 className="binnie-heading text-3xl font-bold text-foreground">{orgTitle}</h1>{archived && <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Archived</span>}</div>
          <p className="text-sm text-muted-foreground">{orgDescription}</p>
        </div>
        {!archived && <div className="flex flex-wrap items-center gap-2"><button onClick={() => setCaptureOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20"><Plus className="h-3.5 w-3.5" />Quick Capture</button><button onClick={() => setProjectOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"><FolderKanban className="h-3.5 w-3.5" />Add Project</button><div className="relative"><button onClick={() => setOverflowOpen(current => !current)} aria-label="Organization options" aria-expanded={overflowOpen} className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>{overflowOpen && <div className="absolute right-0 top-[calc(100%+0.4rem)] z-30 w-48 rounded-xl border border-border bg-popover p-1.5 shadow-[0_10px_28px_rgb(35_41_61_/_0.12)]">{[{ label: "Edit Organization", action: () => setOrgSettingsOpen(true) }, { label: "Manage Areas", action: () => setAreasOpen(true) }, { label: "Manage Resources", action: () => setResourceManagerOpen(true) }, { label: "Organization Settings", action: () => setOrgSettingsOpen(true) }, { label: "Archive Organization", action: () => setArchiveConfirmOpen(true), destructive: true }].map(item => <button key={item.label} onClick={() => { setOverflowOpen(false); item.action(); }} className={cn("w-full rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-muted", item.destructive ? "text-overdue" : "text-foreground")}>{item.label}</button>)}</div>}</div></div>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{stats.map(stat => <button key={stat.label} onClick={() => { setSelectedArea(null); setTaskFilter(stat.filter); }} className={cn("binnie-card binnie-card-hover p-4 text-center", taskFilter === stat.filter && "border-primary/30 bg-secondary/45")}><p className={cn("binnie-heading text-2xl font-bold", stat.color)}>{stat.value}</p><p className="mt-1 text-[10px] font-medium text-muted-foreground">{stat.label}</p></button>)}</div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-3 rounded-2xl border border-border bg-card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[12px] font-semibold text-foreground">Organization workspace</p><p className="mt-1 text-[11px] text-muted-foreground">See work across projects by department, project, and real dependencies.</p></div><div role="tablist" aria-label="Organization planning views" className="flex rounded-xl border border-border bg-muted/35 p-1"><button role="tab" aria-selected={!planningTimelineOpen} onClick={() => setPlanningTimelineOpen(false)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium", !planningTimelineOpen ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>Overview</button><button role="tab" aria-selected={planningTimelineOpen} onClick={() => setPlanningTimelineOpen(true)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium", planningTimelineOpen ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>Timeline</button></div></div>{planningTimelineOpen && <div className="mt-4 border-t border-border pt-4"><PlanningTimeline tasks={orgTasks} areas={areas} selectedArea={selectedArea || "all"} onAreaChange={area => setSelectedArea(area === "all" ? null : area)} onTaskClick={onTaskClick} onRefresh={refreshWorkspace} /></div>}</section>
        <div className="space-y-6 lg:col-span-2">
          <section>
            <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Areas</p><button onClick={() => setAreasOpen(true)} className="text-[11px] font-medium text-primary hover:text-primary/80">Manage Areas</button></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedArea(null)} className={cn("rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors", !selectedArea ? cn(c.border, c.bg, c.text) : "border-border bg-card text-muted-foreground hover:text-foreground")}>All <span className="ml-1 text-[10px] opacity-65">{orgTasks.length}</span></button>
              {areas.map(area => <button key={area} onClick={() => setSelectedArea(current => current === area ? null : area)} className={cn("rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors", selectedArea === area ? "border-primary/25 bg-secondary text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{area} <span className="ml-1 text-[10px] opacity-65">{orgTasks.filter(task => taskInvolvesArea(task, area)).length}</span></button>)}
            </div>
          </section>

          {selectedArea && <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><div><p className="text-[12px] font-semibold text-foreground">Ready to Start</p><p className="text-[10px] text-muted-foreground">{readyToStart.length} {selectedArea} tasks can move now.</p></div></div><div className="mt-3 space-y-1.5">{readyToStart.slice(0, 3).map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="block w-full truncate rounded-lg bg-card px-2.5 py-2 text-left text-[11px] font-medium text-foreground shadow-sm">{task.title}</button>)}{!readyToStart.length && <p className="text-[11px] text-muted-foreground">No ready work in this area right now.</p>}</div></div><div className="rounded-2xl border border-overdue/15 bg-overdue/[0.035] p-4"><div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-overdue" /><div><p className="text-[12px] font-semibold text-foreground">Other Teams Waiting on {selectedArea}</p><p className="text-[10px] text-muted-foreground">Only real dependencies appear here.</p></div></div><div className="mt-3 space-y-1.5">{teamsWaitingOnThisArea.slice(0, 3).map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="block w-full truncate rounded-lg bg-card px-2.5 py-2 text-left text-[11px] font-medium text-foreground shadow-sm">{task.area} · {task.title}</button>)}{!teamsWaitingOnThisArea.length && <p className="text-[11px] text-muted-foreground">No other teams are blocked by this area.</p>}</div></div></section>}

          <section><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center"><p className="flex-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{selectedArea || "All Work"} · {filteredTasks.length}</p><div className="flex flex-wrap gap-2"><div className="flex min-w-[11rem] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="Search work" className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground" />{taskSearch && <button onClick={() => setTaskSearch("")} aria-label="Clear search"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}</div><button onClick={() => setTaskFilterOpen(current => !current)} className={cn("rounded-xl border px-3 py-2 text-[11px] font-medium transition-colors", taskFilterOpen ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}><SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />{activeFilterCount ? `Filters · ${activeFilterCount}` : "Filter"}</button><select value={taskSort} onChange={event => setTaskSort(event.target.value as OrgTaskSort)} className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><option value="deadline">Sort: target date</option><option value="priority">Sort: priority</option><option value="title">Sort: title</option><option value="updated">Sort: updated</option></select></div></div>{taskFilterOpen && <div className="mb-3 grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2"><label className="text-[10px] font-medium text-muted-foreground">Work state<select value={taskFilter} onChange={event => setTaskFilter(event.target.value as OrgTaskFilter)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="all">All work</option><option value="mine">Mine</option><option value="delegated">Delegated</option><option value="waiting">Waiting</option><option value="review">Needs review</option><option value="overdue">Overdue</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Priority<select value={taskPriority} onChange={event => setTaskPriority(event.target.value as Priority | "all")} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="all">Any priority</option><option value="urgent">Needs attention</option><option value="high">Important</option><option value="medium">Planned</option><option value="low">When there’s room</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Project<select value={taskProject} onChange={event => setTaskProject(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="">All projects</option>{projectNames.map(name => <option key={name}>{name}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Date<select value={dateFilter} onChange={event => setDateFilter(event.target.value as "all" | "dated" | "none")} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="all">Any date</option><option value="dated">Has target date</option><option value="none">No target date</option></select></label><button onClick={() => { setTaskFilter("all"); setTaskPriority("all"); setTaskProject(""); setDateFilter("all"); }} className="w-fit text-[11px] font-medium text-muted-foreground hover:text-foreground">Clear filters</button></div>}<div className="binnie-card overflow-visible">{visibleTasks.map(task => <div key={task.id} className="group relative border-b border-border/70 last:border-b-0"><div className="flex items-center gap-3 px-4 py-3"><button onClick={() => onTaskClick(task)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><PriorityDot priority={task.priority} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{task.title}</span><span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground"><AreaBadge area={task.area} />{task.project && <span>· {task.project}</span>}<span>· {task.nextActionBy === "me" ? "Next: me" : `Waiting on ${task.nextActionBy}`}</span></span></span></button><span className={cn("hidden text-[10px] font-medium sm:inline", task.isOverdue ? "text-overdue" : "text-muted-foreground")}>{task.deadline || "No date"}</span><div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-success/10 hover:text-success"><Check className="h-3.5 w-3.5" /></button><button onClick={() => { setEditingTaskId(task.id); setEditingTaskTitle(task.title); }} aria-label={`Edit ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">Edit</button><button onClick={() => reassignTask(task)} aria-label={`Delegate ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Users className="h-3.5 w-3.5" /></button><button onClick={() => rescheduleTask(task)} aria-label={`Reschedule ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Calendar className="h-3.5 w-3.5" /></button><button onClick={() => setQuickMenuTaskId(current => current === task.id ? null : task.id)} aria-label={`More actions for ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button></div></div>{editingTaskId === task.id && <div className="flex gap-2 border-t border-border bg-muted/25 px-4 py-2"><input autoFocus value={editingTaskTitle} onChange={event => setEditingTaskTitle(event.target.value)} onKeyDown={event => event.key === "Enter" && saveTaskTitle(task)} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground" /><button onClick={() => saveTaskTitle(task)} className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">Save</button><button onClick={() => setEditingTaskId(null)} className="rounded-lg px-2 text-[11px] text-muted-foreground">Cancel</button></div>}{quickMenuTaskId === task.id && <div className="absolute right-3 top-11 z-20 w-40 rounded-xl border border-border bg-popover p-1.5 shadow-[0_10px_24px_rgb(35_41_61_/_0.12)]"><button onClick={() => onTaskClick(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Open Detail</button><button onClick={() => duplicateTask(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Duplicate</button><button onClick={() => moveTaskToProject(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Move to Project</button><button onClick={() => moveTaskToNextArea(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Change Area</button><button onClick={() => archiveTask(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-overdue hover:bg-overdue/10">Archive / Cancel</button></div>}</div>)}{filteredTasks.length === 0 && <div className="px-5 py-12 text-center"><ListTodo className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No work matches these filters.</p><p className="mt-1 text-[11px] text-muted-foreground">Try a different area or clear a filter.</p></div>}{filteredTasks.length > 8 && <button onClick={() => setShowAllWork(current => !current)} className="w-full border-t border-border px-4 py-3 text-center text-[11px] font-medium text-primary transition-colors hover:bg-primary/[0.025]">{showAllWork ? "Show less" : "View all work →"}</button>}</div></section>

          <section><div className="mb-2 flex items-center justify-between"><div><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">People</p><p className="mt-0.5 text-[10px] text-muted-foreground">People are shared across Binnie and connected here by membership.</p></div><button onClick={() => setPeopleManagerOpen(true)} className="text-[11px] font-medium text-primary hover:text-primary/80">+ Add Person</button></div>{scopedPeople.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{scopedPeople.map(person => { const summary = getPersonAccountability(person.name); return <button key={person.id} onClick={() => onPersonClick(person.name)} className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/25"><div className="flex items-center gap-2.5"><Avatar name={person.name} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-foreground">{person.name}</span><span className="block truncate text-[10px] text-muted-foreground">{personRole(person, orgName)}</span></span>{summary.overdue > 0 && <span className="text-[10px] font-medium text-overdue">{summary.overdue} overdue</span>}</div><div className="mt-2 flex gap-3 border-t border-border pt-2 text-[10px] text-muted-foreground"><span>{summary.active} active</span><span>{summary.waitingOnThem} waiting</span>{summary.blocked > 0 && <span className="text-overdue">{summary.blocked} blocked</span>}</div></button>; })}</div> : <div className="binnie-card px-5 py-10 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No one has been added to this organization yet.</p><button onClick={() => setPeopleManagerOpen(true)} className="mt-3 text-[11px] font-medium text-primary">+ Add Person</button></div>}{peopleManagerOpen && <PersonManagerDrawer open organizationContext={orgName} onClose={() => setPeopleManagerOpen(false)} onSaved={() => { setPeopleManagerOpen(false); refreshWorkspace("People updated"); }} />}</section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Recent Activity</p><button onClick={() => setShowActivity(current => !current)} className="text-[11px] font-medium text-primary hover:text-primary/80">{showActivity ? "Show less" : "View Activity"}</button></div>{activityEntries.length ? <div className="binnie-card divide-y divide-border/70">{activityEntries.map(entry => <button key={entry.key} onClick={() => entry.task ? onTaskClick(entry.task) : entry.project ? onProjectClick(entry.project.id) : undefined} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/45"><div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /><span className="min-w-0 flex-1"><span className="block text-[12px] text-foreground">{entry.text}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{entry.actor} · {entry.time}</span></span><ChevronRight className="mt-1 h-3.5 w-3.5 text-muted-foreground" /></button>)}</div> : <div className="binnie-card px-5 py-10 text-center"><p className="text-sm font-medium text-foreground">No recent activity yet.</p><p className="mt-1 text-[11px] text-muted-foreground">Updates will appear here as work moves.</p></div>}</section>
        </div>

        <div className="space-y-6">
          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Current Projects</p><button onClick={() => setProjectOpen(true)} className="text-[11px] font-medium text-primary hover:text-primary/80">+ Add Project</button></div>{scopedProjects.length ? <div className="space-y-2">{scopedProjects.map(project => { const detail = PROJECT_DETAILS[project.id]; const remaining = Math.max(project.tasks - project.done, 0); return <button key={project.id} onClick={() => onProjectClick(project.id)} className="binnie-card binnie-card-hover w-full p-4 text-left"><div className="mb-2 flex items-start gap-3"><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-foreground">{project.name}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{detail?.currentFocus[0] || "Set a focused next step"}</span></span>{project.status === "at_risk" && <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning">Needs attention</span>}</div><div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div><div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{project.progress}% · {remaining} remaining</span><span>Target: {project.deadline}</span></div></button>; })}</div> : <div className="binnie-card px-5 py-10 text-center"><FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No active projects yet.</p><p className="mt-1 text-[11px] text-muted-foreground">Create one when a piece of work needs its own focus.</p></div>}</section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Resources</p><button onClick={() => openResourceForm()} className="text-[11px] font-medium text-primary hover:text-primary/80">+ Add Resource</button></div>{resources.length ? <div className="space-y-1.5">{resources.map((resource, index) => <div key={`${resource.label}-${index}`} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"><LinkIcon type={resource.type} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-foreground">{resource.label}</span>{(resource.area || resource.project) && <span className="block truncate text-[10px] text-muted-foreground">{resource.project || resource.area}</span>}</span>{resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10">Open ↗</a> : <button onClick={() => openResourceForm(index)} className="rounded-lg px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10">Add link</button>}</div>)}</div> : <div className="binnie-card px-5 py-10 text-center"><Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">Keep important links close.</p><p className="mt-1 text-[11px] text-muted-foreground">Add your Drive, website, dashboards, or project tools here.</p></div>}</section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-warning">Needs Attention</p><span className="text-[10px] text-muted-foreground">{attentionTasks.length} items</span></div>{attentionTasks.length ? <div className="space-y-1.5">{attentionTasks.slice(0, 4).map(task => { const isReview = task.status === "review"; const reason = isReview ? "Needs Review" : task.isOverdue ? "Overdue" : `No update from ${task.nextActionBy} for ${task.waitingSince || "a while"}`; return <div key={task.id} className="rounded-xl border border-warning/15 bg-warning/[0.04] p-3"><p className="truncate text-[12px] font-medium text-foreground">{task.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{reason}</p><div className="mt-2 flex gap-2"><button onClick={() => onTaskClick(task)} className="rounded-lg bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground shadow-sm">{isReview ? "Review" : "Open"}</button>{!isReview && task.isWaiting && <button onClick={() => onNavigate("followup")} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-primary">Follow Up</button>}</div></div>; })}</div> : <div className="binnie-card px-5 py-10 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success/45" /><p className="text-sm font-medium text-foreground">Nothing needs attention right now.</p></div>}</section>
        </div>
      </div>

      {captureOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-border bg-background p-4 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)] sm:p-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-[12px] font-semibold text-foreground">Quick Capture for {orgTitle}</p><p className="text-[10px] text-muted-foreground">This organization is already selected.</p></div><button onClick={() => setCaptureOpen(false)} aria-label="Close quick capture" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><QuickCapture organization={orgName} onSaved={() => refreshWorkspace("Saved to this organization")} /></div></div>}

      {projectOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Add project" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="binnie-heading text-xl font-bold text-foreground">Add Project</h2><p className="mt-1 text-[11px] text-muted-foreground">{orgTitle} is already selected.</p></div><button onClick={() => setProjectOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Project name<input autoFocus value={projectDraft.name} onChange={event => setProjectDraft(current => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Organization<input value={orgTitle} disabled className="mt-1.5 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] text-muted-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Area<select value={projectDraft.area} onChange={event => setProjectDraft(current => ({ ...current, area: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground">{areas.map(area => <option key={area}>{area}</option>)}</select></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Description <span className="font-normal">(optional)</span><textarea value={projectDraft.description} onChange={event => setProjectDraft(current => ({ ...current, description: event.target.value }))} className="mt-1.5 min-h-16 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Target date <span className="font-normal">(optional)</span><input value={projectDraft.target} onChange={event => setProjectDraft(current => ({ ...current, target: event.target.value }))} placeholder="September" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Owner<input value={projectDraft.owner} onChange={event => setProjectDraft(current => ({ ...current, owner: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Current focus <span className="font-normal">(optional)</span><input value={projectDraft.focus} onChange={event => setProjectDraft(current => ({ ...current, focus: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label></div>{projectError && <p className="mt-3 text-[11px] text-overdue">{projectError}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setProjectOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={createProject} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Create Project</button></div></div></div>}

      {resourceManagerOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Manage resources" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-center justify-between"><div><h2 className="binnie-heading text-xl font-bold text-foreground">Manage Resources</h2><p className="mt-1 text-[11px] text-muted-foreground">Keep the tools for {orgTitle} close.</p></div><button onClick={() => setResourceManagerOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="max-h-64 space-y-2 overflow-y-auto">{resources.length ? resources.map((resource, index) => <div key={`${resource.label}-${index}`} className="flex items-center gap-2 rounded-xl border border-border p-3"><LinkIcon type={resource.type} /><span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{resource.label}</span><button onClick={() => openResourceForm(index)} className="text-[11px] font-medium text-primary">Edit</button></div>) : <p className="rounded-xl bg-muted/45 px-3 py-6 text-center text-[11px] text-muted-foreground">No resources yet.</p>}</div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setResourceManagerOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Close</button><button onClick={() => openResourceForm()} className="rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">+ Add Resource</button></div></div></div>}

      {resourceFormOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Add resource" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="binnie-heading text-xl font-bold text-foreground">{editingResourceIndex === null ? "Add Resource" : "Edit Resource"}</h2><p className="mt-1 text-[11px] text-muted-foreground">Binnie will recognize common links automatically.</p></div><button onClick={() => setResourceFormOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Resource name<input autoFocus value={resourceDraft.label} onChange={event => setResourceDraft(current => ({ ...current, label: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Type<select value={resourceDraft.type} onChange={event => setResourceDraft(current => ({ ...current, type: event.target.value as ResourceType }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground">{["website", "drive", "sheet", "doc", "figma", "github", "dashboard", "notion", "other"].map(type => <option key={type} value={type}>{type === "drive" ? "Google Drive" : type === "sheet" ? "Google Sheet" : type === "doc" ? "Google Doc" : type[0].toUpperCase() + type.slice(1)}</option>)}</select></label><label className="text-[11px] font-medium text-muted-foreground">Related area <span className="font-normal">(optional)</span><select value={resourceDraft.area} onChange={event => setResourceDraft(current => ({ ...current, area: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option value="">No area</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">URL <span className="font-normal">(optional)</span><input value={resourceDraft.url} onChange={event => setResourceDraft(current => ({ ...current, url: event.target.value }))} placeholder="https://" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Related project <span className="font-normal">(optional)</span><select value={resourceDraft.project} onChange={event => setResourceDraft(current => ({ ...current, project: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option value="">No project</option>{projectNames.map(project => <option key={project}>{project}</option>)}</select></label><label className="text-[11px] font-medium text-muted-foreground">Description <span className="font-normal">(optional)</span><input value={resourceDraft.description} onChange={event => setResourceDraft(current => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label></div>{resourceError && <p className="mt-3 text-[11px] text-overdue">{resourceError}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setResourceFormOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={saveResource} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Save</button></div></div></div>}

      {areasOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Manage areas" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="binnie-heading text-xl font-bold text-foreground">Manage Areas</h2><p className="mt-1 text-[11px] text-muted-foreground">Set an optional default owner so Binnie can route clear work automatically.</p></div><button onClick={() => setAreasOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="max-h-64 space-y-2 overflow-y-auto">{areas.map((area, index) => <div key={area} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{area}</span><button onClick={() => moveArea(area, -1)} disabled={index === 0} aria-label={`Move ${area} up`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button><button onClick={() => moveArea(area, 1)} disabled={index === areas.length - 1} aria-label={`Move ${area} down`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button><button onClick={() => renameArea(area)} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10">Rename</button><button onClick={() => hideArea(area)} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-overdue hover:bg-overdue/10">Hide</button></div><label className="mt-2 block text-[10px] font-medium text-muted-foreground">Default owner or team<select value={getAreaSettings(orgName, area)?.defaultAssignee || ""} onChange={event => { setAreaSettings(orgName, area, { defaultAssignee: event.target.value || undefined }); setWorkspaceRevision(current => current + 1); refreshWorkspace(`${area} responsibility updated`); }} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="">No default owner</option>{getDirectoryAssignees(orgName).map(person => <option key={person.id} value={person.name}>{person.name}{person.type === "team" ? " · Team" : ""}</option>)}</select></label></div>)}</div><div className="mt-4 flex gap-2 border-t border-border pt-4"><input value={newArea} onChange={event => setNewArea(event.target.value)} onKeyDown={event => event.key === "Enter" && addArea()} placeholder="New area" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground" /><button onClick={addArea} className="rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Add Area</button></div></div></div>}

      {orgSettingsOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Organization settings" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="binnie-heading text-xl font-bold text-foreground">Organization Settings</h2><p className="mt-1 text-[11px] text-muted-foreground">Keep the workspace details up to date.</p></div><button onClick={() => setOrgSettingsOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Organization name<input value={orgTitle} onChange={event => setOrgTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Description<input value={orgDescription} onChange={event => setOrgDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Organization color<select value={orgAccent} onChange={event => setOrgAccent(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option>Slate blue</option><option>Dusty sage</option><option>Warm stone</option></select></label><label className="text-[11px] font-medium text-muted-foreground">Icon<select value={orgIcon} onChange={event => setOrgIcon(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option>Rounded marker</option><option>Building</option><option>Spark</option></select></label><label className="text-[11px] font-medium text-muted-foreground">Default timezone<select value={defaultTimezone} onChange={event => setDefaultTimezone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option>Asia/Jakarta</option><option>Asia/Singapore</option><option>Europe/London</option><option>America/New_York</option></select></label><label className="text-[11px] font-medium text-muted-foreground">Default task area<select value={defaultArea} onChange={event => setDefaultArea(event.target.value as AreaName)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground">{areas.map(area => <option key={area}>{area}</option>)}</select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setOrgSettingsOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={() => { setOrgSettingsOpen(false); refreshWorkspace("Organization updated"); }} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Save changes</button></div></div></div>}

      {archiveConfirmOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Archive organization" className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><h2 className="binnie-heading text-xl font-bold text-foreground">Archive {orgTitle}?</h2><p className="mt-2 text-[12px] leading-5 text-muted-foreground">The work will stay available for reference, but this organization will no longer appear as active.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setArchiveConfirmOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={() => { setArchiveConfirmOpen(false); setArchived(true); refreshWorkspace("Organization archived"); }} className="rounded-xl bg-overdue px-4 py-2 text-[12px] font-medium text-white">Archive Organization</button></div></div></div>}
    </div>
  );
}

// ─── PROJECT DETAIL VIEW (NEW) ────────────────────────────────────────────────

type ProjectTab = "overview" | "board" | "timeline" | "roadmap" | "people" | "links-files" | "activity" | "resources";

const PLANNING_COLUMNS: { id: TaskStatus; label: string; help: string; tint: string; text: string }[] = [
  { id: "ready", label: "Ready", help: "Can start now", tint: "bg-primary/[0.055]", text: "text-primary" },
  { id: "in_progress", label: "In Progress", help: "Actively moving", tint: "bg-success/[0.055]", text: "text-success" },
  { id: "waiting", label: "Waiting", help: "May still move", tint: "bg-info/[0.055]", text: "text-info" },
  { id: "blocked", label: "Blocked", help: "Cannot continue", tint: "bg-overdue/[0.055]", text: "text-overdue" },
  { id: "review", label: "Review", help: "Needs a decision", tint: "bg-review/[0.055]", text: "text-review" },
  { id: "done", label: "Done", help: "Complete", tint: "bg-success/[0.04]", text: "text-success" },
];

const PLANNING_AREA_STYLES: Record<string, { bar: string; label: string }> = {
  Marketing: { bar: "bg-[#f7e2e4] border-[#e9bec6] text-[#9a5f6d]", label: "text-[#9a5f6d]" },
  Finance: { bar: "bg-[#e4f3ee] border-[#badacb] text-[#517c69]", label: "text-[#517c69]" },
  Operations: { bar: "bg-[#e8f1f8] border-[#c5d9e9] text-[#557d9e]", label: "text-[#557d9e]" },
  "System Development": { bar: "bg-[#e7eeff] border-[#cbd8fa] text-[#5d72b3]", label: "text-[#5d72b3]" },
  HR: { bar: "bg-[#fff4d8] border-[#f0ddb1] text-[#9d7732]", label: "text-[#9d7732]" },
  Purchasing: { bar: "bg-[#e8f3e8] border-[#cce1cb] text-[#5f8668]", label: "text-[#5f8668]" },
};

function PlanningAreaFilter({ areas, value, onChange }: { areas: AreaName[]; value: AreaName | "all"; onChange: (area: AreaName | "all") => void }) {
  return <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><Users className="h-3.5 w-3.5" /><select value={value} onChange={event => onChange(event.target.value as AreaName | "all")} className="bg-transparent text-[11px] font-medium text-foreground outline-none"><option value="all">All Teams</option>{areas.map(area => <option key={area} value={area}>{area}</option>)}</select></label>;
}

function taskSchedule(task: Task, index: number, windowDays = 42) {
  const start = new Date(`${task.startDate || `2026-08-${String(12 + index).padStart(2, "0")}`}T00:00:00Z`);
  const target = new Date(`${task.targetDate || `2026-08-${String(17 + index).padStart(2, "0")}`}T00:00:00Z`);
  const startMs = Number.isNaN(start.getTime()) ? Date.UTC(2026, 7, 12 + index) : start.getTime();
  const targetMs = Number.isNaN(target.getTime()) ? startMs + 5 * 86400000 : Math.max(target.getTime(), startMs + 2 * 86400000);
  const timelineStart = Date.UTC(2026, 7, 10);
  return {
    left: Math.max(0, Math.min(94, ((startMs - timelineStart) / 86400000 / windowDays) * 100)),
    width: Math.max(8, Math.min(42, ((targetMs - startMs) / 86400000 / windowDays) * 100)),
    start: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    target: target.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    startMs,
    targetMs,
  };
}

function planningIsoDate(milliseconds: number) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function milestonePosition(date: string, windowDays = 42) {
  const parsed = new Date(`${date}T00:00:00Z`).getTime();
  return Math.max(1, Math.min(98, ((parsed - Date.UTC(2026, 7, 10)) / 86400000 / windowDays) * 100));
}

function getBottlenecks(tasks: Task[]) {
  return tasks.filter(task => task.status !== "done").map(task => {
    const dependents = tasks.filter(candidate => candidate.status !== "done" && candidate.blockedBy?.taskId === task.id);
    return { task, dependents };
  }).filter(item => item.dependents.length > 1 || (item.task.isOverdue && item.dependents.length > 0));
}

function MilestonePlanner({ tasks, onRefresh }: { tasks: Task[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("2026-08-26");
  const [owner, setOwner] = useState(tasks[0]?.area || "Project owner");
  const [status, setStatus] = useState<Milestone["status"]>("planned");
  const project = tasks[0]?.project;
  const milestones = MILESTONES.filter(milestone => milestone.project === project);
  const addMilestone = () => {
    if (!project || !name.trim() || !date) return;
    MILESTONES.push({ id: `milestone-${Date.now()}`, name: name.trim(), date, project, owner: owner.trim() || "Project owner", status });
    setName(""); setAdding(false); onRefresh();
  };
  if (!project) return null;
  return <section className="mb-4 rounded-2xl border border-border bg-card p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[12px] font-semibold text-foreground">Milestones</p><p className="text-[10px] text-muted-foreground">Major deliveries shared across timeline and roadmap.</p></div><button onClick={() => setAdding(current => !current)} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-medium text-primary">+ Add Milestone</button></div><div className="mt-2 flex flex-wrap gap-1.5"><span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Project: {project}</span>{milestones.map(milestone => <span key={milestone.id} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]", milestone.status === "at_risk" ? "border-overdue/20 bg-overdue/[0.05] text-overdue" : "border-primary/15 bg-primary/[0.04] text-primary")}><Target className="h-3 w-3" />{milestone.name} · {milestone.date.slice(5)}</span>)}{!milestones.length && <span className="text-[10px] text-muted-foreground">No milestones yet.</span>}</div>{adding && <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_9rem_10rem_8rem_auto]"><label className="text-[10px] font-medium text-muted-foreground">Milestone name<input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === "Enter" && addMilestone()} placeholder="Website ready" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Date<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Owner<input value={owner} onChange={event => setOwner(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Status<select value={status} onChange={event => setStatus(event.target.value as Milestone["status"])} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="planned">Planned</option><option value="at_risk">At risk</option><option value="done">Done</option></select></label><div className="flex items-end gap-2"><button onClick={addMilestone} className="rounded-lg bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground">Save</button><button onClick={() => setAdding(false)} className="rounded-lg px-2 py-2 text-[11px] text-muted-foreground">Cancel</button></div></div>}</section>;
}

type PlanningFilter = { status: TaskStatus | "all"; priority: Priority | "all"; project: string; assignee: string; blockedOnly: boolean; waitingOnly: boolean; reviewOnly: boolean };
const DEFAULT_PLANNING_FILTER: PlanningFilter = { status: "all", priority: "all", project: "", assignee: "", blockedOnly: false, waitingOnly: false, reviewOnly: false };

function matchesPlanningFilter(task: Task, filter: PlanningFilter) {
  return (filter.status === "all" || task.status === filter.status) && (filter.priority === "all" || task.priority === filter.priority) && (!filter.project || task.project === filter.project) && (!filter.assignee || task.assignee === filter.assignee) && (!filter.blockedOnly || task.status === "blocked") && (!filter.waitingOnly || task.status === "waiting") && (!filter.reviewOnly || task.status === "review");
}

function PlanningFilterMenu({ tasks, value, onChange }: { tasks: Task[]; value: PlanningFilter; onChange: (value: PlanningFilter) => void }) {
  const [open, setOpen] = useState(false);
  const activeCount = Number(value.status !== "all") + Number(value.priority !== "all") + Number(Boolean(value.project)) + Number(Boolean(value.assignee)) + Number(value.blockedOnly) + Number(value.waitingOnly) + Number(value.reviewOnly);
  const assignees = Array.from(new Set(tasks.map(task => task.assignee).filter((assignee): assignee is string => Boolean(assignee))));
  const projects = Array.from(new Set(tasks.map(task => task.project).filter((project): project is string => Boolean(project))));
  return <div className="relative"><button onClick={() => setOpen(current => !current)} className={cn("rounded-xl border px-3 py-2 text-[11px] font-medium", open || activeCount ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}><SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />{activeCount ? `Filters · ${activeCount}` : "Filters"}</button>{open && <div className="absolute right-0 z-20 mt-2 grid w-72 gap-2 rounded-2xl border border-border bg-popover p-3 shadow-[0_12px_30px_var(--theme-shadow)] sm:grid-cols-2"><label className="text-[10px] font-medium text-muted-foreground">Status<select value={value.status} onChange={event => onChange({ ...value, status: event.target.value as TaskStatus | "all" })} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"><option value="all">All states</option>{PLANNING_COLUMNS.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Priority<select value={value.priority} onChange={event => onChange({ ...value, priority: event.target.value as Priority | "all" })} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"><option value="all">Any priority</option>{(["urgent", "high", "medium", "low"] as Priority[]).map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></label>{projects.length > 1 && <label className="col-span-2 text-[10px] font-medium text-muted-foreground">Project<select value={value.project} onChange={event => onChange({ ...value, project: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"><option value="">All projects</option>{projects.map(project => <option key={project}>{project}</option>)}</select></label>}<label className="col-span-2 text-[10px] font-medium text-muted-foreground">Assignee<select value={value.assignee} onChange={event => onChange({ ...value, assignee: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"><option value="">Anyone</option>{assignees.map(assignee => <option key={assignee}>{assignee}</option>)}</select></label>{(["blockedOnly", "waitingOnly", "reviewOnly"] as const).map(key => <label key={key} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><input type="checkbox" checked={value[key]} onChange={event => onChange({ ...value, [key]: event.target.checked })} className="accent-primary" />{key === "blockedOnly" ? "Blocked only" : key === "waitingOnly" ? "Waiting only" : "Needs review"}</label>)}<button onClick={() => onChange(DEFAULT_PLANNING_FILTER)} className="text-left text-[10px] font-medium text-primary">Clear filters</button></div>}</div>;
}

function PlanningBoard({ tasks, areas, selectedArea, onAreaChange, onTaskClick, onRefresh }: { tasks: Task[]; areas: AreaName[]; selectedArea: AreaName | "all"; onAreaChange: (area: AreaName | "all") => void; onTaskClick: (task: Task) => void; onRefresh: () => void }) {
  const [pendingWaiting, setPendingWaiting] = useState<Task | null>(null);
  const [blockerId, setBlockerId] = useState("");
  const [filters, setFilters] = useState<PlanningFilter>(DEFAULT_PLANNING_FILTER);
  const visibleTasks = (selectedArea === "all" ? tasks : tasks.filter(task => taskInvolvesArea(task, selectedArea))).filter(task => matchesPlanningFilter(task, filters));
  const bottlenecks = getBottlenecks(tasks);
  const setStatus = (task: Task, status: TaskStatus) => {
    if (status === "waiting" || status === "blocked") { setPendingWaiting(task); return; }
    Object.assign(task, { status, isWaiting: false, blockedBy: undefined, lastUpdate: "Updated just now" });
    commitTaskStore();
    onRefresh();
  };
  const confirmWaiting = (blocked: boolean) => {
    if (!pendingWaiting) return;
    const blocker = tasks.find(task => task.id === blockerId);
    Object.assign(pendingWaiting, blocked ? {
      status: "blocked" as TaskStatus, isWaiting: false, nextActionBy: blocker?.area || pendingWaiting.nextActionBy,
      blockedBy: blocker ? { kind: "task" as DependencyKind, type: "blocking" as DependencyType, label: blocker.title, taskId: blocker.id, owner: blocker.area } : { kind: "decision" as DependencyKind, type: "blocking" as DependencyType, label: "A decision or approval", owner: pendingWaiting.nextActionBy },
      lastUpdate: "Blocker noted just now",
    } : { status: "waiting" as TaskStatus, isWaiting: true, lastUpdate: "Waiting noted just now" });
    commitTaskStore();
    setPendingWaiting(null); setBlockerId(""); onRefresh();
  };
  return <div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="binnie-heading text-lg font-bold text-foreground">Work board</h2><p className="mt-1 text-[11px] text-muted-foreground">Move a card when its work state changes. Waiting and Blocked stay intentionally separate.</p></div><div className="flex items-center gap-2"><PlanningFilterMenu tasks={tasks} value={filters} onChange={setFilters} /><PlanningAreaFilter areas={areas} value={selectedArea} onChange={onAreaChange} /></div></div>
    {tasks[0]?.project && <div className="mb-4"><QuickCapture organization={tasks[0].org} project={tasks[0].project} area={selectedArea === "all" ? undefined : selectedArea} onSaved={onRefresh} /></div>}
    <MilestonePlanner tasks={tasks} onRefresh={onRefresh} />
    {bottlenecks.length > 0 && <div className="mb-4 rounded-2xl border border-overdue/20 bg-overdue/[0.045] p-3"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-overdue" /><div><p className="text-[12px] font-semibold text-foreground">Bottlenecks</p><p className="text-[10px] text-muted-foreground">Only work blocking multiple downstream tasks is surfaced here.</p></div></div><div className="mt-2 flex flex-wrap gap-2">{bottlenecks.map(({ task, dependents }) => <button key={task.id} onClick={() => onTaskClick(task)} className="rounded-lg bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground shadow-sm">{task.area} · {task.title} <span className="text-overdue">→ {dependents.length} blocked</span></button>)}</div></div>}
    <div className="mb-4 rounded-2xl border border-border bg-card p-3"><div className="flex items-center justify-between"><div><p className="text-[12px] font-semibold text-foreground">Team workload</p><p className="text-[10px] text-muted-foreground">A light capacity view for active work—enough to spot uneven load without turning it into timesheets.</p></div><BarChart2 className="h-4 w-4 text-primary" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from(new Set(tasks.filter(task => task.status !== "done").map(task => task.assignee || task.area))).map(owner => { const ownerTasks = tasks.filter(task => task.status !== "done" && (task.assignee || task.area) === owner); const hours = ownerTasks.reduce((total, task) => total + (task.estimatedHours || 1), 0); const blocked = ownerTasks.filter(task => task.status === "blocked").length; return <div key={owner} className="rounded-xl bg-muted/45 p-2.5"><div className="flex items-center gap-2"><Avatar name={owner} size="xs" /><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground">{owner}</span><span className={cn("text-[10px]", blocked ? "text-overdue" : "text-muted-foreground")}>{blocked ? `${blocked} blocked` : `${hours}h planned`}</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, hours * 12)}%` }} /></div></div>; })}</div></div>
    {pendingWaiting && <div className="mb-4 rounded-2xl border border-info/20 bg-info/[0.055] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><p className="text-[12px] font-semibold text-foreground">Does this stop “{pendingWaiting.title}” from moving forward?</p><p className="mt-1 text-[11px] text-muted-foreground">Waiting means someone owes an input; Blocked means there is a real dependency.</p></div><label className="text-[10px] font-medium text-muted-foreground">Blocked by<select value={blockerId} onChange={event => setBlockerId(event.target.value)} className="mt-1 block rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground"><option value="">Decision or approval</option>{tasks.filter(task => task.id !== pendingWaiting.id).map(task => <option key={task.id} value={task.id}>{task.area} · {task.title}</option>)}</select></label><div className="flex gap-2"><button onClick={() => confirmWaiting(false)} className="rounded-xl border border-info/25 bg-card px-3 py-2 text-[11px] font-medium text-info">Can still continue</button><button onClick={() => confirmWaiting(true)} className="rounded-xl bg-overdue px-3 py-2 text-[11px] font-medium text-white">Task is blocked</button></div></div></div>}
    <div className="grid gap-3 xl:grid-cols-6">{PLANNING_COLUMNS.map(column => { const columnTasks = visibleTasks.filter(task => task.status === column.id); return <div key={column.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); const task = TASKS.find(item => item.id === id); if (task) setStatus(task, column.id); }} className={cn("min-h-56 rounded-2xl border border-border p-2.5", column.tint)}><div className="mb-2 flex items-start gap-2 px-1"><StatusDot status={column.id} /><div className="min-w-0"><p className={cn("text-[12px] font-semibold", column.text)}>{column.label}</p><p className="text-[10px] text-muted-foreground">{column.help}</p></div><span className="ml-auto rounded-full bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{columnTasks.length}</span></div><div className="space-y-2">{columnTasks.map(task => <div key={task.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", task.id)} onClick={() => onTaskClick(task)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter") onTaskClick(task); }} className="cursor-grab rounded-xl border border-border bg-card p-3 text-left shadow-[0_2px_8px_var(--theme-shadow)] transition hover:-translate-y-px hover:border-primary/35 active:cursor-grabbing"><div className="flex gap-2"><p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-foreground">{task.title}</p>{(task.priority === "urgent" || task.priority === "high") && <PriorityDot priority={task.priority} />}</div><div className="mt-2 flex items-center justify-between gap-2"><AreaBadge area={task.area} />{task.assignee && <Avatar name={task.assignee} size="xs" />}</div><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{task.targetDate || task.deadline || "No target"}</span>{task.blockedBy && <span className="inline-flex items-center gap-1 text-overdue"><GitBranch className="h-3 w-3" />Dependency</span>}</div></div>)}{columnTasks.length === 0 && <p className="px-1 py-6 text-center text-[10px] text-muted-foreground">Drop work here</p>}</div></div>; })}</div>
  </div>;
}

// Kept as a compact display fallback while the interactive timeline is used by planning views.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlanningTimelineLegacy({ tasks, areas, selectedArea, onAreaChange, onTaskClick }: { tasks: Task[]; areas: AreaName[]; selectedArea: AreaName | "all"; onAreaChange: (area: AreaName | "all") => void; onTaskClick: (task: Task) => void }) {
  const visibleTasks = selectedArea === "all" ? tasks.filter(task => task.status !== "done") : tasks.filter(task => task.area === selectedArea && task.status !== "done");
  const visibleAreas = selectedArea === "all" ? areas.filter(area => visibleTasks.some(task => task.area === area)) : [selectedArea];
  const weeks = Array.from({ length: 6 }, (_, index) => new Date(Date.UTC(2026, 7, 10 + index * 7)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }));
  return <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="binnie-heading text-lg font-bold text-foreground">Parallel timeline</h2><p className="mt-1 text-[11px] text-muted-foreground">Grouped by department · weeks · only solid dependency markers represent real blockers.</p></div><PlanningAreaFilter areas={areas} value={selectedArea} onChange={onAreaChange} /></div><div className="overflow-x-auto rounded-2xl border border-border bg-card"><div className="min-w-[820px]"><div className="grid grid-cols-[155px_1fr] border-b border-border bg-muted/35"><div className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Department</div><div className="grid grid-cols-6">{weeks.map(week => <div key={week} className="border-l border-border px-3 py-3 text-[10px] font-medium text-muted-foreground">{week}</div>)}</div></div>{visibleAreas.map(area => { const areaTasks = visibleTasks.filter(task => task.area === area); const laneHeight = Math.max(96, 30 + areaTasks.length * 44); const style = PLANNING_AREA_STYLES[area] || { bar: "bg-muted border-border text-foreground", label: "text-foreground" }; return <div key={area} className="grid grid-cols-[155px_1fr] border-b border-border last:border-b-0"><div className="border-r border-border bg-muted/20 px-4 py-4"><p className={cn("text-[12px] font-semibold", style.label)}>{area}</p><p className="mt-1 text-[10px] text-muted-foreground">{areaTasks.length} active</p></div><div className="relative" style={{ height: laneHeight, backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)", backgroundSize: "16.6667% 100%" }}><div className="absolute inset-y-0 z-[1] w-px bg-primary/65" style={{ left: "9.5%" }}><span className="absolute -top-5 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">Today</span></div>{areaTasks.map((task, index) => { const schedule = taskSchedule(task, index); return <button key={task.id} title={`${task.title}\n${schedule.start} – ${schedule.target}\n${task.area}${task.assignee ? ` · ${task.assignee}` : ""}${task.blockedBy ? `\nBlocked by: ${task.blockedBy.label}` : ""}`} onClick={() => onTaskClick(task)} className={cn("absolute z-[2] flex h-8 items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-left text-[10px] font-medium shadow-[0_2px_6px_var(--theme-shadow)] transition hover:brightness-[0.98]", style.bar, task.status === "blocked" && "border-l-4 border-l-overdue")} style={{ left: `${schedule.left}%`, top: 28 + index * 40, width: `${schedule.width}%` }}><span className="truncate">{task.title}</span>{task.blockedBy && <GitBranch className="h-3 w-3 flex-shrink-0" />}</button>; })}</div></div>; })}</div></div>{visibleTasks.some(task => task.status === "blocked") && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><GitBranch className="h-3.5 w-3.5 text-overdue" />A solid marker indicates a task that cannot move until its named dependency is complete. Unrelated work remains parallel.</p>}</div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlanningTimelineLegacyV2({ tasks, areas, selectedArea, onAreaChange, onTaskClick, onRefresh }: { tasks: Task[]; areas: AreaName[]; selectedArea: AreaName | "all"; onAreaChange: (area: AreaName | "all") => void; onTaskClick: (task: Task) => void; onRefresh?: () => void }) {
  const [, setRevision] = useState(0);
  const [filters, setFilters] = useState<PlanningFilter>(DEFAULT_PLANNING_FILTER);
  const [scale, setScale] = useState<"days" | "weeks" | "months">("weeks");
  const range = scale === "days" ? { windowDays: 14, tickDays: 2 } : scale === "weeks" ? { windowDays: 42, tickDays: 7 } : { windowDays: 90, tickDays: 30 };
  const timeLabels = Array.from({ length: range.windowDays / range.tickDays }, (_, index) => new Date(Date.UTC(2026, 7, 10 + index * range.tickDays)).toLocaleDateString("en-US", scale === "months" ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }));
  const todayPosition = Math.max(1, Math.min(98, (3 / range.windowDays) * 100));
  const visibleTasks = (selectedArea === "all" ? tasks : tasks.filter(task => taskInvolvesArea(task, selectedArea))).filter(task => task.status !== "done" && matchesPlanningFilter(task, filters));
  const visibleAreas = selectedArea === "all" ? areas.filter(area => visibleTasks.some(task => taskInvolvesArea(task, area))) : [selectedArea];
  const milestones = MILESTONES.filter(milestone => visibleTasks.some(task => task.project === milestone.project));
  const lanes = visibleAreas.map((area, laneIndex) => {
    const laneTasks = visibleTasks.filter(task => taskInvolvesArea(task, area));
    const height = Math.max(92, 32 + laneTasks.length * 42);
    const top = visibleAreas.slice(0, laneIndex).reduce((total, precedingArea) => total + Math.max(92, 32 + visibleTasks.filter(task => taskInvolvesArea(task, precedingArea)).length * 42), 0);
    return { area, tasks: laneTasks, top, height };
  });
  const cumulativeTop = lanes.reduce((total, lane) => total + lane.height, 0);
  const positions = new Map<string, { x: number; y: number }>();
  lanes.forEach(lane => lane.tasks.forEach((task, index) => {
    const schedule = taskSchedule(task, tasks.indexOf(task), range.windowDays);
    positions.set(task.id, { x: 190 + ((schedule.left + schedule.width) / 100) * 810, y: lane.top + 44 + index * 40 });
  }));
  const dependencyLines = visibleTasks.flatMap(task => {
    if (!task.blockedBy?.taskId) return [];
    const source = positions.get(task.blockedBy.taskId);
    const target = positions.get(task.id);
    return source && target ? [{ id: `${source.x}-${target.x}-${task.id}`, source, target }] : [];
  });
  const reschedule = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const task = TASKS.find(item => item.id === event.dataTransfer.getData("text/plain"));
    if (!task) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.94, (event.clientX - bounds.left) / bounds.width));
    const existing = taskSchedule(task, tasks.indexOf(task), range.windowDays);
    const duration = Math.max(2, Math.round((existing.targetMs - existing.startMs) / 86400000));
    const start = Date.UTC(2026, 7, 10) + Math.round(ratio * range.windowDays) * 86400000;
    Object.assign(task, { startDate: planningIsoDate(start), targetDate: planningIsoDate(start + duration * 86400000), deadline: new Date(start + duration * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), lastUpdate: "Rescheduled on timeline just now" });
    commitTaskStore();
    setRevision(current => current + 1);
    onRefresh?.();
  };
  return <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="binnie-heading text-lg font-bold text-foreground">Parallel timeline</h2><p className="mt-1 text-[11px] text-muted-foreground">Drag a bar to reschedule. Solid arrows only show real blocking dependencies; work without arrows can continue in parallel.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-border bg-card p-1">{(["days", "weeks", "months"] as const).map(value => <button key={value} onClick={() => setScale(value)} className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-medium capitalize", scale === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{value}</button>)}</div><PlanningFilterMenu tasks={tasks} value={filters} onChange={setFilters} /><PlanningAreaFilter areas={areas} value={selectedArea} onChange={onAreaChange} /></div></div><div className="overflow-x-auto rounded-2xl border border-border bg-card"><div className="min-w-[820px]"><div className="grid grid-cols-[155px_1fr] border-b border-border bg-muted/35"><div className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Department</div><div className="grid" style={{ gridTemplateColumns: `repeat(${timeLabels.length}, minmax(0, 1fr))` }}>{timeLabels.map(label => <div key={label} className="border-l border-border px-3 py-3 text-[10px] font-medium text-muted-foreground">{label}</div>)}</div></div><div className="grid grid-cols-[155px_1fr] border-b border-border"><div className="bg-muted/20 px-4 py-3 text-[10px] font-medium text-muted-foreground">Milestones</div><div className="relative h-14" style={{ backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)", backgroundSize: `${100 / timeLabels.length}% 100%` }}>{milestones.map(milestone => <span key={milestone.id} title={`${milestone.name} · ${milestone.owner}`} className={cn("absolute top-3 -translate-x-1/2 text-center", milestone.status === "at_risk" ? "text-overdue" : milestone.status === "done" ? "text-success" : "text-primary")} style={{ left: `${milestonePosition(milestone.date, range.windowDays)}%` }}><span className="mx-auto block h-3 w-3 rotate-45 border border-current bg-card" /><span className="mt-1 block max-w-20 truncate text-[9px] font-medium">{milestone.name}</span></span>)}</div></div><div className="relative"><svg aria-label="Blocking dependency connectors" className="pointer-events-none absolute inset-0 z-[3] h-full w-full" preserveAspectRatio="none" viewBox={`0 0 1000 ${Math.max(cumulativeTop, 1)}`}><defs><marker id="binnie-dependency-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="var(--overdue)" /></marker></defs>{dependencyLines.map(line => <path key={line.id} d={`M ${line.source.x} ${line.source.y} C ${line.source.x + 36} ${line.source.y}, ${line.target.x - 36} ${line.target.y}, ${line.target.x} ${line.target.y}`} fill="none" stroke="var(--overdue)" strokeWidth="1.5" markerEnd="url(#binnie-dependency-arrow)" opacity="0.8" />)}</svg>{lanes.map(lane => { const style = PLANNING_AREA_STYLES[lane.area] || { bar: "bg-muted border-border text-foreground", label: "text-foreground" }; return <div key={lane.area} className="grid grid-cols-[155px_1fr] border-b border-border last:border-b-0"><div className="border-r border-border bg-muted/20 px-4 py-4"><p className={cn("text-[12px] font-semibold", style.label)}>{lane.area}</p><p className="mt-1 text-[10px] text-muted-foreground">{lane.tasks.length} active</p></div><div onDragOver={event => event.preventDefault()} onDrop={reschedule} className="relative" style={{ height: lane.height, backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)", backgroundSize: `${100 / timeLabels.length}% 100%` }}><div className="absolute inset-y-0 z-[1] w-px bg-primary/65" style={{ left: `${todayPosition}%` }}><span className="absolute -top-5 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">Today</span></div>{lane.tasks.map((task, index) => { const schedule = taskSchedule(task, tasks.indexOf(task), range.windowDays); return <button key={task.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", task.id)} title={`${task.title}\n${schedule.start} – ${schedule.target}\n${task.area}${task.assignee ? ` · ${task.assignee}` : ""}${task.blockedBy ? `\nBlocked by: ${task.blockedBy.label}` : ""}`} onClick={() => onTaskClick(task)} className={cn("absolute z-[4] flex h-8 cursor-grab items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-left text-[10px] font-medium shadow-[0_2px_6px_var(--theme-shadow)] transition hover:brightness-[0.98] active:cursor-grabbing", style.bar, task.status === "blocked" && "border-l-4 border-l-overdue")} style={{ left: `${schedule.left}%`, top: 28 + index * 40, width: `${schedule.width}%` }}><span className="truncate">{task.title}</span>{task.blockedBy && <GitBranch className="h-3 w-3 flex-shrink-0" />}</button>; })}</div></div>; })}</div></div></div>{dependencyLines.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><GitBranch className="h-3.5 w-3.5 text-overdue" />{dependencyLines.length} real blocking {dependencyLines.length === 1 ? "connector" : "connectors"} shown. Other work is intentionally left unconnected.</p>}</div>;
}

type TimelineComposerMode = "binnie" | "manual" | "milestone";

interface TimelineWorkDraft {
  id: string; title: string; area: AreaName; assignee?: string; startDate: string; targetDate: string;
  deadlineLabel: string; status: TaskStatus; priority: Priority; dependencyTitle?: string; link?: string;
  attachments: string[]; notes?: string; needsDependencyConfirmation?: boolean;
}

const TIMELINE_DEPARTMENTS: AreaName[] = ["Marketing", "Finance", "Design", "System Development", "Operations", "Purchasing", "HR", "Front Office", "F&B", "Maintenance", "Warehouse", "Housekeeping"];
let timelineCreationSequence = 0;

function nextTimelineCreationId(prefix: string) {
  timelineCreationSequence += 1;
  return `${prefix}-${timelineCreationSequence}`;
}

function timelineAreaFromText(value: string, fallback: AreaName = "Operations"): AreaName {
  const found = TIMELINE_DEPARTMENTS.find(area => new RegExp(`\\b${area.replace(" ", "\\s+")}\\b`, "i").test(value));
  if (found) return found;
  if (/design|figma|banner|website copy/i.test(value)) return "Marketing";
  if (/system|development|code|website build|booking flow/i.test(value)) return "System Development";
  return fallback;
}

function titleFromTimelineAction(value: string, inheritedVerb?: string) {
  const clean = value.replace(/https?:\/\/\S+/gi, "").replace(/\b(?:this week|next week|by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|today|tomorrow)\b/gi, "").replace(/\s+/g, " ").trim().replace(/^[,;:.\s]+|[,;:.\s]+$/g, "");
  if (!clean) return "New work";
  if (/^website copy$/i.test(clean)) return "Draft website copy";
  if (/^promo materials$/i.test(clean)) return "Prepare promo materials";
  if (/^staffing plan$/i.test(clean)) return "Prepare staffing plan";
  if (/^(prepare|draft|create|update|approve|confirm|finalize|publish|review|write|design|plan|brief)\b/i.test(clean)) return clean[0].toUpperCase() + clean.slice(1);
  return `${inheritedVerb || "Prepare"} ${clean}`.replace(/^./, letter => letter.toUpperCase());
}

function timelineDateFromText(value: string) {
  const match = value.match(/\b(today|tomorrow|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1]?.toLowerCase();
  const base = Date.UTC(2026, 7, 13);
  if (!match) return { startDate: "2026-08-13", targetDate: "2026-08-20", deadlineLabel: "This week" };
  if (match === "today") return { startDate: "2026-08-13", targetDate: "2026-08-13", deadlineLabel: "Today" };
  if (match === "tomorrow") return { startDate: "2026-08-13", targetDate: "2026-08-14", deadlineLabel: "Tomorrow" };
  if (match === "this week") return { startDate: "2026-08-13", targetDate: "2026-08-16", deadlineLabel: "This week" };
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wanted = weekdays.indexOf(match);
  const current = new Date(base).getUTCDay();
  const daysAway = (wanted - current + 7) % 7 || 7;
  const target = base + daysAway * 86400000;
  return { startDate: "2026-08-13", targetDate: planningIsoDate(target), deadlineLabel: `Due ${match[0].toUpperCase()}${match.slice(1)}` };
}

function linkTypeFromUrl(url: string): ResourceType {
  if (/figma\.com/i.test(url)) return "figma";
  if (/docs\.google\.com\/spreadsheets/i.test(url) || /\.xlsx?($|\?)/i.test(url)) return "sheet";
  if (/github\.com/i.test(url)) return "github";
  if (/drive\.google\.com/i.test(url)) return "drive";
  if (/notion\.so/i.test(url)) return "notion";
  return "website";
}

function fileTypeFromName(name: string): TaskFile["type"] {
  return /\.(xlsx?|csv)$/i.test(name) ? "excel" : /\.(png|jpe?g|webp|gif)$/i.test(name) ? "screenshot" : /\.pdf$/i.test(name) ? "pdf" : "doc";
}

function findTimelineDependency(title: string, candidates: Task[]) {
  const words = title.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  return candidates.find(task => words.length > 0 && words.some(word => task.title.toLowerCase().includes(word)));
}

function createTimelineWorkDrafts(input: string, fallbackArea: AreaName, attachments: string[] = []): TimelineWorkDraft[] {
  const source = input.trim();
  if (!source) return [];
  const departmentMatches = Array.from(source.matchAll(/\b(Marketing|Finance|System Development|Operations|Purchasing|HR|Front Office|F&B|Maintenance|Warehouse|Housekeeping|Design)\b/gi));
  const sections = departmentMatches.length
    ? departmentMatches.map((match, index) => ({ area: timelineAreaFromText(match[1]), text: source.slice((match.index || 0) + match[0].length, departmentMatches[index + 1]?.index || source.length) }))
    : source.split(/\n|(?<=\.)\s+/).filter(Boolean).map(text => ({ area: timelineAreaFromText(text, fallbackArea), text }));

  return sections.flatMap((section, sectionIndex) => {
    const text = section.text.replace(/^\s*(?:and|,)?\s*/i, "");
    const explicitMatch = text.match(/\b(after|once|cannot\s+start\s+until|can(?:not|'t)\s+start\s+until)\s+(.+?)(?:[.!]|$)/i);
    const needsBeforeMatch = explicitMatch ? null : text.match(/\bneeds\s+(.+?)\s+before(?:\s+it)?(?:[.!]|$)/i);
    const ambiguousMatch = explicitMatch || needsBeforeMatch ? null : text.match(/\b(depends on|waiting for|needs)\s+(.+?)(?:[.!]|$)/i);
    const actionText = text.slice(0, explicitMatch?.index ?? needsBeforeMatch?.index ?? ambiguousMatch?.index ?? text.length).replace(/^\s*(?:can|should|will)\s+/i, "").trim();
    const verb = actionText.match(/^(prepare|draft|create|update|approve|confirm|finalize|publish|review|write|design|plan|brief)\b/i)?.[1];
    const actions = actionText.split(/\s+and\s+|\s*,\s*/i).map(action => action.trim()).filter(Boolean);
    const dates = timelineDateFromText(text);
    const dependencySource = explicitMatch?.[2] || needsBeforeMatch?.[1] || ambiguousMatch?.[2];
    const dependencyTitle = dependencySource && /price/i.test(dependencySource) ? "Confirm accommodation prices" : dependencySource?.replace(/^(?:Finance|Marketing|Operations|Purchasing|HR|Design|System Development)\s+/i, "").replace(/\b(?:approves?|confirms?|finishes|completes?)\b/i, "").replace(/\s+/g, " ").trim();
    return actions.map((action, actionIndex) => ({
      id: `timeline-draft-${sectionIndex}-${actionIndex}-${Date.now()}`,
      title: titleFromTimelineAction(action, verb), area: section.area, startDate: dates.startDate, targetDate: dates.targetDate,
      deadlineLabel: dates.deadlineLabel, status: (explicitMatch || needsBeforeMatch ? "blocked" : "ready") as TaskStatus, priority: (/urgent|asap|critical/i.test(text) ? "urgent" : /important|priority/i.test(text) ? "high" : "medium") as Priority,
      dependencyTitle, link: text.match(/https?:\/\/[^\s,]+/i)?.[0], attachments, needsDependencyConfirmation: Boolean(ambiguousMatch),
    }));
  }).filter(draft => draft.title !== "New work");
}

function saveTimelineWorkDrafts(drafts: TimelineWorkDraft[], project: string, org: OrgName) {
  const created: Task[] = drafts.map((draft, index) => ({
    id: `timeline-${Date.now()}-${TASKS.length + index}`, title: draft.title, org, area: draft.area, project,
    priority: draft.priority, status: draft.status, assignee: draft.assignee, nextActionBy: draft.assignee || draft.area,
    startDate: draft.startDate, targetDate: draft.targetDate, deadline: draft.deadlineLabel, isDelegated: Boolean(draft.assignee),
    isWaiting: draft.status === "waiting", links: draft.link ? [{ label: "Captured link", url: draft.link, type: linkTypeFromUrl(draft.link) }] : undefined,
    files: draft.attachments.length ? draft.attachments.map(name => ({ name, type: fileTypeFromName(name) })) : undefined,
    originalCapture: draft.notes, lastUpdate: "Just now", activity: [{ type: "assigned" as const, actor: "You", text: "Created with Binnie from the project timeline", time: "Just now" }],
  }));
  drafts.forEach((draft, index) => {
    if (draft.status !== "blocked" || !draft.dependencyTitle) return;
    const dependency = findTimelineDependency(draft.dependencyTitle, [...created, ...TASKS.filter(task => task.project === project)]);
    created[index].blockedBy = dependency ? { kind: "task", type: "blocking", label: dependency.title, taskId: dependency.id, owner: dependency.area } : { kind: "decision", type: "blocking", label: draft.dependencyTitle };
  });
  created.forEach(task => createTask(task));
  return created;
}

function TimelineWorkComposer({ mode, project, org, areas, defaultArea, onCreated, onClose }: { mode: TimelineComposerMode; project: string; org: OrgName; areas: AreaName[]; defaultArea?: AreaName; onCreated: () => void; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<TimelineWorkDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manual, setManual] = useState({ title: "", area: defaultArea || areas[0] || "Operations", assignee: "", startDate: "2026-08-13", targetDate: "2026-08-20", status: "ready" as TaskStatus, priority: "medium" as Priority, blockedBy: "", notes: "" });
  const [milestone, setMilestone] = useState({ name: "", date: "2026-08-26", owner: defaultArea || "Project owner", description: "" });
  const allProjectTasks = TASKS.filter(task => task.project === project);
  const updateDraft = (id: string, patch: Partial<TimelineWorkDraft>) => setDrafts(current => current.map(draft => draft.id === id ? { ...draft, ...patch } : draft));
  const organize = () => setDrafts(createTimelineWorkDrafts(input, defaultArea || areas[0] || "Operations", attachments));
  const readyCount = drafts.filter(draft => draft.status !== "blocked").length;
  const blockedCount = drafts.filter(draft => draft.status === "blocked").length;
  const addManual = () => {
    if (!manual.title.trim()) return;
    const blocker = allProjectTasks.find(task => task.id === manual.blockedBy);
    createTask({ title: manual.title.trim(), org, area: manual.area, project, priority: manual.priority, status: manual.status, assignee: manual.assignee || undefined, nextActionBy: manual.assignee || manual.area, startDate: manual.startDate, targetDate: manual.targetDate, deadline: manual.targetDate, isDelegated: Boolean(manual.assignee), isWaiting: manual.status === "waiting", blockedBy: manual.status === "blocked" ? blocker ? { kind: "task", type: "blocking", label: blocker.title, taskId: blocker.id, owner: blocker.area } : { kind: "decision", type: "blocking", label: "A decision or approval" } : undefined, originalCapture: manual.notes || undefined, lastUpdate: "Just now", activity: [{ type: "assigned", actor: "You", text: "Added manually from the project timeline", time: "Just now" }] });
    onCreated(); onClose();
  };
  const addMilestone = () => {
    if (!milestone.name.trim() || !milestone.date) return;
    MILESTONES.push({ id: nextTimelineCreationId("milestone"), name: milestone.name.trim(), date: milestone.date, project, owner: milestone.owner.trim() || "Project owner", status: "planned", description: milestone.description.trim() || undefined });
    onCreated(); onClose();
  };
  return <section className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 shadow-[0_10px_24px_var(--theme-shadow)]"><div className="mb-3 flex items-start justify-between gap-3"><div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-3.5 w-3.5" /></span><div><h3 className="text-[13px] font-semibold text-foreground">{mode === "binnie" ? "Tell Binnie what needs to happen" : mode === "manual" ? "Add work manually" : "Add milestone"}</h3><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{mode === "binnie" ? "Write it naturally. Binnie will organize the work, teams, dates, and dependencies." : mode === "manual" ? "Project is already selected. Add only the details that matter." : "Keep major project deliveries separate from day-to-day work."}</p><span className="mt-2 inline-flex rounded-full bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">Project: {project}</span></div></div><button onClick={onClose} aria-label="Close add work" className="rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"><X className="h-4 w-4" /></button></div>{mode === "binnie" && <div><textarea value={input} onChange={event => setInput(event.target.value)} rows={4} placeholder="What needs to happen for this project?" className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] leading-5 text-foreground placeholder:text-muted-foreground focus:border-primary/45" />{attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map((name, index) => <span key={`${name}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-[10px] text-muted-foreground"><Paperclip className="h-3 w-3" />{name}<button onClick={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${name}`}><X className="h-3 w-3" /></button></span>)}</div>}<div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-card hover:text-foreground"><Paperclip className="h-3.5 w-3.5" />Attach file<input type="file" multiple className="sr-only" onChange={event => setAttachments(current => [...current, ...Array.from(event.target.files || []).map(file => file.name)])} /></label><button onClick={organize} disabled={!input.trim()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[11px] font-medium text-primary-foreground disabled:opacity-45"><Sparkles className="h-3.5 w-3.5" />Organize with Binnie</button></div>{drafts.length > 0 && <div className="mt-4 border-t border-primary/15 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[12px] font-semibold text-foreground">Binnie found {drafts.length} {drafts.length === 1 ? "piece" : "pieces"} of work</p><p className="mt-0.5 text-[10px] text-muted-foreground">{readyCount ? `${readyCount} ${readyCount === 1 ? "task can" : "tasks can"} start now.` : ""}{readyCount && blockedCount ? " " : ""}{blockedCount ? `${blockedCount} ${blockedCount === 1 ? "task needs" : "tasks need"} to wait for a real dependency.` : ""}</p></div><button onClick={() => { saveTimelineWorkDrafts(drafts, project, org); onCreated(); onClose(); }} className="rounded-xl bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground">Add All to Timeline</button></div><div className="mt-3 space-y-2">{drafts.map(draft => <div key={draft.id} className="rounded-xl border border-border bg-card p-3"><div className="flex gap-2.5"><span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-3 w-3" /></span><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-foreground">{draft.title}</p><div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground"><AreaBadge area={draft.area} /><span>{draft.status === "blocked" ? <span className="text-overdue">Blocked by → {draft.dependencyTitle || "a dependency"}</span> : "Ready"}</span><span>{draft.deadlineLabel}</span>{draft.link && <span className="inline-flex items-center gap-1 text-primary"><Link2 className="h-3 w-3" />Related link</span>}{draft.attachments.length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{draft.attachments.join(", ")}</span>}</div>{draft.needsDependencyConfirmation && <div className="mt-2 rounded-lg border border-info/20 bg-info/[0.05] p-2"><p className="text-[10px] font-medium text-foreground">Does this work actually need to wait?</p><div className="mt-1.5 flex gap-2"><button onClick={() => updateDraft(draft.id, { status: "blocked", needsDependencyConfirmation: false })} className="rounded-md bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">Yes, it cannot start yet</button><button onClick={() => updateDraft(draft.id, { status: "ready", dependencyTitle: undefined, needsDependencyConfirmation: false })} className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">No, it can happen in parallel</button></div></div>}{editingId === draft.id && <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3"><input value={draft.title} onChange={event => updateDraft(draft.id, { title: event.target.value })} className="rounded-lg border border-border px-2 py-1.5 text-[11px] text-foreground" /><select value={draft.area} onChange={event => updateDraft(draft.id, { area: event.target.value as AreaName })} className="rounded-lg border border-border px-2 py-1.5 text-[11px] text-foreground">{Array.from(new Set([...areas, ...TIMELINE_DEPARTMENTS])).map(area => <option key={area}>{area}</option>)}</select><select value={draft.status} onChange={event => updateDraft(draft.id, { status: event.target.value as TaskStatus })} className="rounded-lg border border-border px-2 py-1.5 text-[11px] text-foreground"><option value="ready">Ready</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="blocked">Blocked</option></select></div>}</div><div className="flex flex-col gap-1"><button onClick={() => setEditingId(current => current === draft.id ? null : draft.id)} className="rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">Edit</button><button onClick={() => setDrafts(current => current.filter(item => item.id !== draft.id))} aria-label={`Remove ${draft.title}`} className="rounded-lg p-1 text-muted-foreground hover:bg-overdue/10 hover:text-overdue"><X className="h-3.5 w-3.5" /></button></div></div></div>)}</div>{readyCount > 1 && <p className="mt-3 rounded-xl bg-primary/[0.045] px-3 py-2 text-[11px] text-primary">These workstreams can move in parallel. Waiting does not mean stopping.</p>}</div>}</div>}{mode === "manual" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="sm:col-span-2 lg:col-span-3 text-[10px] font-medium text-muted-foreground">Work / Task Name<input autoFocus value={manual.title} onChange={event => setManual(current => ({ ...current, title: event.target.value }))} placeholder="What needs to happen?" className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Department / Area<select value={manual.area} onChange={event => setManual(current => ({ ...current, area: event.target.value as AreaName }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground">{Array.from(new Set([...areas, ...TIMELINE_DEPARTMENTS])).map(area => <option key={area}>{area}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Assignee<input value={manual.assignee} onChange={event => setManual(current => ({ ...current, assignee: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Status<select value={manual.status} onChange={event => setManual(current => ({ ...current, status: event.target.value as TaskStatus }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground">{(["ready", "in_progress", "waiting", "blocked", "review"] as TaskStatus[]).map(status => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Start Date<input type="date" value={manual.startDate} onChange={event => setManual(current => ({ ...current, startDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Target / End Date<input type="date" value={manual.targetDate} onChange={event => setManual(current => ({ ...current, targetDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Priority<select value={manual.priority} onChange={event => setManual(current => ({ ...current, priority: event.target.value as Priority }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground">{(["low", "medium", "high", "urgent"] as Priority[]).map(priority => <option key={priority}>{priority}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Blocked By<select value={manual.blockedBy} onChange={event => setManual(current => ({ ...current, blockedBy: event.target.value }))} disabled={manual.status !== "blocked"} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground disabled:opacity-50"><option value="">Decision or approval</option>{allProjectTasks.map(task => <option key={task.id} value={task.id}>{task.area} · {task.title}</option>)}</select></label><label className="sm:col-span-2 lg:col-span-3 text-[10px] font-medium text-muted-foreground">Notes<input value={manual.notes} onChange={event => setManual(current => ({ ...current, notes: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-3 py-2 text-[11px] text-muted-foreground">Cancel</button><button onClick={addManual} disabled={!manual.title.trim()} className="rounded-xl bg-primary px-3.5 py-2 text-[11px] font-medium text-primary-foreground disabled:opacity-45">Add to Timeline</button></div></div>}{mode === "milestone" && <div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[10px] font-medium text-muted-foreground">Milestone Name<input autoFocus value={milestone.name} onChange={event => setMilestone(current => ({ ...current, name: event.target.value }))} placeholder="Website Ready" className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Date<input type="date" value={milestone.date} onChange={event => setMilestone(current => ({ ...current, date: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Owner<input value={milestone.owner} onChange={event => setMilestone(current => ({ ...current, owner: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><label className="sm:col-span-2 text-[10px] font-medium text-muted-foreground">Description<input value={milestone.description} onChange={event => setMilestone(current => ({ ...current, description: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-[11px] text-foreground" /></label><div className="sm:col-span-2 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-3 py-2 text-[11px] text-muted-foreground">Cancel</button><button onClick={addMilestone} disabled={!milestone.name.trim()} className="rounded-xl bg-primary px-3.5 py-2 text-[11px] font-medium text-primary-foreground disabled:opacity-45">Add Milestone</button></div></div>}</section>;
}

function PlanningTimeline({ tasks, areas, selectedArea, onAreaChange, onTaskClick, onRefresh }: { tasks: Task[]; areas: AreaName[]; selectedArea: AreaName | "all"; onAreaChange: (area: AreaName | "all") => void; onTaskClick: (task: Task) => void; onRefresh?: () => void }) {
  const [, setRevision] = useState(0);
  const [filters, setFilters] = useState<PlanningFilter>(DEFAULT_PLANNING_FILTER);
  const [scale, setScale] = useState<"days" | "weeks" | "months">("weeks");
  const [showDependencies, setShowDependencies] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [composer, setComposer] = useState<TimelineComposerMode | null>(null);
  const [composerArea, setComposerArea] = useState<AreaName | undefined>();
  const [rowMenuArea, setRowMenuArea] = useState<AreaName | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null);
  const [rescheduleConflict, setRescheduleConflict] = useState<{ task: Task; start: number; target: number } | null>(null);
  const range = scale === "days" ? { windowDays: 14, tickDays: 2 } : scale === "weeks" ? { windowDays: 42, tickDays: 7 } : { windowDays: 90, tickDays: 30 };
  const timeLabels = Array.from({ length: range.windowDays / range.tickDays }, (_, index) => new Date(Date.UTC(2026, 7, 10 + index * range.tickDays)).toLocaleDateString("en-US", scale === "months" ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }));
  const todayPosition = Math.max(1, Math.min(98, (3 / range.windowDays) * 100));
  const visibleTasks = (selectedArea === "all" ? tasks : tasks.filter(task => taskInvolvesArea(task, selectedArea))).filter(task => task.status !== "done" && matchesPlanningFilter(task, filters));
  const visibleAreas = selectedArea === "all" ? areas.filter(area => visibleTasks.some(task => taskInvolvesArea(task, area))) : [selectedArea];
  const milestones = MILESTONES.filter(milestone => visibleTasks.some(task => task.project === milestone.project));
  const lanes = visibleAreas.map((area, laneIndex) => {
    const laneTasks = visibleTasks.filter(task => taskInvolvesArea(task, area));
    const height = Math.max(104, 38 + laneTasks.length * 44);
    const top = visibleAreas.slice(0, laneIndex).reduce((total, previousArea) => total + Math.max(104, 38 + visibleTasks.filter(task => taskInvolvesArea(task, previousArea)).length * 44), 0);
    return { area, tasks: laneTasks, top, height };
  });
  const totalLaneHeight = lanes.reduce((total, lane) => total + lane.height, 0);
  const positions = new Map<string, { x: number; y: number }>();
  lanes.forEach(lane => lane.tasks.forEach((task, index) => {
    const schedule = taskSchedule(task, tasks.indexOf(task), range.windowDays);
    positions.set(task.id, { x: 155 + ((schedule.left + schedule.width) / 100) * 845, y: lane.top + 42 + index * 42 });
  }));
  const dependencyLines = visibleTasks.flatMap(task => {
    if (!task.blockedBy?.taskId) return [];
    const source = positions.get(task.blockedBy.taskId);
    const target = positions.get(task.id);
    return source && target ? [{ id: `${task.blockedBy.taskId}-${task.id}`, source, target, sourceId: task.blockedBy.taskId, targetId: task.id }] : [];
  });
  const dependencyFocus = selectedTaskId || focusedTaskId;
  const visibleDependencyLines = showDependencies ? dependencyLines : dependencyFocus ? dependencyLines.filter(line => line.sourceId === dependencyFocus || line.targetId === dependencyFocus) : [];
  const project = tasks[0]?.project;
  const projectOrg = tasks[0]?.org;
  const refresh = () => { commitTaskStore(); setRevision(current => current + 1); onRefresh?.(); };
  const applyReschedule = (task: Task, start: number, target: number) => {
    Object.assign(task, { startDate: planningIsoDate(start), targetDate: planningIsoDate(target), deadline: new Date(target).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), lastUpdate: "Rescheduled on timeline just now" });
    setRescheduleConflict(null); refresh();
  };
  const reschedule = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const task = TASKS.find(item => item.id === event.dataTransfer.getData("text/plain"));
    if (!task) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.94, (event.clientX - bounds.left) / bounds.width));
    const existing = taskSchedule(task, tasks.indexOf(task), range.windowDays);
    const duration = Math.max(2, Math.round((existing.targetMs - existing.startMs) / 86400000));
    const start = Date.UTC(2026, 7, 10) + Math.round(ratio * range.windowDays) * 86400000;
    const target = start + duration * 86400000;
    const blocker = task.blockedBy?.taskId ? TASKS.find(item => item.id === task.blockedBy?.taskId) : undefined;
    const blockerTarget = blocker ? taskSchedule(blocker, TASKS.indexOf(blocker), range.windowDays).targetMs : undefined;
    if (blockerTarget && start < blockerTarget) { setRescheduleConflict({ task, start, target }); return; }
    applyReschedule(task, start, target);
  };
  const openComposer = (mode: TimelineComposerMode, area?: AreaName) => { setComposerArea(area); setComposer(mode); setAddMenuOpen(false); setRowMenuArea(null); };
  const openTask = (task: Task) => { setSelectedTaskId(task.id); setHoveredTask(task); onTaskClick(task); };
  return <div><div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="binnie-heading text-lg font-bold text-foreground">Parallel Timeline</h2><p className="mt-1 text-[11px] text-muted-foreground">Different departments can move together. Dependencies stay quiet until you need them.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-border bg-card p-1">{(["days", "weeks", "months"] as const).map(value => <button key={value} onClick={() => setScale(value)} className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-medium capitalize", scale === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{value}</button>)}</div><PlanningFilterMenu tasks={tasks} value={filters} onChange={setFilters} /><PlanningAreaFilter areas={areas} value={selectedArea} onChange={onAreaChange} /><button onClick={() => setShowDependencies(current => !current)} aria-pressed={showDependencies} className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium", showDependencies ? "border-info/25 bg-info/[0.08] text-info" : "border-border bg-card text-muted-foreground hover:text-foreground")}><GitBranch className="h-3.5 w-3.5" />Dependencies</button><div className="relative"><button onClick={() => setAddMenuOpen(current => !current)} aria-expanded={addMenuOpen} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/85"><Plus className="h-3.5 w-3.5" />Add Work</button>{addMenuOpen && <div className="absolute right-0 z-30 mt-2 w-48 rounded-2xl border border-border bg-popover p-1.5 shadow-[0_12px_28px_var(--theme-shadow)]"><button onClick={() => openComposer("binnie")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-medium text-foreground hover:bg-primary/[0.06]"><Sparkles className="h-3.5 w-3.5 text-primary" />Add with Binnie</button><button onClick={() => openComposer("manual")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="h-3.5 w-3.5" />Add Manually</button><button onClick={() => openComposer("milestone")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"><Target className="h-3.5 w-3.5" />Add Milestone</button></div>}</div></div></div>{composer && project && projectOrg && <TimelineWorkComposer key={`${composer}-${composerArea || "project"}`} mode={composer} project={project} org={projectOrg} areas={areas} defaultArea={composerArea} onCreated={refresh} onClose={() => setComposer(null)} />}{rowMenuArea && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3"><AreaBadge area={rowMenuArea} /><span className="text-[11px] text-muted-foreground">Add work to this department</span><button onClick={() => openComposer("binnie", rowMenuArea)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary"><Sparkles className="h-3.5 w-3.5" />Ask Binnie</button><button onClick={() => openComposer("manual", rowMenuArea)} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">Add Manually</button><button onClick={() => setRowMenuArea(null)} aria-label="Close department creation" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button></div>}{hoveredTask && <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-info/15 bg-info/[0.035] px-3 py-2 text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">{hoveredTask.title}</span><AreaBadge area={hoveredTask.area} /><span>{taskSchedule(hoveredTask, tasks.indexOf(hoveredTask), range.windowDays).start} – {taskSchedule(hoveredTask, tasks.indexOf(hoveredTask), range.windowDays).target}</span><span>Owner: {hoveredTask.assignee || hoveredTask.area}</span>{hoveredTask.blockedBy && <button onClick={() => setSelectedTaskId(hoveredTask.blockedBy?.taskId || null)} className="inline-flex items-center gap-1 text-overdue hover:underline"><GitBranch className="h-3 w-3" />Blocked by {hoveredTask.blockedBy.label}</button>}</div>}{rescheduleConflict && <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-3 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-[12px] font-semibold text-foreground">This work now starts before its prerequisite is complete.</p><p className="mt-0.5 text-[10px] text-muted-foreground">Binnie will not move any other work automatically.</p></div><div className="flex gap-2"><button onClick={() => { const blocker = rescheduleConflict.task.blockedBy?.taskId ? TASKS.find(item => item.id === rescheduleConflict.task.blockedBy?.taskId) : undefined; const blockerEnd = blocker ? taskSchedule(blocker, TASKS.indexOf(blocker), range.windowDays).targetMs : rescheduleConflict.start; const duration = rescheduleConflict.target - rescheduleConflict.start; applyReschedule(rescheduleConflict.task, blockerEnd, blockerEnd + duration); }} className="rounded-lg border border-warning/25 bg-card px-2.5 py-2 text-[10px] font-medium text-warning">Adjust date</button><button onClick={() => applyReschedule(rescheduleConflict.task, rescheduleConflict.start, rescheduleConflict.target)} className="rounded-lg bg-primary px-2.5 py-2 text-[10px] font-medium text-primary-foreground">Keep anyway</button></div></div>}{visibleTasks.length === 0 ? <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-14 text-center"><Sparkles className="mx-auto h-6 w-6 text-primary" /><h3 className="mt-3 text-sm font-semibold text-foreground">Nothing planned yet.</h3><p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-muted-foreground">Tell Binnie what needs to happen and we&apos;ll help organize it across your teams.</p><div className="mt-4 flex justify-center gap-2"><button onClick={() => openComposer("binnie")} className="rounded-xl bg-primary px-3.5 py-2 text-[11px] font-medium text-primary-foreground">Add with Binnie</button><button onClick={() => openComposer("manual")} className="rounded-xl border border-border px-3.5 py-2 text-[11px] font-medium text-muted-foreground">Add Manually</button></div></section> : <div className="overflow-x-auto rounded-2xl border border-border bg-card"><div className="min-w-[820px]"><div className="grid grid-cols-[155px_1fr] border-b border-border bg-muted/35"><div className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Department</div><div className="grid" style={{ gridTemplateColumns: `repeat(${timeLabels.length}, minmax(0, 1fr))` }}>{timeLabels.map(label => <div key={label} className="border-l border-border px-3 py-3 text-[10px] font-medium text-muted-foreground">{label}</div>)}</div></div><div className="grid grid-cols-[155px_1fr] border-b border-border"><div className="bg-muted/20 px-4 py-3 text-[10px] font-medium text-muted-foreground">Milestones</div><div className="relative h-14" style={{ backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)", backgroundSize: `${100 / timeLabels.length}% 100%` }}>{milestones.map(milestone => <span key={milestone.id} title={`${milestone.name} · ${milestone.owner}${milestone.description ? ` · ${milestone.description}` : ""}`} className={cn("absolute top-3 -translate-x-1/2 text-center", milestone.status === "at_risk" ? "text-overdue" : milestone.status === "done" ? "text-success" : "text-primary")} style={{ left: `${milestonePosition(milestone.date, range.windowDays)}%` }}><span className="mx-auto block h-3 w-3 rotate-45 border border-current bg-card" /><span className="mt-1 block max-w-20 truncate text-[9px] font-medium">{milestone.name}</span></span>)}</div></div><div className="relative"><svg aria-label="Visible blocking dependencies" className="pointer-events-none absolute inset-0 z-[3] h-full w-full" preserveAspectRatio="none" viewBox={`0 0 1000 ${Math.max(totalLaneHeight, 1)}`}><defs><marker id="binnie-subtle-dependency-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5 z" fill="var(--info)" /></marker></defs>{visibleDependencyLines.map(line => { const middle = Math.max(line.source.x + 12, Math.min(line.target.x - 12, (line.source.x + line.target.x) / 2)); return <path key={line.id} d={`M ${line.source.x} ${line.source.y} H ${middle} V ${line.target.y} H ${line.target.x}`} fill="none" stroke="var(--info)" strokeWidth="1" markerEnd="url(#binnie-subtle-dependency-arrow)" opacity="0.58" />; })}</svg>{lanes.map(lane => { const style = PLANNING_AREA_STYLES[lane.area] || { bar: "bg-muted border-border text-foreground", label: "text-foreground" }; return <div key={lane.area} className="group grid grid-cols-[155px_1fr] border-b border-border last:border-b-0"><div className="border-r border-border bg-muted/20 px-4 py-4"><div className="flex items-center gap-1"><p className={cn("text-[12px] font-semibold", style.label)}>{lane.area}</p><button onClick={() => setRowMenuArea(lane.area)} aria-label={`Add work to ${lane.area}`} className="ml-auto rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-card hover:text-primary group-hover:opacity-100 focus:opacity-100"><Plus className="h-3.5 w-3.5" /></button></div><p className="mt-1 text-[10px] text-muted-foreground">{lane.tasks.length} active</p></div><div onDragOver={event => event.preventDefault()} onDrop={reschedule} className="relative" style={{ height: lane.height, backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)", backgroundSize: `${100 / timeLabels.length}% 100%` }}><div className="absolute inset-y-0 z-[1] w-px bg-primary/55" style={{ left: `${todayPosition}%` }}><span className="absolute -top-5 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">Today</span></div>{lane.tasks.map((task, index) => { const schedule = taskSchedule(task, tasks.indexOf(task), range.windowDays); const highlighted = dependencyFocus === task.id || visibleDependencyLines.some(line => (line.sourceId === task.id || line.targetId === task.id) && dependencyFocus && (line.sourceId === dependencyFocus || line.targetId === dependencyFocus)); return <button key={task.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", task.id)} onMouseEnter={() => { setFocusedTaskId(task.id); setHoveredTask(task); }} onMouseLeave={() => setFocusedTaskId(null)} title={`${task.title}\n${schedule.start} – ${schedule.target}\n${task.area}${task.assignee ? ` · ${task.assignee}` : ""}${task.blockedBy ? `\nBlocked by: ${task.blockedBy.label}` : ""}`} onClick={() => openTask(task)} className={cn("absolute z-[4] flex h-8 cursor-grab items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] font-medium shadow-[0_2px_6px_var(--theme-shadow)] transition hover:brightness-[0.98] active:cursor-grabbing", style.bar, task.status === "blocked" && "border-l-4 border-l-overdue", highlighted && "ring-2 ring-info/35")} style={{ left: `${schedule.left}%`, top: 28 + index * 42, width: `${schedule.width}%` }}><span className="min-w-0 flex-1 truncate">{task.title}</span>{task.blockedBy && <GitBranch className="h-3 w-3 flex-shrink-0" aria-label={`Blocked by ${task.blockedBy.label}`} />}</button>; })}</div></div>; })}</div></div></div>}{visibleDependencyLines.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><GitBranch className="h-3.5 w-3.5 text-info" />{showDependencies ? "Showing real blocking dependencies only." : "Showing the selected task’s real dependency only."}</p>}</div>;
}

// Kept as a compact display fallback while the interactive roadmap is used by planning views.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlanningRoadmapLegacy({ tasks, areas, selectedArea, onAreaChange, onTaskClick }: { tasks: Task[]; areas: AreaName[]; selectedArea: AreaName | "all"; onAreaChange: (area: AreaName | "all") => void; onTaskClick: (task: Task) => void }) {
  const visibleTasks = (selectedArea === "all" ? tasks : tasks.filter(task => taskInvolvesArea(task, selectedArea))).filter(task => task.status !== "done");
  const visibleAreas = selectedArea === "all" ? areas.filter(area => visibleTasks.some(task => taskInvolvesArea(task, area))) : [selectedArea];
  return <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="binnie-heading text-lg font-bold text-foreground">Project roadmap</h2><p className="mt-1 text-[11px] text-muted-foreground">A calm month-level view of the same work, without creating duplicate roadmap items.</p></div><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 px-2.5 py-2 text-[10px] font-medium text-primary">Months</span><PlanningAreaFilter areas={areas} value={selectedArea} onChange={onAreaChange} /></div></div><div className="overflow-x-auto rounded-2xl border border-border bg-card"><div className="min-w-[760px]"><div className="grid grid-cols-[155px_repeat(3,1fr)] border-b border-border bg-muted/35 text-[10px] font-medium text-muted-foreground"><div className="px-4 py-3 uppercase tracking-[0.1em]">Workstream</div><div className="border-l border-border px-4 py-3">August</div><div className="border-l border-border px-4 py-3">September</div><div className="border-l border-border px-4 py-3">October</div></div>{visibleAreas.map(area => { const areaTasks = visibleTasks.filter(task => task.area === area).slice(0, 3); const style = PLANNING_AREA_STYLES[area] || { bar: "bg-muted border-border text-foreground", label: "text-foreground" }; return <div key={area} className="grid grid-cols-[155px_1fr] border-b border-border last:border-b-0"><div className="bg-muted/20 px-4 py-4"><p className={cn("text-[12px] font-semibold", style.label)}>{area}</p><p className="mt-1 text-[10px] text-muted-foreground">{areaTasks.length} initiatives</p></div><div className="grid grid-cols-3 gap-2 p-3">{areaTasks.map(task => <button key={task.id} onClick={() => onTaskClick(task)} className={cn("rounded-xl border p-3 text-left transition hover:border-primary/35", style.bar)}><p className="truncate text-[11px] font-semibold">{task.title}</p><p className="mt-1 text-[10px] opacity-75">{task.targetDate || task.deadline || "Planned"}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-card/70"><div className="h-full rounded-full bg-primary/70" style={{ width: task.status === "in_progress" ? "55%" : task.status === "blocked" ? "18%" : "32%" }} /></div></button>)}</div></div>; })}</div></div></div>;
}

function PlanningRoadmap({ tasks, areas, selectedArea, onAreaChange, onTaskClick }: { tasks: Task[]; areas: AreaName[]; selectedArea: AreaName | "all"; onAreaChange: (area: AreaName | "all") => void; onTaskClick: (task: Task) => void }) {
  const [scale, setScale] = useState<"weeks" | "months" | "quarters">("months");
  const visibleTasks = (selectedArea === "all" ? tasks : tasks.filter(task => taskInvolvesArea(task, selectedArea))).filter(task => task.status !== "done");
  const visibleAreas = selectedArea === "all" ? areas.filter(area => visibleTasks.some(task => taskInvolvesArea(task, area))) : [selectedArea];
  const headings = scale === "weeks" ? ["Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14"] : scale === "months" ? ["August", "September", "October"] : ["Q3 2026", "Q4 2026", "Q1 2027"];
  const milestoneNames = new Set(MILESTONES.filter(milestone => tasks.some(task => task.project === milestone.project)).map(milestone => milestone.name));
  const columnFor = (task: Task) => {
    const schedule = taskSchedule(task, tasks.indexOf(task));
    const days = Math.max(0, Math.round((schedule.startMs - Date.UTC(2026, 7, 10)) / 86400000));
    return scale === "weeks" ? Math.min(5, Math.floor(days / 7)) : scale === "months" ? Math.min(2, Math.floor(days / 30)) : Math.min(2, Math.floor(days / 90));
  };
  const milestones = MILESTONES.filter(milestone => tasks.some(task => task.project === milestone.project));
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="binnie-heading text-lg font-bold text-foreground">Project roadmap</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Major workstream commitments across {scale}. It reflects the same task and milestone data as the timeline.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-card p-1">
            {(["weeks", "months", "quarters"] as const).map(value => <button key={value} onClick={() => setScale(value)} className={cn("rounded-lg px-2.5 py-1.5 text-[10px] font-medium capitalize", scale === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{value}</button>)}
          </div>
          <PlanningAreaFilter areas={areas} value={selectedArea} onChange={onAreaChange} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="min-w-[760px]">
          <div className={cn("grid border-b border-border bg-muted/35 text-[10px] font-medium text-muted-foreground", headings.length === 6 ? "grid-cols-[155px_repeat(6,1fr)]" : "grid-cols-[155px_repeat(3,1fr)]")}>
            <div className="px-4 py-3 uppercase tracking-[0.1em]">Workstream</div>
            {headings.map(heading => <div key={heading} className="border-l border-border px-3 py-3">{heading}</div>)}
          </div>
          {visibleAreas.map(area => {
            const areaTasks = visibleTasks.filter(task => taskInvolvesArea(task, area));
            const style = PLANNING_AREA_STYLES[area] || { bar: "bg-muted border-border text-foreground", label: "text-foreground" };
            return <div key={area} className="grid grid-cols-[155px_1fr] border-b border-border last:border-b-0">
              <div className="bg-muted/20 px-4 py-4"><p className={cn("text-[12px] font-semibold", style.label)}>{area}</p><p className="mt-1 text-[10px] text-muted-foreground">{areaTasks.length} initiatives</p></div>
              <div className={cn("grid gap-2 p-3", headings.length === 6 ? "grid-cols-6" : "grid-cols-3")}>
                {headings.map((heading, index) => <div key={heading} className="min-h-18 space-y-2 border-l border-border/70 pl-2 first:border-l-0">
                  {areaTasks.filter(task => columnFor(task) === index).map(task => <button key={task.id} onClick={() => onTaskClick(task)} className={cn("w-full rounded-xl border p-2.5 text-left transition hover:border-primary/35", style.bar)}><p className="truncate text-[10px] font-semibold">{task.title}</p><p className="mt-1 text-[9px] opacity-75">{task.targetDate || task.deadline || "Planned"}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-card/70"><div className="h-full rounded-full bg-primary/70" style={{ width: task.status === "in_progress" ? "55%" : task.status === "blocked" ? "18%" : "32%" }} /></div></button>)}
                </div>)}
              </div>
            </div>;
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{milestones.map(milestone => <span key={milestone.id} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px]", milestone.status === "at_risk" ? "border-overdue/20 bg-overdue/[0.05] text-overdue" : "border-primary/15 bg-primary/[0.04] text-primary")}><Target className="h-3 w-3" />{milestone.name} · {milestone.owner}</span>)}</div>
      {milestoneNames.size === 0 && <p className="mt-3 text-[11px] text-muted-foreground">Add a milestone to make a major delivery visible here.</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ProjectDetailViewLegacy({ projectId, onBack, onTaskClick }: { projectId: string; onBack: () => void; onTaskClick: (t: Task) => void }) {
  const [tab, setTab] = useState<ProjectTab>("overview");
  const [selectedArea, setSelectedArea] = useState<AreaName | "all">("all");
  const [, setRevision] = useState(0);
  const detail = PROJECT_DETAILS[projectId];
  const basicProj = STRATEGIC_PROJECTS.find(project => project.id === projectId);
  if (!detail || !basicProj) return <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10"><BackButton label="Projects" onClick={onBack} /><div className="binnie-card p-8 text-center"><FolderKanban className="mx-auto mb-3 h-9 w-9 text-muted-foreground/35" /><h1 className="text-lg font-semibold text-foreground">Project not found</h1><p className="mt-1 text-sm text-muted-foreground">It may have been archived or moved.</p></div></div>;
  const projectTasks = TASKS.filter(task => task.project === detail.name);
  const projectAreas = Array.from(new Set(projectTasks.flatMap(task => getTaskAreas(task))));
  const activeTasks = projectTasks.filter(task => task.status !== "done");
  const readyTasks = activeTasks.filter(task => task.status === "ready" && !task.blockedBy);
  const waitingOnTeams = projectTasks.filter(task => task.status === "blocked" && task.blockedBy);
  const statusCounts: Record<TaskStatus, number> = { ready: 0, in_progress: 0, waiting: 0, blocked: 0, review: 0, done: 0 };
  projectTasks.forEach(task => { statusCounts[task.status] += 1; });
  const tabs: { id: ProjectTab; label: string }[] = [{ id: "overview", label: "Overview" }, { id: "board", label: "Board" }, { id: "timeline", label: "Timeline" }, { id: "roadmap", label: "Roadmap" }, { id: "people", label: "People" }, { id: "resources", label: "Resources" }, { id: "activity", label: "Activity" }];
  const refresh = () => setRevision(current => current + 1);
  return <div className="mx-auto max-w-[1180px] p-5 sm:p-8 lg:p-10"><BackButton label="Projects" onClick={onBack} /><div className="binnie-card mb-5 overflow-hidden"><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><OrgBadge org={detail.org} /><AreaBadge area={detail.area} /><span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-medium text-success">On track</span></div><h1 className="binnie-heading text-2xl font-bold text-foreground">{detail.name}</h1><p className="mt-1 text-[12px] text-muted-foreground">Target {detail.deadline} · {projectAreas.length} teams contributing in parallel</p></div><div className="min-w-32 text-left sm:text-right"><p className="text-3xl font-bold text-primary">{detail.progress}%</p><p className="text-[10px] text-muted-foreground">project progress</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${detail.progress}%` }} /></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{PLANNING_COLUMNS.map(column => <div key={column.id} className="rounded-xl bg-muted/45 p-2.5 text-center"><p className={cn("text-lg font-bold", column.text)}>{statusCounts[column.id]}</p><p className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{column.label}</p></div>)}</div></div><div className="flex gap-1 overflow-x-auto border-t border-border bg-muted/25 p-1.5">{tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-medium transition", tab === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground")}>{item.label}</button>)}</div></div>{tab === "overview" && <><MilestonePlanner tasks={projectTasks} onRefresh={refresh} /><div className="grid gap-5 lg:grid-cols-3"><div className="space-y-5 lg:col-span-2"><section className="binnie-card p-5"><div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-semibold text-foreground">What can move now</h2><p className="text-[11px] text-muted-foreground">Work is not a relay race. These tasks are ready to start.</p></div><span className="ml-auto rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">{readyTasks.length} ready</span></div><div className="space-y-2">{readyTasks.slice(0, 5).map(task => <TaskCard key={task.id} task={task} compact onClick={() => onTaskClick(task)} />)}{!readyTasks.length && <p className="py-5 text-center text-[12px] text-muted-foreground">No tasks are waiting to start right now.</p>}</div></section><section className="binnie-card p-5"><div className="mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold text-foreground">Current focus</h2></div><div className="space-y-2">{detail.currentFocus.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/[0.035] p-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{index + 1}</span><p className="text-[12px] text-foreground">{item}</p></div>)}</div></section></div><div className="space-y-5"><section className="binnie-card p-5"><div className="mb-3 flex items-center gap-2"><GitBranch className="h-4 w-4 text-overdue" /><div><h2 className="text-sm font-semibold text-foreground">Other teams waiting on this project</h2><p className="text-[10px] text-muted-foreground">Only real blockers appear here.</p></div></div><div className="space-y-2">{waitingOnTeams.map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="w-full rounded-xl border border-overdue/15 bg-overdue/[0.035] p-3 text-left"><p className="text-[12px] font-medium text-foreground">{task.area} is waiting on {task.blockedBy?.owner || "a dependency"}</p><p className="mt-1 text-[10px] text-muted-foreground">{task.title} · {task.blockedBy?.label}</p></button>)}{!waitingOnTeams.length && <p className="py-4 text-center text-[11px] text-muted-foreground">No cross-team blockers right now.</p>}</div></section><section className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Teams involved</h2><div className="mt-3 flex flex-wrap gap-2">{projectAreas.map(area => <span key={area} className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">{area}</span>)}</div></section></div></div></>}{tab === "board" && <PlanningBoard tasks={projectTasks} areas={projectAreas} selectedArea={selectedArea} onAreaChange={setSelectedArea} onTaskClick={onTaskClick} onRefresh={refresh} />}{tab === "timeline" && <PlanningTimeline tasks={projectTasks} areas={projectAreas} selectedArea={selectedArea} onAreaChange={setSelectedArea} onTaskClick={onTaskClick} onRefresh={refresh} />}{tab === "roadmap" && <PlanningRoadmap tasks={projectTasks} areas={projectAreas} selectedArea={selectedArea} onAreaChange={setSelectedArea} onTaskClick={onTaskClick} />}{tab === "people" && <div className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Project people</h2><p className="mt-1 text-[11px] text-muted-foreground">Ownership and next actions remain visible across teams.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{Array.from(new Set(projectTasks.map(task => task.assignee).filter((name): name is string => Boolean(name)))).map(person => { const tasks = projectTasks.filter(task => task.assignee === person); return <div key={person} className="flex items-center gap-3 rounded-xl border border-border p-3"><Avatar name={person} size="md" /><div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-foreground">{person}</p><p className="text-[10px] text-muted-foreground">{tasks.length} tasks · {tasks.filter(task => task.nextActionBy === person || task.nextActionBy === tasks[0]?.area).length} next actions</p></div></div>; })}</div></div>}{tab === "resources" && <div className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Resources</h2><div className="mt-4 space-y-2">{detail.resources.map(resource => <div key={resource.label} className="flex items-center gap-3 rounded-xl border border-border p-3"><LinkIcon type={resource.type} /><span className="flex-1 text-[12px] font-medium text-foreground">{resource.label}</span><span className="text-[10px] text-muted-foreground">{resource.url === "#" ? "Not connected" : "Available"}</span></div>)}</div></div>}{tab === "activity" && <div className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Activity</h2><div className="mt-4 space-y-3">{detail.recentActivity.map(activity => <div key={`${activity.actor}-${activity.time}`} className="flex gap-3"><Avatar name={activity.actor} size="xs" /><div><p className="text-[12px] text-foreground">{activity.text}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{activity.actor} · {activity.time}</p></div></div>)}</div></div>}</div>;
}

function LinksAndFiles({ links, files, onLinksChange, onFilesChange }: { links: TaskLink[]; files: TaskFile[]; onLinksChange: (links: TaskLink[]) => void; onFilesChange: (files: TaskFile[]) => void }) {
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ label: "", url: "", description: "" });
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const addLink = () => {
    const url = linkDraft.url.trim();
    if (!linkDraft.label.trim() || !url) return;
    onLinksChange([...links, { label: linkDraft.label.trim(), url, type: linkTypeFromUrl(url), description: linkDraft.description.trim() || undefined }]);
    setLinkDraft({ label: "", url: "", description: "" }); setLinkFormOpen(false);
  };
  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    onFilesChange([...files, ...Array.from(fileList).map(file => ({ id: `project-file-${Date.now()}-${file.name}`, name: file.name, type: fileTypeFromName(file.name), size: file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "Uploaded", url: URL.createObjectURL(file) }))]);
  };
  const openFile = (file: TaskFile) => { if (file.url) window.open(file.url, "_blank", "noopener,noreferrer"); };
  const downloadFile = (file: TaskFile) => { if (!file.url) return; const anchor = document.createElement("a"); anchor.href = file.url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); };
  const fileTypeLabel: Record<TaskFile["type"], string> = { pdf: "PDF", excel: "Excel", screenshot: "Image", doc: "Document" };
  return <div className="grid gap-5 lg:grid-cols-2"><section className="binnie-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">Links</h2><p className="mt-1 text-[11px] text-muted-foreground">Useful project references, without an account connection.</p></div><button onClick={() => setLinkFormOpen(current => !current)} className="rounded-xl bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary">+ Add Link</button></div>{linkFormOpen && <div className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/30 p-3"><label className="text-[10px] font-medium text-muted-foreground">Name<input autoFocus value={linkDraft.label} onChange={event => setLinkDraft(current => ({ ...current, label: event.target.value }))} placeholder="Website Revamp Figma" className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">URL<input value={linkDraft.url} onChange={event => setLinkDraft(current => ({ ...current, url: event.target.value }))} placeholder="https://…" className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground" /></label><label className="text-[10px] font-medium text-muted-foreground">Description<input value={linkDraft.description} onChange={event => setLinkDraft(current => ({ ...current, description: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-foreground" /></label><div className="flex justify-end gap-2"><button onClick={() => setLinkFormOpen(false)} className="rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground">Cancel</button><button onClick={addLink} disabled={!linkDraft.label.trim() || !linkDraft.url.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-45">Save Link</button></div></div>}<div className="mt-4 space-y-2">{links.map((link, index) => <div key={`${link.label}-${index}`} className="flex items-center gap-3 rounded-xl border border-border p-3"><LinkIcon type={link.type} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-foreground">{link.label}</p><p className="truncate text-[10px] text-muted-foreground">{link.url.replace(/^https?:\/\//, "")}</p></div><a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10">Open <ExternalLink className="h-3 w-3" /></a></div>)}{!links.length && <p className="py-8 text-center text-[11px] text-muted-foreground">Keep the references this project needs close by.</p>}</div></section><section className="binnie-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">Files</h2><p className="mt-1 text-[11px] text-muted-foreground">Project documents and working files.</p></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary"><Paperclip className="h-3.5 w-3.5" />Upload File<input type="file" multiple className="sr-only" onChange={event => addFiles(event.target.files)} /></label></div><div className="mt-4 space-y-2">{files.map((file, index) => { const id = file.id || `${file.name}-${index}`; const isEditing = editingFileId === id; return <div key={id} className="relative flex items-center gap-3 rounded-xl border border-border p-3"><FileText className={cn("h-4 w-4", file.type === "pdf" ? "text-overdue" : file.type === "excel" ? "text-success" : file.type === "screenshot" ? "text-info" : "text-primary")} /><div className="min-w-0 flex-1">{isEditing ? <input autoFocus value={fileName} onChange={event => setFileName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && fileName.trim()) { onFilesChange(files.map((item, itemIndex) => itemIndex === index ? { ...item, name: fileName.trim() } : item)); setEditingFileId(null); } }} className="w-full rounded-lg border border-border px-2 py-1 text-[11px] text-foreground" /> : <p className="truncate text-[12px] font-medium text-foreground">{file.name}</p>}<p className="text-[10px] text-muted-foreground">{fileTypeLabel[file.type]}{file.size ? ` · ${file.size}` : " · Attached"}</p></div><button onClick={() => openFile(file)} disabled={!file.url} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-40">Open</button><button onClick={() => setFileMenuId(current => current === id ? null : id)} aria-label={`More actions for ${file.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>{fileMenuId === id && <div className="absolute right-2 top-10 z-20 w-32 rounded-xl border border-border bg-popover p-1.5 shadow-[0_10px_24px_var(--theme-shadow)]"><button onClick={() => { downloadFile(file); setFileMenuId(null); }} disabled={!file.url} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-foreground hover:bg-muted disabled:opacity-40"><Download className="h-3 w-3" />Download</button><button onClick={() => { setEditingFileId(id); setFileName(file.name); setFileMenuId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-foreground hover:bg-muted"><Pencil className="h-3 w-3" />Rename</button><button onClick={() => { onFilesChange(files.filter((_, itemIndex) => itemIndex !== index)); setFileMenuId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] text-overdue hover:bg-overdue/10"><Trash2 className="h-3 w-3" />Remove</button></div>}</div>; })}{!files.length && <p className="py-8 text-center text-[11px] text-muted-foreground">Upload a file when the project needs a shared reference.</p>}</div></section></div>;
}

function ProjectDetailView({ projectId, onBack, onTaskClick }: { projectId: string; onBack: () => void; onTaskClick: (t: Task) => void }) {
  const detail = PROJECT_DETAILS[projectId];
  const basicProj = STRATEGIC_PROJECTS.find(project => project.id === projectId);
  const [tab, setTab] = useState<ProjectTab>("overview");
  const [selectedArea, setSelectedArea] = useState<AreaName | "all">("all");
  const [, setRevision] = useState(0);
  const [projectLinks, setProjectLinks] = useState<TaskLink[]>(() => PROJECT_DETAILS[projectId]?.resources || []);
  const [projectFiles, setProjectFiles] = useState<TaskFile[]>(() => PROJECT_DETAILS[projectId]?.files || []);
  if (!detail || !basicProj) return <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10"><BackButton label="Projects" onClick={onBack} /><div className="binnie-card p-8 text-center"><FolderKanban className="mx-auto mb-3 h-9 w-9 text-muted-foreground/35" /><h1 className="text-lg font-semibold text-foreground">Project not found</h1><p className="mt-1 text-sm text-muted-foreground">It may have been archived or moved.</p></div></div>;
  const projectTasks = getTasksForProject(detail.name);
  const projectAreas = Array.from(new Set(projectTasks.flatMap(task => getTaskAreas(task))));
  const activeTasks = projectTasks.filter(task => task.status !== "done");
  const readyTasks = activeTasks.filter(task => task.status === "ready" && !task.blockedBy);
  const waitingOnTeams = projectTasks.filter(task => task.status === "blocked" && task.blockedBy);
  const statusCounts: Record<TaskStatus, number> = { ready: 0, in_progress: 0, waiting: 0, blocked: 0, review: 0, done: 0 };
  projectTasks.forEach(task => { statusCounts[task.status] += 1; });
  const tabs: { id: ProjectTab; label: string }[] = [{ id: "overview", label: "Overview" }, { id: "board", label: "Board" }, { id: "timeline", label: "Timeline" }, { id: "roadmap", label: "Roadmap" }, { id: "people", label: "People" }, { id: "links-files", label: "Links & Files" }, { id: "activity", label: "Activity" }];
  const refresh = () => { commitTaskStore(); setRevision(current => current + 1); };
  return <div className="mx-auto max-w-[1180px] p-5 sm:p-8 lg:p-10"><BackButton label="Projects" onClick={onBack} /><div className="binnie-card mb-5 overflow-hidden"><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><OrgBadge org={detail.org} /><AreaBadge area={detail.area} /><span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-medium text-success">On track</span></div><h1 className="binnie-heading text-2xl font-bold text-foreground">{detail.name}</h1><p className="mt-1 text-[12px] text-muted-foreground">Target {detail.deadline} · {projectAreas.length} teams contributing in parallel</p></div><div className="min-w-32 text-left sm:text-right"><p className="text-3xl font-bold text-primary">{detail.progress}%</p><p className="text-[10px] text-muted-foreground">project progress</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${detail.progress}%` }} /></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{PLANNING_COLUMNS.map(column => <div key={column.id} className="rounded-xl bg-muted/45 p-2.5 text-center"><p className={cn("text-lg font-bold", column.text)}>{statusCounts[column.id]}</p><p className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{column.label}</p></div>)}</div></div><div className="flex gap-1 overflow-x-auto border-t border-border bg-muted/25 p-1.5">{tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-medium transition", tab === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground")}>{item.label}</button>)}</div></div>{tab === "overview" && <><MilestonePlanner tasks={projectTasks} onRefresh={refresh} /><div className="grid gap-5 lg:grid-cols-3"><div className="space-y-5 lg:col-span-2"><section className="binnie-card p-5"><div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><div><h2 className="text-sm font-semibold text-foreground">What can move now</h2><p className="text-[11px] text-muted-foreground">Work is not a relay race. These tasks are ready to start.</p></div><span className="ml-auto rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">{readyTasks.length} ready</span></div><div className="space-y-2">{readyTasks.slice(0, 5).map(task => <TaskCard key={task.id} task={task} compact onClick={() => onTaskClick(task)} />)}{!readyTasks.length && <p className="py-5 text-center text-[12px] text-muted-foreground">No tasks are ready to start right now.</p>}</div></section><section className="binnie-card p-5"><div className="mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold text-foreground">Current focus</h2></div><div className="space-y-2">{detail.currentFocus.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/[0.035] p-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{index + 1}</span><p className="text-[12px] text-foreground">{item}</p></div>)}</div></section></div><div className="space-y-5"><section className="binnie-card p-5"><div className="mb-3 flex items-center gap-2"><GitBranch className="h-4 w-4 text-overdue" /><div><h2 className="text-sm font-semibold text-foreground">Other teams waiting on this project</h2><p className="text-[10px] text-muted-foreground">Only real blockers appear here.</p></div></div><div className="space-y-2">{waitingOnTeams.map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="w-full rounded-xl border border-overdue/15 bg-overdue/[0.035] p-3 text-left"><p className="text-[12px] font-medium text-foreground">{task.area} is waiting on {task.blockedBy?.owner || "a dependency"}</p><p className="mt-1 text-[10px] text-muted-foreground">{task.title} · {task.blockedBy?.label}</p></button>)}{!waitingOnTeams.length && <p className="py-4 text-center text-[11px] text-muted-foreground">No cross-team blockers right now.</p>}</div></section><section className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Teams involved</h2><div className="mt-3 flex flex-wrap gap-2">{projectAreas.map(area => <span key={area} className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">{area}</span>)}</div></section></div></div></>}{tab === "board" && <PlanningBoard tasks={projectTasks} areas={projectAreas} selectedArea={selectedArea} onAreaChange={setSelectedArea} onTaskClick={onTaskClick} onRefresh={refresh} />}{tab === "timeline" && <PlanningTimeline tasks={projectTasks} areas={projectAreas} selectedArea={selectedArea} onAreaChange={setSelectedArea} onTaskClick={onTaskClick} onRefresh={refresh} />}{tab === "roadmap" && <PlanningRoadmap tasks={projectTasks} areas={projectAreas} selectedArea={selectedArea} onAreaChange={setSelectedArea} onTaskClick={onTaskClick} />}{tab === "people" && <div className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Project people</h2><p className="mt-1 text-[11px] text-muted-foreground">Ownership and next actions remain visible across teams.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{Array.from(new Set(projectTasks.map(task => task.assignee).filter((name): name is string => Boolean(name)))).map(person => { const personTasks = projectTasks.filter(task => task.assignee === person); return <div key={person} className="flex items-center gap-3 rounded-xl border border-border p-3"><Avatar name={person} size="md" /><div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-foreground">{person}</p><p className="text-[10px] text-muted-foreground">{personTasks.length} tasks · {personTasks.filter(task => task.nextActionBy === person || task.nextActionBy === personTasks[0]?.area).length} next actions</p></div></div>; })}</div></div>}{tab === "links-files" && <LinksAndFiles links={projectLinks} files={projectFiles} onLinksChange={setProjectLinks} onFilesChange={setProjectFiles} />}{tab === "activity" && <div className="binnie-card p-5"><h2 className="text-sm font-semibold text-foreground">Activity</h2><div className="mt-4 space-y-3">{detail.recentActivity.map(activity => <div key={`${activity.actor}-${activity.time}`} className="flex gap-3"><Avatar name={activity.actor} size="xs" /><div><p className="text-[12px] text-foreground">{activity.text}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{activity.actor} · {activity.time}</p></div></div>)}</div></div>}</div>;
}

// ─── FOLLOW-UP CENTER VIEW (NEW) ──────────────────────────────────────────────

type FollowUpTab = "today" | "overdue" | "no-update" | "later";
const FOLLOWUP_STATUS_CONFIG: Record<FollowUpItem["status"], { label: string; color: string; bg: string }> = {
  overdue: { label: "Overdue", color: "text-red-400", bg: "bg-red-400/10" },
  due_today: { label: "Due Today", color: "text-amber-400", bg: "bg-amber-400/10" },
  due_soon: { label: "Due Soon", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  no_update: { label: "No Update", color: "text-slate-400", bg: "bg-slate-400/10" },
};

function FollowUpView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const [tab, setTab] = useState<FollowUpTab>("today");
  const [generated, setGenerated] = useState<Set<string>>(new Set());
  const [followedUp, setFollowedUp] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const isVisible = (person: string) => !followedUp.has(person) && !snoozed.has(person);
  const todayData = FOLLOWUP_DATA.filter(d => d.section === "today" && isVisible(d.person));
  const laterData = FOLLOWUP_DATA.filter(d => d.section === "later" && isVisible(d.person));
  const overdueData = FOLLOWUP_DATA.filter(d => d.items.some(i => i.status === "overdue") && isVisible(d.person));
  const noUpdateData = FOLLOWUP_DATA.filter(d => d.items.some(i => i.status === "no_update") && isVisible(d.person));

  const tabs: { id: FollowUpTab; label: string; count: number; urgentColor?: string }[] = [
    { id: "today", label: "Follow Up Today", count: todayData.length, urgentColor: "text-amber-400" },
    { id: "overdue", label: "Overdue Responses", count: overdueData.length, urgentColor: "text-red-400" },
    { id: "no-update", label: "No Recent Update", count: noUpdateData.length },
    { id: "later", label: "Follow Up Later", count: laterData.length },
  ];

  const currentData: Record<FollowUpTab, FollowUpPerson[]> = {
    today: todayData, overdue: overdueData, "no-update": noUpdateData, later: laterData,
  };

  function handleCopy(person: string, message: string) {
    navigator.clipboard.writeText(message).catch(() => {});
    setCopied(person);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleMarkDone(person: string) {
    setFollowedUp(prev => new Set([...prev, person]));
    setGenerated(prev => { const n = new Set(prev); n.delete(person); return n; });
  }

  function handleSnooze(person: string) {
    setSnoozed(prev => new Set([...prev, person]));
    setGenerated(prev => { const next = new Set(prev); next.delete(person); return next; });
  }

  const totalNeedFollowUp = todayData.length;
  const totalItems = FOLLOWUP_DATA.filter(d => isVisible(d.person)).reduce((a, d) => a + d.items.length, 0);
  const overdueResponses = FOLLOWUP_DATA.filter(d => isVisible(d.person)).flatMap(d => d.items.filter(i => i.status === "overdue")).length;

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Action Center</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Follow-Up</h1>
        <p className="text-sm text-muted-foreground mt-1">Who should you contact today, and what for?</p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: totalNeedFollowUp, label: "people need follow-up", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
          { value: totalItems, label: "items waiting", color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
          { value: overdueResponses, label: "overdue responses", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
          { value: followedUp.size, label: "followed up today", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
        ].map(({ value, label, color, bg, border }) => (
          <div key={label} className={cn("px-4 py-3 rounded-xl border text-center", bg, border)}>
            <p className={cn("text-2xl font-bold", color)} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
            <p className={cn("text-[10px] font-mono mt-0.5", color, "opacity-80")}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-shrink-0 rounded-lg px-2 py-2 text-[11px] font-medium transition-all", tab === t.id ? "border border-border bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className={cn("ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full", tab === t.id ? (t.urgentColor ? cn("bg-amber-400/15", t.urgentColor) : "bg-primary/20 text-primary") : "bg-muted text-muted-foreground")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Person follow-up cards */}
      <div className="space-y-4">
        {currentData[tab].map(fp => {
          const color = getPersonColor(fp.person);
          const isGenerated = generated.has(fp.person);
          const fp_data = FOLLOWUP_DATA.find(d => d.person === fp.person)!;

          return (
            <div key={fp.person} className="binnie-card overflow-hidden">
              {/* Person header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={personColorStyle(color)}>
                  {getInitials(fp.person)}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{fp.person}</h3>
                  <p className="text-[11px] text-muted-foreground">{fp.items.length} items need follow-up</p>
                </div>
                {!isGenerated ? (
                  <button onClick={() => setGenerated(prev => new Set([...prev, fp.person]))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />Draft with Binnie
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-success">
                    <Check className="w-3.5 h-3.5" />Message ready
                  </div>
                )}
              </div>

              {/* Follow-up items */}
              <div className="p-4 space-y-2">
                {fp.items.map((item, i) => {
                  const sc = FOLLOWUP_STATUS_CONFIG[item.status];
                  const linkedTask = TASKS.find(t => t.id === item.taskId);
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", sc.bg, sc.color)}>{sc.label}</span>
                          {item.daysWaiting > 0 && (
                            <span className="text-[10px] font-mono text-muted-foreground">{item.daysWaiting}d waiting</span>
                          )}
                        </div>
                        <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.note}</p>
                      </div>
                      {linkedTask && (
                        <button onClick={() => onTaskClick(linkedTask)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Generated message */}
              {isGenerated && (
                <div className="mx-4 mb-4 rounded-xl border border-primary/20 bg-primary/[0.04] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/15">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-medium text-primary">Binnie suggested message</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">Preview</span>
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">{fp_data.suggestedMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-primary/15">
                    <button onClick={() => handleCopy(fp.person, fp_data.suggestedMessage)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      {copied === fp.person ? <><Check className="w-3 h-3 text-success" />Copied!</> : <><Copy className="w-3 h-3" />Copy Message</>}
                    </button>
                    <button onClick={() => handleMarkDone(fp.person)}
                      className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-[11px] font-medium text-success transition-colors hover:bg-success/15">
                      <Check className="w-3 h-3" />Mark Followed Up
                    </button>
                    <button onClick={() => handleSnooze(fp.person)}
                      className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <ChevronDown className="w-3.5 h-3.5" />Snooze
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {currentData[tab].length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-sm">Nothing to follow up on here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ORGANIZATIONS VIEW ───────────────────────────────────────────────────────

function OrganizationsView({ onOrgClick }: { onOrgClick: (org: OrgName) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [, setRevision] = useState(0);

  function addOrganization() {
    const organizationName = name.trim();
    if (!organizationName) { setFormMessage("Add a workspace name to continue."); return; }
    if (ORGS_META.some(org => org.name.toLowerCase() === organizationName.toLowerCase())) { setFormMessage("That workspace already exists."); return; }
    ORGS_META.push({ name: organizationName, desc: description.trim() || "A new Binnie workspace", areas: [] });
    ORG_COLORS[organizationName] = { ...ORG_COLORS["Villa Khayangan"] };
    ORG_RESOURCES[organizationName] = [];
    setRevision(current => current + 1);
    setName("");
    setDescription("");
    setFormMessage("");
    setIsAdding(false);
  }

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="binnie-heading text-3xl font-bold text-foreground">Organizations</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Your workspaces, all in one place.</p>
        </div>
        <button onClick={() => { setIsAdding(current => !current); setFormMessage(""); }} className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"><Plus className="h-3.5 w-3.5" /> Add Organization</button>
      </div>
      {isAdding && <div className="binnie-card mb-5 grid gap-3 bg-[#fdfcff] p-4 sm:grid-cols-[1fr_1.4fr_auto]"><input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === "Enter" && addOrganization()} placeholder="Workspace name" className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /><input value={description} onChange={event => setDescription(event.target.value)} onKeyDown={event => event.key === "Enter" && addOrganization()} placeholder="Short description (optional)" className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /><div className="flex gap-2"><button onClick={addOrganization} className="rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground">Create</button><button onClick={() => setIsAdding(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button></div>{formMessage && <p className="sm:col-span-3 text-[11px] text-overdue">{formMessage}</p>}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ORGS_META.map(org => {
          const c = ORG_COLORS[org.name];
          const orgTasks = TASKS.filter(t => t.org === org.name);
          const activeTasks = orgTasks.filter(task => task.status !== "done");
          const orgProjects = STRATEGIC_PROJECTS.filter(project => project.org === org.name);
          const waiting = activeTasks.filter(task => task.isWaiting).length;
          const attention = activeTasks.filter(task => task.isOverdue || task.status === "blocked" || task.status === "review").length;
          const visibleAreas = org.areas.slice(0, 3);
          const currentFocus = orgProjects.slice(0, 2).map(project => project.name).join(" · ") || activeTasks[0]?.title || "A quieter personal workspace.";
          return (
            <button key={org.name} onClick={() => onOrgClick(org.name)}
              className={cn("binnie-card binnie-card-hover group relative flex h-full min-h-[19.5rem] overflow-hidden p-5 text-left", c.card)}>
              <div aria-hidden="true" className={cn("absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl", c.bg)} />
              <div className="relative flex h-full w-full flex-col">
                <div className="mb-4 grid min-h-[4.5rem] grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-start gap-x-3">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", c.bg, c.text)}><Building2 className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex h-5 items-center gap-2">
                      <h2 className="binnie-heading min-w-0 flex-1 truncate text-[16px] font-bold leading-5 text-foreground">{org.name}</h2>
                      {attention > 0 && <span className="flex-shrink-0 rounded-full bg-overdue/10 px-2 py-0.5 text-[10px] font-medium text-overdue">{attention} to revisit</span>}
                    </div>
                    <p className="mt-1 min-h-9 line-clamp-2 text-[12px] leading-[1.125rem] text-muted-foreground">{org.desc}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <div className="mb-4 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                  <span><strong className={cn("font-semibold", c.text)}>{activeTasks.length}</strong> Active</span><span className="text-border">·</span><span><strong className="font-semibold text-foreground">{orgProjects.length}</strong> Projects</span><span className="text-border">·</span><span><strong className="font-semibold text-info">{waiting}</strong> Waiting</span>
                </div>
                <div className="mb-4 flex min-h-9 flex-wrap content-start gap-1.5">
                  {visibleAreas.map(area => <span key={area} className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium", c.bg, AREA_COLORS[area])}>{area} <span className="opacity-65">· {orgTasks.filter(task => task.area === area).length}</span></span>)}
                  {org.areas.length > visibleAreas.length && <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">+{org.areas.length - visibleAreas.length}</span>}
                </div>
                <div className="mt-auto min-h-[3.75rem] rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">Current focus</p>
                  <p className="truncate text-[12px] font-medium text-foreground">{currentFocus}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PROJECTS VIEW ────────────────────────────────────────────────────────────

function ProjectsView({ onProjectClick }: { onProjectClick: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "attention" | "completed">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAdding, setIsAdding] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectOrg, setProjectOrg] = useState<OrgName>("Villa Khayangan");
  const [formMessage, setFormMessage] = useState("");
  const [, setRevision] = useState(0);

  function addProject() {
    const name = projectName.trim();
    if (!name) { setFormMessage("Add a project name to continue."); return; }
    const id = `p-${Date.now()}`;
    STRATEGIC_PROJECTS.push({ id, name, org: projectOrg, progress: 0, tasks: 0, done: 0, deadline: "No target", status: "on_track" });
    PROJECT_DETAILS[id] = { id, name, org: projectOrg, area: "Operations", progress: 0, deadline: "No target", status: "on_track", tasks: 0, done: 0, currentFocus: [], resources: [], recentActivity: [] };
    setRevision(current => current + 1);
    setProjectName("");
    setFormMessage("");
    setIsAdding(false);
  }
  const needsAttention = (project: typeof STRATEGIC_PROJECTS[number]) => {
    const detail = PROJECT_DETAILS[project.id];
    const projectTasks = TASKS.filter(task => task.project === project.name);
    return detail?.status === "at_risk" || projectTasks.some(task => task.isOverdue || task.status === "blocked" || task.isWaiting || task.status === "review");
  };
  const attentionProjects = STRATEGIC_PROJECTS.filter(needsAttention);
  const activeProjects = STRATEGIC_PROJECTS.filter(project => project.done < project.tasks && !needsAttention(project));
  const completedProjects = STRATEGIC_PROJECTS.filter(project => project.done >= project.tasks);
  const visibleProjects = filter === "attention" ? attentionProjects : filter === "active" ? activeProjects : filter === "completed" ? completedProjects : STRATEGIC_PROJECTS;
  const projectGridClass = viewMode === "grid" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid grid-cols-1 gap-3";

  const renderProjectCard = (project: typeof STRATEGIC_PROJECTS[number]) => {
    const c = ORG_COLORS[project.org];
    const detail = PROJECT_DETAILS[project.id];
    const projectTasks = TASKS.filter(task => task.project === project.name);
    const nextTask = projectTasks.find(task => task.nextActionBy === "me" && task.status !== "done") || projectTasks.find(task => task.status !== "done");
    const waiting = projectTasks.filter(task => task.isWaiting).length;
    const review = projectTasks.filter(task => task.status === "review").length;
    const attention = needsAttention(project);
    return (
      <button key={project.id} onClick={() => onProjectClick(project.id)} className={cn("binnie-card binnie-card-hover group relative flex h-full min-h-[21.25rem] overflow-hidden p-4 text-left sm:p-5", c.card)}>
        <div aria-hidden="true" className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-45 blur-2xl", c.bg)} />
        <div className="relative flex h-full w-full flex-col">
          <div className="mb-4 grid min-h-[4.25rem] grid-cols-[2.25rem_minmax(0,1fr)_1rem] items-start gap-x-3">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", c.bg, c.text)}><FolderKanban className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="flex h-5 items-center gap-2"><h2 className="binnie-heading min-w-0 flex-1 truncate text-[15px] font-bold leading-5 text-foreground">{project.name}</h2>{attention && <span className="flex-shrink-0 rounded-full bg-warning/12 px-2 py-1 text-[10px] font-medium text-warning">Needs attention</span>}</div>
              <div className="mt-2 flex min-h-5 items-center gap-1.5 overflow-hidden"><OrgBadge org={project.org} />{detail && <AreaBadge area={detail.area} />}</div>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <div className="mb-3 flex items-end gap-3">
            <p className={cn("binnie-heading text-2xl font-bold", c.text)}>{project.progress}%</p>
            <div className="min-w-0 flex-1 pb-1"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div></div>
          </div>
          <div className="mb-3 flex min-h-4 items-center justify-between text-[11px] text-muted-foreground"><span>{project.done} / {project.tasks} tasks</span><span>Target: {project.deadline}</span></div>
          <div className="space-y-2.5 border-t border-border/80 pt-3">
            <div className="min-h-10"><p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Current focus</p><p className="truncate text-[12px] font-medium text-foreground">{detail?.currentFocus[0] || "Set a focused next step"}</p></div>
            <div className="min-h-10"><p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Next</p><p className="truncate text-[12px] text-foreground">{nextTask?.title || "No next task scheduled"}</p></div>
          </div>
          <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">{waiting > 0 && <span className="rounded-full bg-info/10 px-2 py-1 text-[10px] font-medium text-info">{waiting} waiting</span>}{review > 0 && <span className="rounded-full bg-review/10 px-2 py-1 text-[10px] font-medium text-review">{review} review</span>}</div>
        </div>
      </button>
    );
  };

  const renderProjectGroup = (title: string, projects: typeof STRATEGIC_PROJECTS, accent: string) => projects.length > 0 ? (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", accent)} /><h2 className="text-[13px] font-semibold text-foreground">{title}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{projects.length}</span></div>
      <div className={projectGridClass}>{projects.map(renderProjectCard)}</div>
    </section>
  ) : null;

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="binnie-heading text-3xl font-bold text-foreground">Projects</h1><p className="mt-1.5 text-sm text-muted-foreground">Keep important work moving.</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-1"><button onClick={() => setViewMode("grid")} aria-label="Project grid" aria-pressed={viewMode === "grid"} className={cn("rounded-lg p-1.5 transition-colors", viewMode === "grid" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Layers className="h-3.5 w-3.5" /></button><button onClick={() => setViewMode("list")} aria-label="Project list" aria-pressed={viewMode === "list"} className={cn("rounded-lg p-1.5 transition-colors", viewMode === "list" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><ListTodo className="h-3.5 w-3.5" /></button></div><button onClick={() => { setIsAdding(current => !current); setFormMessage(""); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"><Plus className="h-3.5 w-3.5" /> Add Project</button></div>
      </div>
      {isAdding && <div className="binnie-card mb-5 grid gap-3 bg-[#fdfcff] p-4 sm:grid-cols-[1.4fr_1fr_auto]"><input autoFocus value={projectName} onChange={event => setProjectName(event.target.value)} onKeyDown={event => event.key === "Enter" && addProject()} placeholder="Project name" className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /><select value={projectOrg} onChange={event => setProjectOrg(event.target.value as OrgName)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground">{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select><div className="flex gap-2"><button onClick={addProject} className="rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground">Create</button><button onClick={() => setIsAdding(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button></div>{formMessage && <p className="sm:col-span-3 text-[11px] text-overdue">{formMessage}</p>}</div>}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {[
          { id: "all" as const, label: "All", count: STRATEGIC_PROJECTS.length },
          { id: "active" as const, label: "Active", count: activeProjects.length },
          { id: "attention" as const, label: "Needs Attention", count: attentionProjects.length },
          { id: "completed" as const, label: "Completed", count: completedProjects.length },
        ].map(item => <button key={item.id} onClick={() => setFilter(item.id)} className={cn("rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors", filter === item.id ? "border-primary/25 bg-secondary text-secondary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground")}>{item.label}<span className="ml-1.5 opacity-65">{item.count}</span></button>)}
      </div>
      {filter === "all" ? <>{renderProjectGroup("Needs Attention", attentionProjects, "bg-warning")}{renderProjectGroup("Active Projects", activeProjects, "bg-primary")}</> : visibleProjects.length > 0 ? <div className={projectGridClass}>{visibleProjects.map(renderProjectCard)}</div> : <div className="binnie-card py-14 text-center"><CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-success/50" /><p className="text-sm font-medium text-foreground">Nothing to show here right now.</p><p className="mt-1 text-[12px] text-muted-foreground">The rest of your work is safely organized.</p></div>}
    </div>
  );
}

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────

function SearchView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const [query, setQuery] = useState("");
  const searchableTasks = [...TASKS, ...ARCHIVED_TASKS];
  const results = query.length > 1
    ? searchableTasks.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.org.toLowerCase().includes(query.toLowerCase()) ||
        t.area.toLowerCase().includes(query.toLowerCase()) ||
        taskAssigneeNames(t).join(" ").toLowerCase().includes(query.toLowerCase())
      )
    : [];
  return (
    <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-4" style={{ fontFamily: "var(--font-display)" }}>Search</h1>
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 focus-within:border-primary/40 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, people, organizations…"
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder-muted-foreground" />
          {query && <button onClick={() => setQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
        </div>
      </div>
      {results.length > 0 && (
        <div>
          <p className="text-[11px] font-mono text-muted-foreground mb-3">{results.length} results</p>
          <div className="space-y-2">{results.map(t => <div key={t.id} className="relative">{t.archived && <span className="absolute right-3 top-3 z-10 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Archived</span>}<TaskCard task={t} onClick={() => onTaskClick(t)} /></div>)}</div>
        </div>
      )}
      {query.length > 1 && results.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No results for &ldquo;{query}&rdquo;</p>}
      {query.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Type to search across all tasks and people</p>
        </div>
      )}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Home",
    items: [{ id: "home" as NavView, label: "Home", icon: <Home className="w-4 h-4" /> }]
  },
  {
    label: "Plan",
    items: [
      { id: "today" as NavView, label: "Today", icon: <CalendarDays className="w-4 h-4" />, badge: TASKS.filter(t => t.isToday && t.nextActionBy === "me").length },
      { id: "this-week" as NavView, label: "This Week", icon: <Calendar className="w-4 h-4" /> },
      { id: "all-tasks" as NavView, label: "Tasks", icon: <ListTodo className="w-4 h-4" /> },
    ]
  },
  {
    label: "Capture",
    items: [
      { id: "inbox" as NavView, label: "Smart Inbox", icon: <Inbox className="w-4 h-4" />, highlight: true },
    ]
  },
  {
    label: "Manage",
    items: [
      { id: "delegated" as NavView, label: "Delegated", icon: <Users className="w-4 h-4" />, badge: TASKS.filter(t => t.isDelegated).length },
      { id: "waiting" as NavView, label: "Waiting", icon: <Hourglass className="w-4 h-4" />, badge: TASKS.filter(t => t.isWaiting).length },
      { id: "followup" as NavView, label: "Follow Up", icon: <MessageSquare className="w-4 h-4" />, badge: FOLLOWUP_DATA.filter(d => d.section === "today").length },
      { id: "review" as NavView, label: "Needs My Review", icon: <Eye className="w-4 h-4" />, badge: TASKS.filter(t => t.status === "review" && t.nextActionBy === "me").length },
      { id: "overdue" as NavView, label: "Overdue", icon: <AlertTriangle className="w-4 h-4" />, badge: TASKS.filter(t => t.isOverdue).length, urgent: true },
      { id: "people" as NavView, label: "People", icon: <UserCheck className="w-4 h-4" />, badge: PEOPLE_DIRECTORY.filter(person => getPersonAccountability(person.name).waitingOnThem > 0).length },
    ]
  },
  {
    label: "Organize",
    items: [
      { id: "organizations" as NavView, label: "Organizations", icon: <Building2 className="w-4 h-4" /> },
      { id: "projects" as NavView, label: "Projects", icon: <FolderKanban className="w-4 h-4" /> },
    ]
  },
];

function BinnieMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/binnie-brandmark.png" alt="Binnie" width={505} height={665} className={cn("w-auto flex-shrink-0 object-contain", compact ? "h-9" : "h-10")} />
      {!compact && <div><p className="binnie-heading text-[17px] font-bold text-foreground">Binnie</p><p className="-mt-0.5 text-[10px] text-muted-foreground">Less to remember. More room to think.</p></div>}
    </div>
  );
}

const WORKSPACE_THEME_OPTIONS: { id: WorkspaceTheme; label: string; description: string; preview: string }[] = [
  { id: "soft", label: "Soft", description: "Warm, pastel, and airy.", preview: "binnie-theme-preview-soft" },
  { id: "clear", label: "Clear", description: "Cool, crisp, and focused.", preview: "binnie-theme-preview-clear" },
  { id: "dark", label: "Dark", description: "Calm, low-light, and refined.", preview: "binnie-theme-preview-dark" },
];

function ProfilePanel({ profile, theme, onThemeChange, onSave, onClose, onSignOut }: { profile: UserProfile; theme: WorkspaceTheme; onThemeChange: (theme: WorkspaceTheme) => void; onSave: (profile: UserProfile) => void; onClose: () => void; onSignOut: () => void }) {
  const [draft, setDraft] = useState(profile);
  const [section, setSection] = useState<"profile" | "preferences" | "settings">("profile");
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const update = (patch: Partial<UserProfile>) => setDraft(current => ({ ...current, ...patch }));
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Profile settings">
      <button aria-label="Close profile settings" onClick={onClose} className="absolute inset-0 cursor-default bg-foreground/10 backdrop-blur-[1px]" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-sidebar shadow-[-20px_0_50px_rgb(35_41_61_/_0.12)]">
        <div className="flex items-start justify-between border-b border-border px-5 py-5 sm:px-6"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Your account</p><h2 className="binnie-heading mt-1 text-xl font-bold text-foreground">Profile & preferences</h2></div><button onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button></div>
        <div className="border-b border-border px-5 py-3 sm:px-6"><div className="flex gap-1 rounded-xl bg-muted/50 p-1">{[{ id: "profile" as const, label: "Profile" }, { id: "preferences" as const, label: "Preferences" }, { id: "settings" as const, label: "Settings" }].map(item => <button key={item.id} onClick={() => setSection(item.id)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors", section === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{item.label}</button>)}</div></div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-6 flex items-center gap-3"><Avatar name={draft.displayName || "Charlotte"} size="lg" /><div><p className="text-sm font-semibold text-foreground">{draft.displayName || "Charlotte"}</p><p className="text-[12px] text-muted-foreground">{draft.role}</p></div></div>
          {section === "profile" && <div className="space-y-4"><label className="block text-[11px] font-medium text-muted-foreground">Display name<input value={draft.displayName} onChange={event => update({ displayName: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground" /></label><label className="block text-[11px] font-medium text-muted-foreground">Role<input value={draft.role} onChange={event => update({ role: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground" /></label><label className="block text-[11px] font-medium text-muted-foreground">Email <span className="font-normal">(optional)</span><input value={draft.email} onChange={event => update({ email: event.target.value })} type="email" className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground" /></label></div>}
          {section === "preferences" && <div className="space-y-4"><label className="block text-[11px] font-medium text-muted-foreground">Timezone<select value={draft.timezone} onChange={event => update({ timezone: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground"><option>Asia/Jakarta</option><option>Asia/Singapore</option><option>Europe/London</option><option>America/New_York</option></select></label><label className="block text-[11px] font-medium text-muted-foreground">Preferred date format<select value={draft.dateFormat} onChange={event => update({ dateFormat: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground"><option>12 Aug 2026</option><option>Aug 12, 2026</option><option>2026-08-12</option></select></label></div>}
          {section === "settings" && <section><div className="mb-4"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Appearance</p><h3 className="binnie-heading mt-1 text-lg font-bold text-foreground">Workspace Theme</h3><p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">Choose the atmosphere that feels best to work in.</p></div><div className="space-y-2.5">{WORKSPACE_THEME_OPTIONS.map(option => { const isSelected = theme === option.id; return <button key={option.id} onClick={() => onThemeChange(option.id)} className={cn("w-full rounded-2xl border p-3 text-left transition-colors", isSelected ? "border-primary/35 bg-secondary/50 shadow-sm" : "border-border bg-card hover:border-primary/25 hover:bg-muted/35")} aria-pressed={isSelected}><div className={cn("mb-3 rounded-xl border border-white/70 p-2.5", option.preview)}><div className="rounded-lg bg-[var(--preview-background)] p-2"><div className="flex h-9 items-center gap-2 rounded-md bg-[var(--preview-surface)] px-2 shadow-sm"><span className="h-4 w-4 rounded bg-[var(--preview-primary)]" /><span className="h-2 flex-1 rounded-full bg-[var(--preview-secondary)]" /><span className="h-3 w-3 rounded-full bg-[var(--preview-accent)]" /></div></div></div><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-foreground">{option.label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{option.description}</p></div>{isSelected && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}</div></button>; })}</div></section>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-6"><button onClick={onSignOut} className="rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Sign Out</button><button onClick={() => { onSave(draft); onClose(); }} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">Save changes</button></div>
      </aside>
    </div>
  );
}

function Sidebar({ view, onNav, profile, onProfileClick, collapsed = false, onToggleCollapse, className, onNavigate }: { view: NavView; onNav: (v: NavView) => void; profile: UserProfile; onProfileClick: () => void; collapsed?: boolean; onToggleCollapse?: () => void; className?: string; onNavigate?: () => void }) {
  const currentUserId = profile.directoryId || DEFAULT_CURRENT_USER_ID;
  const liveBadges: Partial<Record<NavView, number>> = {
    today: getTasksForToday(TASKS, currentUserId).length,
    delegated: getDelegatedTasks(TASKS, currentUserId).length,
    waiting: getWaitingTasks(TASKS).length,
    followup: getWaitingTasks(TASKS).filter(task => !taskIsForCurrentUser(task, currentUserId)).length,
    review: TASKS.filter(task => task.status === "review" && taskIsForCurrentUser(task, currentUserId)).length,
    overdue: TASKS.filter(isTaskOverdue).length,
    people: PEOPLE_DIRECTORY.filter(person => getPersonAccountability(person.name).waitingOnThem > 0).length,
  };
  const navGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => ({ ...item, badge: liveBadges[item.id] ?? ("badge" in item ? item.badge : undefined) })),
  }));
  const activeView = (["org-detail", "person-detail", "project-detail"].includes(view))
    ? (view === "org-detail" ? "organizations" : view === "project-detail" ? "projects" : "people") as NavView
    : view;
  const choose = (target: NavView) => {
    onNav(target);
    onNavigate?.();
  };

  return (
    <aside className={cn("flex h-dvh flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200", collapsed ? "w-[4.75rem]" : "w-[17rem]", className)}>
      <div className={cn("border-b border-sidebar-border", collapsed ? "flex flex-col items-center gap-2 px-3 py-4" : "flex items-center justify-between px-5 py-5")}>
        <BinnieMark compact={collapsed} />
        <div className="flex items-center gap-1">
          <button onClick={() => choose("search")} aria-label="Search your workspace" title={collapsed ? "Search" : undefined} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"><Search className="h-4 w-4" /></button>
          {onToggleCollapse && <button onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>}
        </div>
      </div>
      <nav aria-label="Main navigation" className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {navGroups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && (collapsed ? "mt-3" : "mt-5"))}>
            {!collapsed && group.label && (
              <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>
            )}
            {group.items.map((item: { id: NavView; label: string; icon: ReactNode; badge?: number; urgent?: boolean; highlight?: boolean }) => {
              const isActive = activeView === item.id;
              return (
                <button key={item.id} onClick={() => choose(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative mb-0.5 flex rounded-xl text-[13px] transition-all duration-200",
                    collapsed ? "mx-auto h-10 w-10 items-center justify-center" : "w-full items-center gap-2.5 px-3 py-2.5",
                    isActive ? "binnie-sidebar-active bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
                    item.highlight && !isActive && "text-primary"
                  )}>
                  <span className={cn("flex-shrink-0", isActive ? "text-primary" : "opacity-65")}>{item.icon}</span>
                  {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={cn("rounded-full text-center text-[10px] font-medium", collapsed ? "absolute -right-1 -top-1 min-w-4 px-1 py-0.5" : "min-w-[19px] px-1.5 py-0.5",
                      item.urgent ? "bg-overdue/10 text-overdue" : isActive ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
                      {item.badge}
                    </span>
                  )}
                  {collapsed && <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+0.65rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground opacity-0 shadow-[0_5px_16px_rgb(35_41_61_/_0.10)] transition-opacity group-hover:opacity-100">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={cn("border-t border-sidebar-border py-4", collapsed ? "px-2" : "px-4")}>
        <button onClick={onProfileClick} title={collapsed ? "Profile & settings" : undefined} className={cn("group relative flex rounded-xl text-left transition-colors hover:bg-sidebar-accent/60", collapsed ? "mx-auto h-10 w-10 items-center justify-center" : "w-full items-center gap-2.5 px-2 py-2")}>
          <Avatar name={profile.displayName || "Charlotte"} size="sm" />
          {!collapsed && <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground truncate">{profile.displayName || "Charlotte"}</p>
            <p className="text-[10px] text-muted-foreground">{profile.role}</p>
          </div>}
          {!collapsed && <Settings className="w-3.5 h-3.5 text-muted-foreground" />}
          {collapsed && <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+0.65rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground opacity-0 shadow-[0_5px_16px_rgb(35_41_61_/_0.10)] transition-opacity group-hover:opacity-100">Profile & settings</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function BinnieApp() {
  const taskStoreRevision = useTaskStoreVersion();
  const [view, setView] = useState<NavView>("home");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgName | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>("soft");
  const [profile, setProfile] = useState<UserProfile>({ directoryId: "person-charlotte", displayName: "Charlotte", role: "Owner", email: "", timezone: "Asia/Jakarta", dateFormat: "12 Aug 2026" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    initializeTaskStore();
  }, []);
  void taskStoreRevision;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      if (getStoredPreference(BINNIE_SIDEBAR_COLLAPSED_STORAGE_KEY, LEGACY_LUMA_STORAGE_KEYS.sidebarCollapsed) === "true") setSidebarCollapsed(true);
    }, 0);
    return () => window.clearTimeout(preferenceTimer);
  }, []);

  useEffect(() => {
    const themeTimer = window.setTimeout(() => {
      const savedTheme = getStoredPreference(BINNIE_WORKSPACE_THEME_STORAGE_KEY, LEGACY_LUMA_STORAGE_KEYS.workspaceTheme);
      const theme: WorkspaceTheme = savedTheme === "grounded"
        ? "clear"
        : savedTheme === "clear" || savedTheme === "dark"
          ? savedTheme
          : "soft";
      if (savedTheme === "grounded") window.localStorage.setItem(BINNIE_WORKSPACE_THEME_STORAGE_KEY, "clear");
      setWorkspaceTheme(theme);
      document.documentElement.dataset.theme = theme;
    }, 0);
    return () => window.clearTimeout(themeTimer);
  }, []);

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    window.localStorage.setItem(BINNIE_SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
  }

  function changeWorkspaceTheme(theme: WorkspaceTheme) {
    setWorkspaceTheme(theme);
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(BINNIE_WORKSPACE_THEME_STORAGE_KEY, theme);
    setAccountMessage(`${theme.charAt(0).toUpperCase()}${theme.slice(1)} workspace theme applied`);
    window.setTimeout(() => setAccountMessage(""), 2400);
  }

  function navTo(v: NavView, opts?: { org?: OrgName; project?: string; person?: string }) {
    setView(v);
    setSelectedTask(null);
    if (opts?.org !== undefined) setSelectedOrg(opts.org);
    if (opts?.project !== undefined) setSelectedProject(opts.project);
    if (opts?.person !== undefined) setSelectedPerson(opts.person);
  }

  function renderView() {
    switch (view) {
      case "home": return <HomeView onTaskClick={setSelectedTask} onNavigate={navTo} onProjectClick={project => navTo("project-detail", { project })} onOrgClick={org => navTo("org-detail", { org })} userName={profile.displayName || "Charlotte"} />;
      case "today": return <TodayView onTaskClick={setSelectedTask} />;
      case "this-week": return <ThisWeekView onTaskClick={setSelectedTask} />;
      case "inbox": return <InboxView />;
      case "delegated": return <DelegatedView onTaskClick={setSelectedTask} onFollowUp={() => navTo("followup")} onPersonClick={person => navTo("person-detail", { person })} />;
      case "waiting": return <WaitingView onTaskClick={setSelectedTask} />;
      case "review": return <ReviewView onTaskClick={setSelectedTask} />;
      case "overdue": return <OverdueView onTaskClick={setSelectedTask} />;
      case "all-tasks": return <AllTasksView onTaskClick={setSelectedTask} onNewTask={() => navTo("inbox")} />;
      case "people": return <PeopleView onPersonClick={name => navTo("person-detail", { person: name })} />;
      case "person-detail": return selectedPerson
        ? <PersonDetailView personName={selectedPerson} onBack={() => setView("people")} onTaskClick={setSelectedTask} onFollowUp={() => navTo("followup")} />
        : <PeopleView onPersonClick={name => navTo("person-detail", { person: name })} />;
      case "followup": return <FollowUpView onTaskClick={setSelectedTask} />;
      case "organizations": return <OrganizationsView onOrgClick={org => navTo("org-detail", { org })} />;
      case "org-detail": return selectedOrg
        ? <OrgDetailView orgName={selectedOrg} onBack={() => setView("organizations")} onTaskClick={setSelectedTask} onProjectClick={id => navTo("project-detail", { project: id })} onNavigate={navTo} onPersonClick={person => navTo("person-detail", { person })} />
        : <OrganizationsView onOrgClick={org => navTo("org-detail", { org })} />;
      case "projects": return <ProjectsView onProjectClick={id => navTo("project-detail", { project: id })} />;
      case "project-detail": return selectedProject
        ? <ProjectDetailView key={selectedProject} projectId={selectedProject} onBack={() => setView("projects")} onTaskClick={setSelectedTask} />
        : <ProjectsView onProjectClick={id => navTo("project-detail", { project: id })} />;
      case "search": return <SearchView onTaskClick={setSelectedTask} />;
      default: return <HomeView onTaskClick={setSelectedTask} onNavigate={navTo} onProjectClick={project => navTo("project-detail", { project })} onOrgClick={org => navTo("org-detail", { org })} userName={profile.displayName || "Charlotte"} />;
    }
  }

  return (
    <CurrentUserContext.Provider value={profile.directoryId}>
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar className="hidden lg:flex" view={view} onNav={v => navTo(v)} profile={profile} onProfileClick={() => setProfileOpen(true)} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-sidebar/90 px-4 backdrop-blur-sm lg:hidden">
          <button aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)} className="rounded-xl p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><Menu className="h-5 w-5" /></button>
          <BinnieMark compact />
          <button aria-label="Search your workspace" onClick={() => navTo("search")} className="rounded-xl p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><Search className="h-5 w-5" /></button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-[#293047]/15 backdrop-blur-[1px]" />
          <Sidebar className="relative z-10 !flex shadow-[16px_0_40px_rgb(38_48_71_/_0.12)]" view={view} onNav={v => navTo(v)} profile={profile} onProfileClick={() => { setMobileMenuOpen(false); setProfileOpen(true); }} onNavigate={() => setMobileMenuOpen(false)} />
        </div>
      )}
      {selectedTask && <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />}
      {profileOpen && <ProfilePanel profile={profile} theme={workspaceTheme} onThemeChange={changeWorkspaceTheme} onSave={nextProfile => { setProfile(nextProfile); setAccountMessage("Profile updated"); window.setTimeout(() => setAccountMessage(""), 2400); }} onClose={() => setProfileOpen(false)} onSignOut={() => { setProfileOpen(false); setAccountMessage("Signed out of this local preview"); window.setTimeout(() => setAccountMessage(""), 2400); }} />}
      {accountMessage && <div role="status" className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl border border-success/20 bg-card px-3.5 py-2 text-[12px] font-medium text-success shadow-[0_8px_22px_rgb(35_41_61_/_0.10)]">{accountMessage}</div>}
    </div>
    </CurrentUserContext.Provider>
  );
}
