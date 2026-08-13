"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Home, CalendarDays, Inbox, Users, AlertTriangle,
  Building2, FolderKanban, Search, Sparkles, Paperclip,
  Link2, FileText, CheckCircle2, X, RotateCcw, MoreHorizontal,
  Settings, ExternalLink,
  ChevronRight, Plus, Globe, GitBranch, RefreshCw,
  ChevronDown, ChevronUp, Check, Calendar, Send,
  Hourglass, Eye, BarChart2, Layers, Timer,
  SlidersHorizontal, ArrowUpDown, Copy, ChevronLeft,
  MessageSquare, ListTodo, Target, UserCheck, Menu, ImagePlus,
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
type AreaName = "System Development" | "Operations" | "Marketing" | "Finance" | "HR" | (string & {});
type Priority = "urgent" | "high" | "medium" | "low";
type TaskStatus = "todo" | "in_progress" | "waiting" | "review" | "done";
type WorkspaceTheme = "soft" | "grounded" | "dark";
type NavView =
  | "home" | "today" | "this-week" | "inbox" | "delegated"
  | "waiting" | "review" | "overdue" | "organizations" | "projects" | "search"
  | "all-tasks" | "people" | "person-detail" | "org-detail" | "project-detail" | "followup";

type ResourceType = "website" | "sheet" | "figma" | "github" | "drive" | "doc" | "dashboard" | "notion" | "other";
interface TaskLink { label: string; url: string; type: ResourceType }
interface OrganizationResource extends TaskLink { area?: AreaName; project?: string; description?: string }
interface TaskFile { name: string; type: "pdf" | "excel" | "screenshot" | "doc" }
interface Activity { type: "assigned" | "updated" | "submitted" | "commented" | "revision" | "approved"; actor: string; text: string; time: string }

interface Task {
  id: string; title: string; org: OrgName; area: AreaName;
  project?: string; priority: Priority; status: TaskStatus;
  assignee?: string; nextActionBy: string;
  deadline?: string; waitingSince?: string; responseDue?: string;
  lastUpdate?: string; isDelegated: boolean; isWaiting: boolean;
  isOverdue?: boolean; isToday?: boolean; estimatedHours?: number;
  carriedOver?: boolean; archived?: boolean; completedInCurrentMonth?: boolean; staleDays?: number;
  links?: TaskLink[]; files?: TaskFile[]; originalCapture?: string; activity?: Activity[];
}

interface PersonRecord {
  name: string; role: string; org: OrgName;
  active: number; waitingOnThem: number; waitingOnMe: number;
  overdue: number; lastUpdate: string; oldestUnanswered: string; needsFollowUp: boolean;
}

interface UserProfile {
  displayName: string;
  role: string;
  email: string;
  timezone: string;
  dateFormat: string;
}

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
  resources: TaskLink[]; recentActivity: Activity[];
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const TASKS: Task[] = [
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
    org: "Apotik", area: "Operations", priority: "urgent", status: "todo",
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
    org: "Apotik", area: "Finance", priority: "urgent", status: "todo",
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
    org: "Villa Khayangan", area: "Marketing", priority: "high", status: "todo",
    nextActionBy: "me", deadline: "Today", isDelegated: false, isWaiting: false, isToday: true, estimatedHours: 1.5,
    files: [{ name: "Marketing_Budget_Q3.xlsx", type: "excel" }],
    activity: [{ type: "assigned", actor: "Marketing Team", text: "Sent for owner approval", time: "Yesterday" }]
  },
  {
    id: "t11", title: "Update staff schedule for Lebaran holiday",
    org: "Villa Khayangan", area: "HR", priority: "medium", status: "todo",
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
    org: "Villa Khayangan", area: "HR", priority: "medium", status: "todo",
    assignee: "Bu Desti", nextActionBy: "Bu Desti",
    deadline: "Mon, 19 Aug", isDelegated: true, isWaiting: true, waitingSince: "Today",
    activity: [{ type: "assigned", actor: "You", text: "Assigned to Bu Desti", time: "Today" }]
  },
];

const ARCHIVED_TASKS: Task[] = [
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

const STRATEGIC_PROJECTS = [
  { id: "p1", name: "Villa Website Revamp", org: "Villa Khayangan" as OrgName, progress: 65, tasks: 12, done: 8, deadline: "Sep 2024", status: "on_track" as const },
  { id: "p2", name: "Apotik Management System", org: "Apotik" as OrgName, progress: 30, tasks: 18, done: 5, deadline: "Dec 2024", status: "at_risk" as const },
  { id: "p3", name: "Finance Automation", org: "Villa Khayangan" as OrgName, progress: 80, tasks: 10, done: 8, deadline: "Aug 2024", status: "on_track" as const },
];

const PEOPLE_DATA: PersonRecord[] = [
  { name: "Bu Desti", role: "Manager", org: "Villa Khayangan", active: 4, waitingOnThem: 3, waitingOnMe: 1, overdue: 1, lastUpdate: "Yesterday", oldestUnanswered: "5 days", needsFollowUp: true },
  { name: "Purchasing Manager", role: "Procurement", org: "Villa Khayangan", active: 2, waitingOnThem: 2, waitingOnMe: 0, overdue: 1, lastUpdate: "2 days ago", oldestUnanswered: "3 days", needsFollowUp: true },
  { name: "HR Manager", role: "HR", org: "Villa Khayangan", active: 1, waitingOnThem: 0, waitingOnMe: 1, overdue: 0, lastUpdate: "1 day ago", oldestUnanswered: "4 days", needsFollowUp: false },
  { name: "Design Team", role: "Design", org: "Villa Khayangan", active: 1, waitingOnThem: 0, waitingOnMe: 1, overdue: 0, lastUpdate: "Today", oldestUnanswered: "3 days", needsFollowUp: false },
  { name: "Marketing Team", role: "Marketing", org: "Villa Khayangan", active: 2, waitingOnThem: 1, waitingOnMe: 0, overdue: 0, lastUpdate: "3 days ago", oldestUnanswered: "6 days", needsFollowUp: true },
];

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
      { label: "Production Site", url: "#", type: "website" },
      { label: "GitHub Repo", url: "#", type: "github" },
      { label: "Figma File", url: "#", type: "figma" },
      { label: "Requirements", url: "#", type: "drive" },
      { label: "Sprint Tracker", url: "#", type: "sheet" },
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
  const c = ORG_COLORS[org];
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
    todo: "bg-[#a8afbd]", in_progress: "bg-primary",
    waiting: "bg-info", review: "bg-review", done: "bg-success",
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

function SectionHeader({ label, count, color = "bg-primary" }: { label: string; count?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
      <h2 className="luma-heading text-[15px] font-bold text-foreground">{label}</h2>
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{count}</span>
      )}
    </div>
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
  return (
    <button onClick={onClick}
      className={cn(
        "w-full text-left group rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_10px_22px_rgb(35_41_61_/_0.065)]",
        compact ? "p-3.5" : "p-4.5",
        task.isOverdue && "border-overdue/25 bg-[#fff8f7]",
        task.status === "waiting" && "border-info/20 bg-[#fbfdff]",
        task.status === "review" && "border-review/25 bg-[#fdfbff]",
        task.status === "done" && "border-success/20 bg-[#fbfdfb]",
      )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0"><PriorityDot priority={task.priority} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm font-medium leading-snug text-foreground", compact && "text-[13px]")}>{task.title}</p>
            {task.isOverdue && <span className="flex-shrink-0 rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">Past target</span>}
            {task.status === "review" && <span className="flex-shrink-0 rounded-full bg-review/10 px-2 py-1 text-[10px] font-medium text-review">Ready to review</span>}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <OrgBadge org={task.org} />
            <span className="text-muted-foreground text-[11px]">·</span>
            <AreaBadge area={task.area} />
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
              {task.assignee && (
                <div className="flex items-center gap-1.5">
                  <Avatar name={task.assignee} size="xs" />
                  <span className="text-[11px] text-muted-foreground">{task.assignee}</span>
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
        </div>
      </div>
    </button>
  );
}

// ─── COMPACT TASK ROW ─────────────────────────────────────────────────────────

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const isMyAction = task.nextActionBy === "me";
  const hasResources = (task.links?.length || 0) + (task.files?.length || 0) > 0;
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
        <span className="hidden lg:block"><AreaBadge area={task.area} /></span>
        <span className="hidden sm:inline-flex">{task.assignee
          ? <Avatar name={task.assignee} size="xs" />
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function markDone() {
    Object.assign(task, { status: "done" as TaskStatus, isWaiting: false, isOverdue: false, nextActionBy: "me", lastUpdate: "Just now" });
    onClose();
  }

  function requestRevision() {
    Object.assign(task, { status: "todo" as TaskStatus, isWaiting: true, nextActionBy: task.assignee || "me", lastUpdate: "Revision requested just now" });
    onClose();
  }

  function reschedule() {
    Object.assign(task, { deadline: "Tomorrow", isOverdue: false, lastUpdate: "Rescheduled just now" });
    onClose();
  }

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
              <AreaBadge area={task.area} />
            </div>
            <h2 className="luma-heading text-lg font-bold leading-snug text-foreground">{task.title}</h2>
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
              { label: "Assignee", value: task.assignee ? <div className="flex items-center gap-1.5"><Avatar name={task.assignee} size="xs" /><span className="text-sm">{task.assignee}</span></div> : <span className="text-sm text-muted-foreground">Unassigned</span> },
              { label: "Next Action By", value: <span className={cn("text-sm font-medium", task.nextActionBy === "me" ? "text-warning" : "text-primary")}>{task.nextActionBy === "me" ? "You" : task.nextActionBy}</span> },
              { label: "Target Date", value: <span className={cn("text-sm font-medium", task.isOverdue ? "text-overdue" : "text-foreground")}>{task.deadline || "—"}</span> },
              { label: "Project", value: <span className="text-sm text-foreground">{task.project || "—"}</span> },
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
          {task.originalCapture && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Original Capture</h3>
              <div className="rounded-xl border border-border bg-muted/45 p-3">
                <p className="text-[13px] text-muted-foreground italic leading-relaxed">&ldquo;{task.originalCapture}&rdquo;</p>
              </div>
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
        <div className="flex gap-2 border-t border-border p-4 sm:p-5">
          <button onClick={markDone} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">
            {task.status === "review" ? "Approve" : "Mark Done"}
          </button>
          {task.status === "review" && (
            <button onClick={requestRevision} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-primary/10">
              Request Revision
            </button>
          )}
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

type CaptureField = "org" | "assignee" | "deadline";
type InlineCapturePreview = ParsedTask & { uncertain: CaptureField[] };

function createCapturePreviews(input: string, organization?: OrgName): InlineCapturePreview[] {
  const lines = input.split("\n").map(line => line.trim()).filter(Boolean).slice(0, 4);

  return lines.map(line => {
    const normalized = line.toLowerCase();
    const assigneeMatch = line.match(/\b(?:ask|assign(?:\s+to)?|follow up with)\s+(.+?)\s+to\b/i);
    const assignee = assigneeMatch?.[1]?.trim();
    const dateMatch = line.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const deadline = dateMatch?.[1] ? dateMatch[1][0].toUpperCase() + dateMatch[1].slice(1).toLowerCase() : undefined;
    const hasKnownOrg = /villa|khayangan|apotik|medicine|personal|bank/.test(normalized);
    const inferredOrg: OrgName = normalized.includes("apotik") || normalized.includes("medicine")
      ? "Apotik"
      : normalized.includes("villa") || normalized.includes("khayangan")
        ? "Villa Khayangan"
        : normalized.includes("bank") || normalized.includes("personal")
        ? "Personal"
        : organization || "Personal";
    const area: AreaName = /website|brand|marketing|social/.test(normalized)
      ? "Marketing"
      : /code|system|website|app|flow/.test(normalized)
        ? "System Development"
        : /invoice|cash|money|budget|finance/.test(normalized)
          ? "Finance"
          : /hiring|people|employee|team/.test(normalized)
            ? "HR"
            : "Operations";
    const priority: Priority = /urgent|asap|critical/.test(normalized) ? "urgent" : /important|priority|soon/.test(normalized) ? "high" : "medium";
    const title = line.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();

    return {
      org: inferredOrg,
      area,
      title: title ? title[0].toUpperCase() + title.slice(1) : "New task",
      priority,
      originalText: line,
      assignee,
      deadline,
      link: line.match(/https?:\/\/\S+/i)?.[0],
      uncertain: [
        ...(hasKnownOrg || organization ? [] : ["org" as const]),
        ...(assignee ? [] : ["assignee" as const]),
        ...(deadline ? [] : ["deadline" as const]),
      ],
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

function saveCapturedTask(capture: ParsedTask, attachments: string[] = []) {
  const now = Date.now();
  const isDelegated = Boolean(capture.assignee);
  TASKS.push({
    id: `capture-${now}-${TASKS.length}`,
    title: capture.title,
    org: capture.org,
    area: capture.area,
    priority: capture.priority,
    status: "todo",
    assignee: capture.assignee,
    nextActionBy: capture.assignee || "me",
    deadline: capture.deadline,
    isDelegated,
    isWaiting: false,
    isToday: capture.deadline === "Today",
    files: filesFromCapture(attachments),
    links: capture.link ? [{ label: "Captured link", url: capture.link, type: "website" }] : undefined,
    originalCapture: capture.originalText,
    lastUpdate: "Just now",
    activity: [{ type: "assigned", actor: "You", text: "Created from Smart Inbox", time: "Just now" }],
  });
}

function QuickCapture({ organization, onSaved }: { organization?: OrgName; onSaved?: () => void }) {
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previews, setPreviews] = useState<InlineCapturePreview[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [attachments, setAttachments] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const captureInputRef = useRef<HTMLTextAreaElement>(null);

  function resetCapture(messageText?: string) {
    setInput("");
    setPreviews([]);
    setEditing(null);
    setSaved(new Set());
    setAttachments([]);
    setLinkDraft("");
    setShowLinkInput(false);
    if (messageText) {
      setMessage(messageText);
      setTimeout(() => setMessage(""), 2600);
    }
  }

  function organize() {
    if (!input.trim()) return;
    setProcessing(true);
    setMessage("");
    setTimeout(() => {
      setPreviews(createCapturePreviews(input, organization));
      setSaved(new Set());
      setProcessing(false);
    }, 700);
  }

  function updatePreview(index: number, patch: Partial<InlineCapturePreview>) {
    setPreviews(current => current.map((preview, previewIndex) => previewIndex === index ? { ...preview, ...patch } : preview));
  }

  function save(index: number) {
    if (saved.has(index)) return;
    saveCapturedTask(previews[index], attachments);
    onSaved?.();
    setSaved(current => new Set([...current, index]));
    setEditing(null);
  }

  function saveAll() {
    previews.forEach((preview, index) => {
      if (!saved.has(index)) {
        saveCapturedTask(preview, attachments);
        onSaved?.();
      }
    });
    setSaved(new Set(previews.map((_, index) => index)));
    setTimeout(() => resetCapture(previews.length === 1 ? "Saved to your workspace." : `${previews.length} items saved to your workspace.`), 650);
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
              <h2 className="luma-heading text-[15px] font-bold text-foreground">Quick Capture</h2>
              <p className="text-[11px] text-muted-foreground">A thought is enough. Binnie handles the structure.</p>
            </div>
            {organization && <OrgBadge org={organization} />}
          </div>
          {message && <span role="status" aria-live="polite" className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">{message}</span>}
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
          <button onClick={organize} disabled={!input.trim() || processing} className={cn("ml-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition-colors", input.trim() && !processing ? "bg-primary text-primary-foreground hover:bg-primary/85" : "cursor-not-allowed bg-[var(--theme-capture-input)] text-muted-foreground") }>
            <Sparkles className="h-3.5 w-3.5" /> {processing ? "Organizing…" : "Organize with Binnie"}
          </button>
        </div>
        {showLinkInput && <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--theme-capture-secondary-border)] bg-[var(--theme-capture-input)] px-3 py-2"><Link2 className="h-3.5 w-3.5 flex-shrink-0 text-info" /><input autoFocus value={linkDraft} onChange={event => setLinkDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && addLink()} placeholder="Paste a link" className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground" /><button onClick={addLink} disabled={!linkDraft.trim()} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-medium text-primary disabled:opacity-45">Add</button></div>}
        {previews.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-[var(--theme-capture-divider)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium text-secondary-foreground">Here’s what Binnie understood.</p>
              {previews.length > 1 && <button onClick={saveAll} className="text-[11px] font-medium text-primary hover:text-primary/80">Add All</button>}
            </div>
            {previews.map((preview, index) => {
              const isSaved = saved.has(index);
              const visibleFields = preview.uncertain.length ? preview.uncertain : ["org", "assignee", "deadline"] as CaptureField[];
              return (
                <div key={`${preview.originalText}-${index}`} className={cn("rounded-xl border bg-white/85 p-3 transition-all", isSaved ? "border-success/25 bg-[#f7fbf8]" : "border-[#e4e3ec]")}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-foreground">{preview.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <OrgBadge org={preview.org} /><AreaBadge area={preview.area} />
                        {preview.assignee && <span>Assigned to {preview.assignee}</span>}
                        {preview.deadline && <span>{preview.assignee ? "·" : ""} Response due {preview.deadline}</span>}
                      </div>
                      {preview.uncertain.length > 0 && !isSaved && <p className="mt-2 text-[10px] text-warning">Binnie needs a little help with {preview.uncertain.map(field => field === "org" ? "the organization" : field === "assignee" ? "who owns it" : "the target date").join(" and ")}.</p>}
                      {editing === index && !isSaved && (
                        <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                          {visibleFields.includes("org") && <label className="text-[10px] font-medium text-muted-foreground">Organization<select value={preview.org} onChange={event => updatePreview(index, { org: event.target.value as OrgName, uncertain: preview.uncertain.filter(field => field !== "org") })} className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-[11px] text-foreground"><option>Villa Khayangan</option><option>Apotik</option><option>Personal</option></select></label>}
                          {visibleFields.includes("assignee") && <label className="text-[10px] font-medium text-muted-foreground">Assigned to<input value={preview.assignee || ""} onChange={event => updatePreview(index, { assignee: event.target.value, uncertain: preview.uncertain.filter(field => field !== "assignee") })} placeholder="Name" className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-[11px] text-foreground" /></label>}
                          {visibleFields.includes("deadline") && <label className="text-[10px] font-medium text-muted-foreground">Target date<input value={preview.deadline || ""} onChange={event => updatePreview(index, { deadline: event.target.value, uncertain: preview.uncertain.filter(field => field !== "deadline") })} placeholder="Wednesday" className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-[11px] text-foreground" /></label>}
                        </div>
                      )}
                    </div>
                    {isSaved ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-medium text-success"><Check className="h-3 w-3" /> Saved</span> : <div className="flex flex-shrink-0 items-center gap-1"><button onClick={() => setEditing(editing === index ? null : index)} className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Edit</button><button onClick={() => save(index)} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/15">Save</button></div>}
                  </div>
                </div>
              );
            })}
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

const HOME_LAYOUT_STORAGE_KEY = "luma-home-layout";
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
            <h2 className="luma-heading mt-1 text-xl font-bold text-foreground">Customize Home</h2>
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
  const workspaceDate = getWorkspaceCalendarDate();
  const todayTasks = TASKS.filter(t => t.isToday && t.nextActionBy === "me");
  const overdueTasks = TASKS.filter(t => t.isOverdue);
  const reviewTasks = TASKS.filter(t => t.status === "review" && t.nextActionBy === "me");
  const waitingPeople = [
    { name: "Bu Desti", outstanding: 3, overdue: 1, oldest: "5 days" },
    { name: "Purchasing Manager", outstanding: 2, overdue: 1, oldest: "2 days" },
    { name: "HR Manager", outstanding: 1, overdue: 0, oldest: "4 days" },
  ];
  const weekOrgs: { org: OrgName; tasks: number; done: number }[] = [
    { org: "Villa Khayangan", tasks: 8, done: 3 },
    { org: "Apotik", tasks: 4, done: 1 },
    { org: "Personal", tasks: 2, done: 1 },
  ];
  const [homeCards, setHomeCards] = useState<HomeCardConfig[]>(DEFAULT_HOME_CARDS);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const completedTasks = TASKS.filter(task => task.status === "done");

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const savedLayout = window.localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
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
    window.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, JSON.stringify(homeCards));
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
            <h1 className="luma-heading text-3xl font-bold text-foreground sm:text-[2rem]">Welcome Back, {userName}</h1>
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
          { label: "Today", value: todayTasks.length, sub: "~5h of focused work", color: "text-primary", surface: "bg-[#eae6ff]/55", icon: <CalendarDays className="w-4 h-4" />, view: "today" as NavView },
          { label: "Needs attention", value: overdueTasks.length, sub: "A gentle nudge", color: "text-overdue", surface: "bg-[#f7dde6]/45", icon: <AlertTriangle className="w-4 h-4" />, view: "overdue" as NavView },
          { label: "Delegated", value: TASKS.filter(t => t.isDelegated).length, sub: "Across your teams", color: "text-success", surface: "bg-[#dcede7]/55", icon: <Users className="w-4 h-4" />, view: "delegated" as NavView },
          { label: "Waiting", value: TASKS.filter(t => t.isWaiting).length, sub: "For a response", color: "text-info", surface: "bg-[#ddebfa]/55", icon: <Hourglass className="w-4 h-4" />, view: "waiting" as NavView },
        ].map(({ label, value, sub, color, surface, icon, view }) => (
          <button key={label} onClick={() => onNavigate(view)} className={cn("luma-card luma-card-hover p-4 text-left sm:p-5", surface)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
              <span className={cn(color, "opacity-60")}>{icon}</span>
            </div>
            <p className={cn("luma-heading text-3xl font-bold", color)}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={cardClass("today", "luma-card overflow-hidden lg:col-span-2")} style={cardStyle("today")}>
            <div className="flex items-center justify-between border-b border-border bg-[#eae6ff]/35 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <h2 className="luma-heading text-[15px] font-bold text-foreground">Today</h2>
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
          <div className={cardClass("needs-attention", "luma-card overflow-hidden")} style={cardStyle("needs-attention")}>
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
          <div className={cardClass("recent-work", "luma-card overflow-hidden")} style={cardStyle("recent-work")}>
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
          <div className={cardClass("waiting-on-people", "luma-card overflow-hidden")} style={cardStyle("waiting-on-people")}>
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
          <div className={cardClass("this-week", "luma-card overflow-hidden")} style={cardStyle("this-week")}>
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
                      <div className={cn("h-full rounded-full transition-all", c.dot)} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={cardClass("strategic-projects", "luma-card overflow-hidden")} style={cardStyle("strategic-projects")}>
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
                      <div className={cn("h-full rounded-full", c.dot)} style={{ width: `${proj.progress}%` }} />
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
          <div className={cardClass("agenda", "luma-card overflow-hidden")} style={cardStyle("agenda")}>
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
          <div className={cardClass("needs-my-review", "luma-card overflow-hidden")} style={cardStyle("needs-my-review")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-review" /><h2 className="text-sm font-semibold text-foreground">Needs My Review</h2></div>
            <div className="p-3 space-y-1.5">
              {reviewTasks.length ? reviewTasks.map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="flex w-full items-center gap-3 rounded-xl bg-review/[0.05] p-3 text-left transition-colors hover:bg-review/[0.10]"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-review/15 text-review"><Eye className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{task.title}</span><span className="block truncate text-[11px] text-muted-foreground">{task.assignee} · {task.org}</span></span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></button>) : <p className="px-2 py-5 text-center text-[12px] text-muted-foreground">Nothing waiting for your review.</p>}
            </div>
          </div>
          <div className={cardClass("follow-up", "luma-card overflow-hidden")} style={cardStyle("follow-up")}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-warning" /><h2 className="text-sm font-semibold text-foreground">Follow-Up</h2></div><button onClick={() => onNavigate("followup")} className="text-[11px] font-medium text-primary hover:text-primary/80">View Follow-Ups</button></div>
            <div className="p-3 space-y-2">
              {FOLLOWUP_DATA.slice(0, 3).map(person => { const overdue = person.items.filter(item => item.status === "overdue").length; const oldest = Math.max(...person.items.map(item => item.daysWaiting)); return <button key={person.person} onClick={() => onNavigate("followup")} className="flex w-full items-center gap-3 rounded-xl bg-muted/45 p-3 text-left transition-colors hover:bg-muted/75"><Avatar name={person.person} size="sm" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-foreground">{person.person}</span><span className="block text-[11px] text-muted-foreground">{person.items.length} items · Oldest waiting: {oldest} days</span></span>{overdue > 0 && <span className="rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">{overdue} overdue</span>}</button>; })}
            </div>
          </div>
          <div className={cardClass("recently-completed", "luma-card overflow-hidden")} style={cardStyle("recently-completed")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-success" /><h2 className="text-sm font-semibold text-foreground">Recently Completed</h2></div>
            <div className="p-3 space-y-1.5">
              {completedTasks.length ? completedTasks.slice(0, 3).map(task => <button key={task.id} onClick={() => onTaskClick(task)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-success/[0.06]"><CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{task.title}</span><span className="block text-[11px] text-muted-foreground">{task.org} · {task.area}</span></span><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></button>) : <p className="px-2 py-5 text-center text-[12px] text-muted-foreground">Nothing to show just yet.</p>}
            </div>
          </div>
          <div className={cardClass("organization-workload", "luma-card overflow-hidden")} style={cardStyle("organization-workload")}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4"><div className="h-1.5 w-1.5 rounded-full bg-primary" /><h2 className="text-sm font-semibold text-foreground">Organization Workload</h2></div>
            <div className="p-4 space-y-3">
              {(["Villa Khayangan", "Apotik", "Personal"] as OrgName[]).map(org => { const active = TASKS.filter(task => task.org === org && task.status !== "done").length; const total = TASKS.filter(task => task.org === org).length; const color = ORG_COLORS[org]; return <button key={org} onClick={() => onOrgClick(org)} className="block w-full rounded-xl p-1 text-left transition-colors hover:bg-muted/55"><div className="mb-1.5 flex items-center justify-between"><span className={cn("text-[12px] font-medium", color.text)}>{org}</span><span className="text-[11px] text-muted-foreground">{active} active</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", color.dot)} style={{ width: `${Math.round((active / total) * 100)}%` }} /></div></button>; })}
            </div>
          </div>
        </div>
      <HomeLayoutDrawer open={isCustomizing} cards={homeCards} onToggle={toggleCard} onMove={moveCard} onReset={() => setHomeCards(DEFAULT_HOME_CARDS)} onClose={() => setIsCustomizing(false)} />
    </div>
  );
}

// ─── SMART INBOX VIEW ─────────────────────────────────────────────────────────

interface ParsedTask { title: string; org: OrgName; area: AreaName; assignee?: string; deadline?: string; priority: Priority; originalText: string; link?: string }

function InboxView() {
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTask[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [attachments, setAttachments] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  function handleProcess() {
    if (!input.trim()) return;
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setParsed(createCapturePreviews(input)); }, 700);
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

  function updateParsed(index: number, patch: Partial<ParsedTask>) {
    setParsed(current => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task));
  }

  function confirmTask(index: number) {
    if (confirmed.has(index)) return;
    saveCapturedTask(parsed[index], attachments);
    setConfirmed(current => new Set([...current, index]));
  }

  function confirmAll() {
    parsed.forEach((task, index) => {
      if (!confirmed.has(index)) saveCapturedTask(task, attachments);
    });
    setConfirmed(new Set(parsed.map((_, index) => index)));
  }

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Smart Inbox</p>
        <h1 className="luma-heading text-3xl font-bold text-foreground">A place to set it down.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Write whatever is on your mind. Tasks, reminders, ideas, follow-ups, or anything you want to remember. Binnie will turn it into clear next steps.</p>
      </div>
      <div className="luma-card mb-6 overflow-hidden focus-within:border-primary/40">
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
                input.trim() && !processing ? "bg-primary text-primary-foreground hover:bg-primary/85" : "cursor-not-allowed bg-muted text-muted-foreground")}>
              {processing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Organizing…</> : <><Sparkles className="w-3.5 h-3.5" />Organize with Binnie</>}
            </button>
          </div>
        </div>
        {showLinkInput && <div className="flex items-center gap-2 border-t border-border bg-muted/25 px-4 py-3 sm:px-6"><Link2 className="h-3.5 w-3.5 flex-shrink-0 text-info" /><input autoFocus value={linkDraft} onChange={event => setLinkDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && addLink()} placeholder="Paste a link" className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground" /><button onClick={addLink} disabled={!linkDraft.trim()} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary disabled:opacity-45">Add link</button></div>}
      </div>
      {processing && (
        <div className="luma-card mb-6 border-primary/20 p-6">
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
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Binnie found {parsed.length} tasks</p>
            <button onClick={confirmAll} className="text-[11px] text-primary hover:text-primary/80 transition-colors">Add All</button>
          </div>
          <div className="space-y-3">
            {parsed.map((pt, i) => {
              const isConfirmed = confirmed.has(i);
              return (
                <div key={i} className={cn("rounded-xl border transition-all duration-300", isConfirmed ? "border-success/25 bg-success/5 opacity-70" : "bg-card border-border hover:border-primary/25")}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <OrgBadge org={pt.org} /><AreaBadge area={pt.area} /><PriorityBadge priority={pt.priority} />
                        </div>
                        {editing === i ? <div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={pt.title} onChange={event => updateParsed(i, { title: event.target.value })} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /><select value={pt.org} onChange={event => updateParsed(i, { org: event.target.value as OrgName })} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground"><option>Villa Khayangan</option><option>Apotik</option><option>Personal</option></select><input value={pt.deadline || ""} onChange={event => updateParsed(i, { deadline: event.target.value })} placeholder="Target date" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] text-foreground" /></div> : <p className="text-sm font-medium text-foreground">{pt.title}</p>}
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          {pt.assignee && <div className="flex items-center gap-1.5"><Avatar name={pt.assignee} size="xs" /><span className="text-[11px] text-muted-foreground">Assigned to {pt.assignee}</span></div>}
                          {pt.deadline && <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Due {pt.deadline}</span>}
                          {pt.link && <span className="flex items-center gap-1 text-[11px] text-info"><Globe className="w-3 h-3" />Website attached</span>}
                        </div>
                        <div className="mt-2 px-2 py-1.5 rounded bg-muted/40 border-l-2 border-muted">
                          <p className="text-[11px] text-muted-foreground italic">&ldquo;{pt.originalText}&rdquo;</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {isConfirmed
                          ? <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-[11px] font-medium text-success"><Check className="w-3 h-3" /> Saved</div>
                          : <>
                            <button onClick={() => confirmTask(i)} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors">Confirm</button>
                            <button onClick={() => setEditing(editing === i ? null : i)} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-[11px] hover:text-foreground transition-colors">{editing === i ? "Done" : "Edit"}</button>
                          </>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DELEGATED VIEW ───────────────────────────────────────────────────────────

function DelegatedView({ onTaskClick, onFollowUp, onPersonClick }: { onTaskClick: (task: Task) => void; onFollowUp: () => void; onPersonClick: (person: string) => void }) {
  const delegated = TASKS.filter(t => t.isDelegated && t.assignee);
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
            <div key={person} className="luma-card overflow-hidden">
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
    setRevision(current => current + 1);
  }
  function requestRevision(task: Task) {
    Object.assign(task, { status: "todo" as TaskStatus, isWaiting: true, nextActionBy: task.assignee || "me", lastUpdate: "Revision requested just now" });
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
            <div key={task.id} className="luma-card overflow-hidden border-review/20">
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
  const [tab, setTab] = useState<"others" | "me" | "blocked" | "external">("others");
  const tabs = [
    { id: "others" as const, label: "Waiting on Others", tasks: TASKS.filter(t => t.isWaiting && t.isDelegated) },
    { id: "me" as const, label: "Waiting on Me", tasks: TASKS.filter(t => t.status === "review" && t.nextActionBy === "me") },
    { id: "blocked" as const, label: "Blocked", tasks: [] },
    { id: "external" as const, label: "External", tasks: TASKS.filter(t => !t.isDelegated && t.isWaiting) },
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
            className="luma-card luma-card-hover w-full p-4 text-left">
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
  const todayTasks = TASKS.filter(t => t.isToday && t.nextActionBy === "me");
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
  const overdue = TASKS.filter(t => t.isOverdue);
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
  const plannedTasks: Record<number, Task[]> = {
    0: TASKS.filter(task => task.id === "t11"),
    1: TASKS.filter(task => task.id === "t1" || task.id === "t8"),
    3: TASKS.filter(task => task.id === "t6"),
    4: TASKS.filter(task => task.id === "t7"),
  };
  const todayTasks = TASKS.filter(task => task.isToday);
  return (
    <div className="h-full overflow-auto p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Week of {formatWorkspaceDate(monday, { day: "numeric", month: "short" })}</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>This Week</h1>
      </div>
      <div className="overflow-x-auto pb-2">
      <div className="grid min-h-[400px] min-w-[58rem] grid-cols-[repeat(5,minmax(10rem,1fr))] gap-4">
        {weekDays.map(({ date, index, label }) => {
          const tasks = index === weekdayIndex ? todayTasks : plannedTasks[index] || [];
          const isToday = index === weekdayIndex;
          const tint = ["bg-[#eae6ff]/60", "bg-[#dcede7]/60", "bg-[#ddebfa]/60", "bg-[#f8e3d3]/55", "bg-[#f5e7b8]/45"][index];
          return (
            <div key={date.toISOString()} className={cn("luma-board-column flex flex-col", tint, isToday && "border-primary/45 shadow-[0_8px_22px_rgb(142_148_242_/_0.10)]")}>
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
    { id: "todo", label: "To Do", tint: "luma-tint-lavender", dot: "bg-primary" },
    { id: "in_progress", label: "In Progress", tint: "luma-tint-mint", dot: "bg-success" },
    { id: "waiting", label: "Waiting", tint: "luma-tint-blue", dot: "bg-info" },
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
              <button onClick={() => setTaskLayout("list")} aria-label="List layout" aria-pressed={taskLayout === "list"} className={cn("rounded-lg p-1.5 transition-colors", taskLayout === "list" ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><ListTodo className="h-3.5 w-3.5" /></button>
              <button onClick={() => setTaskLayout("board")} aria-label="Board layout" aria-pressed={taskLayout === "board"} className={cn("rounded-lg p-1.5 transition-colors", taskLayout === "board" ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Layers className="h-3.5 w-3.5" /></button>
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
            <div className="grid min-w-[76rem] grid-cols-5 gap-4">
              {boardColumns.map(column => {
                const columnTasks = tasks.filter(task => task.status === column.id);
                return (
                  <section key={column.id} className={cn("luma-board-column", column.tint)}>
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
        <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]"><span className={cn("inline-flex items-center gap-1.5", task.status === "review" ? "text-review" : task.isWaiting ? "text-info" : "text-muted-foreground")}><StatusDot status={task.status} />{nextAction}</span><span className="text-border">·</span><span className={cn(task.isOverdue ? "text-overdue" : "text-muted-foreground")}>{target}</span>{archived && <><span className="text-border">·</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Archived</span></>}</span>
      </span>
    </button>
  );
}

function AllTasksView({ onTaskClick, onNewTask }: { onTaskClick: (task: Task) => void; onNewTask: () => void }) {
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
  const isActive = (task: Task) => task.status !== "done" && !task.archived;
  const currentMonth = formatWorkspaceDate(getWorkspaceCalendarDate(), { month: "short" });
  const hasCurrentMonthTarget = (task: Task) => Boolean(task.deadline) && (task.deadline === "Today" || task.deadline === "Tomorrow" || task.deadline === "Yesterday" || task.deadline!.includes(currentMonth) || !/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(task.deadline!));
  const isInScope = (task: Task) => {
    if (scope === "month") return isActive(task) && !task.carriedOver && hasCurrentMonthTarget(task);
    if (scope === "carried") return isActive(task) && Boolean(task.carriedOver || (task.isOverdue && !hasCurrentMonthTarget(task)));
    if (scope === "unscheduled") return isActive(task) && !task.deadline;
    return task.status === "done" && !task.archived && (task.completedInCurrentMonth || hasCurrentMonthTarget(task));
  };
  const matchesFilters = (task: Task) => {
    if (filterOrg && task.org !== filterOrg) return false;
    if (filterArea && task.area !== filterArea) return false;
    if (filterProject && task.project !== filterProject) return false;
    if (filterAssignee && task.assignee !== filterAssignee) return false;
    if (filterState === "mine" && task.nextActionBy !== "me") return false;
    if (filterState === "delegated" && !task.isDelegated) return false;
    if (filterState === "waiting" && !task.isWaiting) return false;
    if (filterState === "review" && task.status !== "review") return false;
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterDeadline === "today" && !task.isToday && task.deadline !== "Today") return false;
    if (filterDeadline === "this-week" && !task.isToday && !hasCurrentMonthTarget(task)) return false;
    if (filterDeadline === "overdue" && !task.isOverdue) return false;
    if (filterDeadline === "no-date" && task.deadline) return false;
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
  const carriedTasks = TASKS.filter(task => isActive(task) && task.carriedOver);
  const longStaleTasks = carriedTasks.filter(task => (task.staleDays || 0) > 30);
  const activeFilterCount = Number(Boolean(filterOrg)) + Number(Boolean(filterArea)) + Number(Boolean(filterProject)) + Number(Boolean(filterAssignee)) + Number(filterState !== "all") + Number(filterPriority !== "all") + Number(filterDeadline !== "all") + Number(hasFilesOnly);
  const clearFilters = () => { setFilterOrg(null); setFilterArea(null); setFilterProject(null); setFilterAssignee(null); setFilterState("all"); setFilterPriority("all"); setFilterDeadline("all"); setHasFilesOnly(false); };
  const scopeTabs: { id: TaskScope; label: string; count: number }[] = [
    { id: "month", label: "This Month", count: TASKS.filter(task => isActive(task) && !task.carriedOver && hasCurrentMonthTarget(task)).length },
    { id: "carried", label: "Carried Over", count: carriedTasks.length },
    { id: "unscheduled", label: "Unscheduled", count: TASKS.filter(task => isActive(task) && !task.deadline).length },
    { id: "done", label: "Done", count: TASKS.filter(task => task.status === "done" && !task.archived && (task.completedInCurrentMonth || hasCurrentMonthTarget(task))).length },
  ];
  const scopeHelp: Record<TaskScope, string> = { month: "Current work with a target this month.", carried: "Unfinished work brought forward from an earlier period.", unscheduled: "Active work without a target date yet.", done: "Completed work from this month." };

  if (showArchive) return <div className="mx-auto w-full max-w-4xl p-5 sm:p-8 lg:p-10"><button onClick={() => setShowArchive(false)} className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" />Back to Tasks</button><div className="mb-6"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">History</p><h1 className="luma-heading mt-1 text-3xl font-bold text-foreground">Archive</h1><p className="mt-1.5 text-sm text-muted-foreground">Completed work that is safely kept for reference.</p></div><div className="overflow-hidden rounded-[1.35rem] border border-border bg-card">{tasks.length ? tasks.map(task => <TaskWorkspaceRow key={task.id} task={task} archived onClick={() => onTaskClick(task)} />) : <p className="px-5 py-14 text-center text-sm text-muted-foreground">No archived tasks match these filters.</p>}</div></div>;

  return <div className="mx-auto w-full max-w-4xl p-5 sm:p-8 lg:p-10"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="luma-heading text-3xl font-bold text-foreground">Tasks</h1><p className="mt-1.5 text-sm text-muted-foreground">Everything that still needs your attention.</p></div><button onClick={() => setShowArchive(true)} className="w-fit rounded-xl px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Archive</button></div><div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/75 p-1">{scopeTabs.map(tab => <button key={tab.id} onClick={() => setScope(tab.id)} className={cn("rounded-lg px-3 py-2 text-[12px] font-medium transition-colors", scope === tab.id ? "bg-primary/12 text-primary shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{tab.label}<span className="ml-1.5 text-[10px] opacity-65">{tab.count}</span></button>)}</div><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center"><p className="flex-1 text-[11px] text-muted-foreground">{scopeHelp[scope]}</p><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:flex-none"><Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks and archive…" className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}</div><button onClick={() => setShowFilters(current => !current)} className={cn("rounded-xl border px-3 py-2 text-[12px] transition-colors", showFilters ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground")}><span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />{activeFilterCount ? `Filters · ${activeFilterCount}` : "Filters"}</span></button><select value={sortBy} onChange={event => setSortBy(event.target.value as SortBy)} className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground"><option value="deadline">Sort: Target date</option><option value="priority">Sort: Priority</option><option value="org">Sort: Organization</option><option value="updated">Sort: Updated</option></select><button onClick={onNewTask} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"><Plus className="h-3.5 w-3.5" />New Task</button></div></div>{showFilters && <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_24px_rgb(35_41_61_/_0.06)]"><div className="mb-3 flex items-center justify-between"><div><p className="text-[12px] font-semibold text-foreground">Refine your view</p><p className="mt-0.5 text-[10px] text-muted-foreground">Filters stay tucked away until you need them.</p></div>{activeFilterCount > 0 && <button onClick={clearFilters} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">Clear all</button>}</div><div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-[10px] font-medium text-muted-foreground">Organization<select value={filterOrg || ""} onChange={event => setFilterOrg(event.target.value as OrgName || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All organizations</option>{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Area<select value={filterArea || ""} onChange={event => setFilterArea(event.target.value as AreaName || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All areas</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Project<select value={filterProject || ""} onChange={event => setFilterProject(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">All projects</option>{projects.map(project => <option key={project}>{project}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Assignee<select value={filterAssignee || ""} onChange={event => setFilterAssignee(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="">Anyone</option>{assignees.map(assignee => <option key={assignee}>{assignee}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Work state<select value={filterState} onChange={event => setFilterState(event.target.value as TaskStateFilter)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any state</option><option value="mine">Mine</option><option value="delegated">Delegated</option><option value="waiting">Waiting</option><option value="review">Needs review</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Priority<select value={filterPriority} onChange={event => setFilterPriority(event.target.value as Priority | "all")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any priority</option><option value="urgent">Needs attention</option><option value="high">Important</option><option value="medium">Planned</option><option value="low">When there’s room</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Deadline<select value={filterDeadline} onChange={event => setFilterDeadline(event.target.value as TaskDeadlineFilter)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground"><option value="all">Any target date</option><option value="today">Today</option><option value="this-week">This week</option><option value="overdue">Past target</option><option value="no-date">No target date</option></select></label><label className="mt-5 inline-flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={hasFilesOnly} onChange={event => setHasFilesOnly(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />Has files</label></div></div>}{showStaleReview && longStaleTasks.length > 0 && <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-warning/20 bg-warning/[0.07] p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-[13px] font-semibold text-foreground">{longStaleTasks.length} {longStaleTasks.length === 1 ? "task has" : "tasks have"} been carried over for more than 30 days.</p><p className="mt-1 text-[11px] text-muted-foreground">Take a quiet moment to decide what still matters.</p></div><div className="flex gap-2"><button onClick={() => setScope("carried")} className="rounded-xl bg-card px-3 py-2 text-[11px] font-medium text-foreground shadow-sm">Review them</button><button onClick={() => setShowStaleReview(false)} className="rounded-xl px-3 py-2 text-[11px] text-muted-foreground hover:bg-card/50">Not now</button></div></div>}<div className="overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-[0_3px_16px_var(--theme-shadow)]">{tasks.length ? tasks.map(task => <TaskWorkspaceRow key={task.id} task={task} archived={Boolean(task.archived)} onClick={() => onTaskClick(task)} />) : <div className="px-5 py-14 text-center"><ListTodo className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">Nothing to show here right now.</p><p className="mt-1 text-[12px] text-muted-foreground">The rest of your work is safely organized.</p></div>}</div><p className="mt-3 text-[11px] text-muted-foreground">{search ? `${tasks.length} search result${tasks.length === 1 ? "" : "s"} across current work and archive.` : `${tasks.length} task${tasks.length === 1 ? "" : "s"} in this view.`}</p></div>;
}

// ─── PEOPLE / ACCOUNTABILITY VIEW (NEW) ───────────────────────────────────────

type PeopleSort = "followup" | "overdue" | "no-update" | "active" | "name";

function PeopleView({ onPersonClick }: { onPersonClick: (name: string) => void }) {
  const [sort, setSort] = useState<PeopleSort>("followup");

  const owesUpdate = PEOPLE_DATA.filter(p => p.waitingOnThem > 0).length;
  const waitingForMe = PEOPLE_DATA.filter(p => p.waitingOnMe > 0).length;
  const overdueCount = PEOPLE_DATA.reduce((a, p) => a + p.overdue, 0);

  const sorted = [...PEOPLE_DATA].sort((a, b) => {
    if (sort === "followup") return (b.needsFollowUp ? 1 : 0) - (a.needsFollowUp ? 1 : 0);
    if (sort === "overdue") return b.overdue - a.overdue;
    if (sort === "active") return b.active - a.active;
    if (sort === "name") return a.name.localeCompare(b.name);
    // no-update: sort by oldestUnanswered (days)
    return parseInt(b.oldestUnanswered) - parseInt(a.oldestUnanswered);
  });

  const SORT_OPTIONS: { id: PeopleSort; label: string }[] = [
    { id: "followup", label: "Needs Follow-Up" },
    { id: "no-update", label: "Longest Without Update" },
    { id: "overdue", label: "Most Overdue" },
    { id: "active", label: "Most Active" },
    { id: "name", label: "Name" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Accountability</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>People</h1>
      </div>

      {/* Summary alert */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { value: owesUpdate, label: "updates you’re waiting for", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
          { value: waitingForMe, label: "people waiting for you", color: "text-info", bg: "bg-info/10", border: "border-info/20" },
          { value: overdueCount, label: "dates worth revisiting", color: "text-overdue", bg: "bg-overdue/10", border: "border-overdue/20" },
        ].map(({ value, label, color, bg, border }) => (
          <div key={label} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border", bg, border)}>
            <span className={cn("text-2xl font-bold", color)} style={{ fontFamily: "var(--font-display)" }}>{value}</span>
            <span className={cn("text-[12px]", color)}>{label}</span>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-mono text-muted-foreground">Sort by:</span>
        <div className="flex gap-1 flex-wrap">
          {SORT_OPTIONS.map(o => (
            <button key={o.id} onClick={() => setSort(o.id)}
              className={cn("px-2.5 py-1 rounded-full text-[11px] border transition-colors", sort === o.id ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* People cards */}
      <div className="space-y-3">
        {sorted.map(person => {
          const color = getPersonColor(person.name);
          const orgC = ORG_COLORS[person.org];
          return (
            <button key={person.name} onClick={() => onPersonClick(person.name)}
              className="luma-card luma-card-hover group w-full p-5 text-left">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={personColorStyle(color)}>
                  {getInitials(person.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-foreground">{person.name}</h3>
                    {person.needsFollowUp && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400">Follow Up</span>
                    )}
                    {person.overdue > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">{person.overdue} overdue</span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{person.role} · <span className={orgC.text}>{person.org}</span></p>
                </div>
                <div className="hidden flex-shrink-0 grid-cols-4 gap-4 text-center lg:grid">
                  {[
                    { val: person.active, label: "Active", color: "text-foreground" },
                    { val: person.waitingOnThem, label: "On Them", color: "text-amber-400" },
                    { val: person.waitingOnMe, label: "On Me", color: "text-indigo-400" },
                    { val: person.overdue, label: "Overdue", color: person.overdue > 0 ? "text-red-400" : "text-muted-foreground" },
                  ].map(({ val, label, color: c }) => (
                    <div key={label}>
                      <p className={cn("text-lg font-bold", c)} style={{ fontFamily: "var(--font-display)" }}>{val}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="hidden min-w-[120px] flex-shrink-0 text-right xl:block">
                  <p className="text-[11px] text-muted-foreground">Last update: <span className="text-foreground">{person.lastUpdate}</span></p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Oldest unanswered: <span className="text-amber-400/80">{person.oldestUnanswered}</span></p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PERSON DETAIL VIEW (NEW) ─────────────────────────────────────────────────

function PersonDetailView({ personName, onBack, onTaskClick, onFollowUp }: { personName: string; onBack: () => void; onTaskClick: (t: Task) => void; onFollowUp: () => void }) {
  const person = PEOPLE_DATA.find(p => p.name === personName);
  if (!person) return null;
  const color = getPersonColor(person.name);
  const orgC = ORG_COLORS[person.org];

  const personTasks = TASKS.filter(t => t.assignee === personName || t.nextActionBy === personName);
  const groups: { label: string; color: string; tasks: Task[] }[] = [
    { label: "Waiting on Them", color: "bg-info", tasks: personTasks.filter(t => t.nextActionBy === personName && t.status !== "done") },
    { label: "Submitted for My Review", color: "bg-review", tasks: personTasks.filter(t => t.status === "review") },
    { label: "In Progress / Active", color: "bg-primary", tasks: personTasks.filter(t => t.status === "in_progress") },
    { label: "Completed", color: "bg-success", tasks: personTasks.filter(t => t.status === "done") },
  ].filter(g => g.tasks.length > 0);

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <BackButton label="People" onClick={onBack} />

      {/* Person header */}
      <div className="luma-card mb-6 overflow-hidden p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
            style={personColorStyle(color, 2)}>
            {getInitials(person.name)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{person.name}</h1>
            <p className="text-sm text-muted-foreground">{person.role} · <span className={orgC.text}>{person.org}</span></p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] font-mono text-muted-foreground">Last update: <span className="text-foreground">{person.lastUpdate}</span></span>
              <span className="text-[11px] font-mono text-muted-foreground">Oldest unanswered: <span className="text-amber-400">{person.oldestUnanswered}</span></span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onFollowUp} className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />Message
            </button>
            <button onClick={onFollowUp} className="px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-[12px] hover:text-foreground transition-colors flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />Follow Up
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { val: person.active, label: "Active Tasks", color: "text-foreground" },
            { val: person.waitingOnThem, label: "Waiting on Them", color: "text-amber-400" },
            { val: person.waitingOnMe, label: "Waiting on Me", color: "text-indigo-400" },
            { val: person.overdue, label: "Overdue", color: person.overdue > 0 ? "text-red-400" : "text-emerald-400" },
          ].map(({ val, label, color: c }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
              <p className={cn("text-2xl font-bold", c)} style={{ fontFamily: "var(--font-display)" }}>{val}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Task groups */}
      <div className="space-y-5">
        {groups.map(group => (
          <div key={group.label}>
            <SectionHeader label={group.label} count={group.tasks.length} color={group.color} />
            <div className="space-y-2">
              {group.tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />)}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-sm">No tasks found for {person.name}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ORGANIZATION DETAIL VIEW (NEW) ───────────────────────────────────────────

const ORGS_META: { name: OrgName; desc: string; areas: AreaName[] }[] = [
  { name: "Villa Khayangan", desc: "Hospitality & property management", areas: ["System Development", "Operations", "Marketing", "Finance", "HR"] },
  { name: "Apotik", desc: "Pharmacy operations", areas: ["Operations", "Finance", "HR"] },
  { name: "Personal", desc: "Personal projects & finances", areas: ["Finance"] },
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
  const [projectOpen, setProjectOpen] = useState(false);
  const [resourceFormOpen, setResourceFormOpen] = useState(false);
  const [resourceManagerOpen, setResourceManagerOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [orgSettingsOpen, setOrgSettingsOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
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
  const [generatedFollowUp, setGeneratedFollowUp] = useState<string | null>(null);
  const [copiedFollowUp, setCopiedFollowUp] = useState<string | null>(null);
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
    return <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10"><BackButton label="Organizations" onClick={onBack} /><div className="luma-card p-8 text-center"><Building2 className="mx-auto mb-3 h-9 w-9 text-muted-foreground/35" /><h1 className="text-lg font-semibold text-foreground">Organization not found</h1><p className="mt-1 text-sm text-muted-foreground">It may have been archived or moved.</p><button onClick={onBack} className="mt-4 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">Back to organizations</button></div></div>;
  }

  const refreshWorkspace = (notice?: string) => {
    setWorkspaceRevision(current => current + 1);
    if (notice) {
      setMessage(notice);
      window.setTimeout(() => setMessage(""), 2400);
    }
  };
  void workspaceRevision;

  const orgTasks = TASKS.filter(task => task.org === orgName && !task.archived);
  const scopedAreaTasks = selectedArea ? orgTasks.filter(task => task.area === selectedArea) : orgTasks;
  const taskMatchesFilter = (task: Task) => {
    if (taskFilter === "today" && !task.isToday) return false;
    if (taskFilter === "mine" && task.nextActionBy !== "me") return false;
    if (taskFilter === "delegated" && !task.isDelegated) return false;
    if (taskFilter === "waiting" && !task.isWaiting) return false;
    if (taskFilter === "review" && task.status !== "review") return false;
    if (taskFilter === "overdue" && !task.isOverdue) return false;
    if (taskPriority !== "all" && task.priority !== taskPriority) return false;
    if (taskProject && task.project !== taskProject) return false;
    if (dateFilter === "dated" && !task.deadline) return false;
    if (dateFilter === "none" && task.deadline) return false;
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
  const scopedProjects = projects.filter(project => !selectedArea || PROJECT_DETAILS[project.id]?.area === selectedArea);
  const scopedPeople = PEOPLE_DATA.filter(person => person.org === orgName && (!selectedArea || orgTasks.some(task => task.area === selectedArea && (task.assignee === person.name || task.nextActionBy === person.name))));
  const attentionTasks = scopedAreaTasks.filter(task => task.isOverdue || task.status === "review" || (task.isWaiting && task.waitingSince));
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
    Object.assign(task, { assignee: next, nextActionBy: next, isDelegated: true, isWaiting: true, lastUpdate: `Assigned to ${next}` });
    refreshWorkspace(`Assigned to ${next}`);
  }

  function duplicateTask(task: Task) {
    TASKS.push({ ...task, id: `duplicate-${Date.now()}`, title: `Copy of ${task.title}`, status: "todo", isWaiting: false, isOverdue: false, nextActionBy: "me", assignee: undefined, isDelegated: false, lastUpdate: "Just now" });
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
    Object.assign(task, { archived: true, status: "done" as TaskStatus, isWaiting: false, lastUpdate: "Archived just now" });
    refreshWorkspace("Task archived");
  }

  function saveTaskTitle(task: Task) {
    const title = editingTaskTitle.trim();
    if (!title) return;
    Object.assign(task, { title, lastUpdate: "Edited just now" });
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
    TASKS.filter(task => task.org === orgName && task.area === area).forEach(task => { task.area = next; });
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

  function generateFollowUp(person: string) {
    setGeneratedFollowUp(current => current === person ? null : person);
  }

  function copyFollowUp(person: string) {
    const relevant = scopedAreaTasks.filter(task => task.nextActionBy === person && task.isWaiting).slice(0, 4);
    const text = `Hi ${person}, could you share an update on ${relevant.map(task => task.title).join(", ") || "the open items"}? Thank you.`;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedFollowUp(person);
    window.setTimeout(() => setCopiedFollowUp(null), 1800);
  }

  const stats: { label: string; value: number; color: string; filter: OrgTaskFilter }[] = [
    { label: "Today", value: orgTasks.filter(task => task.isToday).length, color: "text-primary", filter: "today" },
    { label: "This Week", value: orgTasks.length, color: "text-foreground", filter: "all" },
    { label: "Dates to revisit", value: orgTasks.filter(task => task.isOverdue).length, color: "text-overdue", filter: "overdue" },
    { label: "Waiting", value: orgTasks.filter(task => task.isWaiting).length, color: "text-info", filter: "waiting" },
    { label: "Delegated", value: orgTasks.filter(task => task.isDelegated).length, color: "text-success", filter: "delegated" },
    { label: "Review", value: orgTasks.filter(task => task.status === "review").length, color: "text-review", filter: "review" },
  ];

  if (loading) {
    return <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10"><BackButton label="Organizations" onClick={onBack} /><div className="animate-pulse space-y-5"><div className="h-20 rounded-2xl bg-muted/70" /><div className="grid grid-cols-3 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 rounded-2xl bg-muted/60" />)}</div><div className="grid gap-6 lg:grid-cols-3"><div className="h-[30rem] rounded-2xl bg-card" /><div className="h-[30rem] rounded-2xl bg-card" /></div></div></div>;
  }

  return (
    <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10">
      <BackButton label="Organizations" onClick={onBack} />
      {message && <div role="status" className="mb-4 rounded-xl border border-success/20 bg-success/10 px-3.5 py-2 text-[12px] font-medium text-success">{message}</div>}
      {archived && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-4"><div><p className="text-[13px] font-semibold text-foreground">This organization is archived.</p><p className="mt-0.5 text-[11px] text-muted-foreground">Its work remains available for reference.</p></div><button onClick={() => { setArchived(false); refreshWorkspace("Organization restored"); }} className="rounded-xl bg-card px-3 py-2 text-[11px] font-medium text-foreground shadow-sm">Restore organization</button></div>}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">{orgIcon === "Building" ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted" style={{ color: accentColor }}><Building2 className="h-3.5 w-3.5" /></span> : orgIcon === "Spark" ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted" style={{ color: accentColor }}><Sparkles className="h-3.5 w-3.5" /></span> : <div className={cn("h-3 w-3 rounded-sm", c.dot)} style={{ backgroundColor: accentColor }} />}<h1 className="luma-heading text-3xl font-bold text-foreground">{orgTitle}</h1>{archived && <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Archived</span>}</div>
          <p className="text-sm text-muted-foreground">{orgDescription}</p>
        </div>
        {!archived && <div className="flex flex-wrap items-center gap-2"><button onClick={() => setCaptureOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20"><Plus className="h-3.5 w-3.5" />Quick Capture</button><button onClick={() => setProjectOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"><FolderKanban className="h-3.5 w-3.5" />Add Project</button><div className="relative"><button onClick={() => setOverflowOpen(current => !current)} aria-label="Organization options" aria-expanded={overflowOpen} className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>{overflowOpen && <div className="absolute right-0 top-[calc(100%+0.4rem)] z-30 w-48 rounded-xl border border-border bg-popover p-1.5 shadow-[0_10px_28px_rgb(35_41_61_/_0.12)]">{[{ label: "Edit Organization", action: () => setOrgSettingsOpen(true) }, { label: "Manage Areas", action: () => setAreasOpen(true) }, { label: "Manage Resources", action: () => setResourceManagerOpen(true) }, { label: "Organization Settings", action: () => setOrgSettingsOpen(true) }, { label: "Archive Organization", action: () => setArchiveConfirmOpen(true), destructive: true }].map(item => <button key={item.label} onClick={() => { setOverflowOpen(false); item.action(); }} className={cn("w-full rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-muted", item.destructive ? "text-overdue" : "text-foreground")}>{item.label}</button>)}</div>}</div></div>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{stats.map(stat => <button key={stat.label} onClick={() => { setSelectedArea(null); setTaskFilter(stat.filter); }} className={cn("luma-card luma-card-hover p-4 text-center", taskFilter === stat.filter && "border-primary/30 bg-secondary/45")}><p className={cn("luma-heading text-2xl font-bold", stat.color)}>{stat.value}</p><p className="mt-1 text-[10px] font-medium text-muted-foreground">{stat.label}</p></button>)}</div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Areas</p><button onClick={() => setAreasOpen(true)} className="text-[11px] font-medium text-primary hover:text-primary/80">Manage Areas</button></div><div className="flex flex-wrap gap-2"><button onClick={() => setSelectedArea(null)} className={cn("rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors", !selectedArea ? cn(c.border, c.bg, c.text) : "border-border bg-card text-muted-foreground hover:text-foreground")}>All <span className="ml-1 text-[10px] opacity-65">{orgTasks.length}</span></button>{areas.map(area => <button key={area} onClick={() => setSelectedArea(current => current === area ? null : area)} className={cn("rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors", selectedArea === area ? "border-primary/25 bg-secondary text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{area} <span className="ml-1 text-[10px] opacity-65">{orgTasks.filter(task => task.area === area).length}</span></button>)}</div></section>

          <section><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center"><p className="flex-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{selectedArea || "All Work"} · {filteredTasks.length}</p><div className="flex flex-wrap gap-2"><div className="flex min-w-[11rem] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="Search work" className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground" />{taskSearch && <button onClick={() => setTaskSearch("")} aria-label="Clear search"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}</div><button onClick={() => setTaskFilterOpen(current => !current)} className={cn("rounded-xl border px-3 py-2 text-[11px] font-medium transition-colors", taskFilterOpen ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}><SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />{activeFilterCount ? `Filters · ${activeFilterCount}` : "Filter"}</button><select value={taskSort} onChange={event => setTaskSort(event.target.value as OrgTaskSort)} className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><option value="deadline">Sort: target date</option><option value="priority">Sort: priority</option><option value="title">Sort: title</option><option value="updated">Sort: updated</option></select></div></div>{taskFilterOpen && <div className="mb-3 grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2"><label className="text-[10px] font-medium text-muted-foreground">Work state<select value={taskFilter} onChange={event => setTaskFilter(event.target.value as OrgTaskFilter)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="all">All work</option><option value="mine">Mine</option><option value="delegated">Delegated</option><option value="waiting">Waiting</option><option value="review">Needs review</option><option value="overdue">Overdue</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Priority<select value={taskPriority} onChange={event => setTaskPriority(event.target.value as Priority | "all")} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="all">Any priority</option><option value="urgent">Needs attention</option><option value="high">Important</option><option value="medium">Planned</option><option value="low">When there’s room</option></select></label><label className="text-[10px] font-medium text-muted-foreground">Project<select value={taskProject} onChange={event => setTaskProject(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="">All projects</option>{projectNames.map(name => <option key={name}>{name}</option>)}</select></label><label className="text-[10px] font-medium text-muted-foreground">Date<select value={dateFilter} onChange={event => setDateFilter(event.target.value as "all" | "dated" | "none")} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] text-foreground"><option value="all">Any date</option><option value="dated">Has target date</option><option value="none">No target date</option></select></label><button onClick={() => { setTaskFilter("all"); setTaskPriority("all"); setTaskProject(""); setDateFilter("all"); }} className="w-fit text-[11px] font-medium text-muted-foreground hover:text-foreground">Clear filters</button></div>}<div className="luma-card overflow-visible">{visibleTasks.map(task => <div key={task.id} className="group relative border-b border-border/70 last:border-b-0"><div className="flex items-center gap-3 px-4 py-3"><button onClick={() => onTaskClick(task)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><PriorityDot priority={task.priority} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{task.title}</span><span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground"><AreaBadge area={task.area} />{task.project && <span>· {task.project}</span>}<span>· {task.nextActionBy === "me" ? "Next: me" : `Waiting on ${task.nextActionBy}`}</span></span></span></button><span className={cn("hidden text-[10px] font-medium sm:inline", task.isOverdue ? "text-overdue" : "text-muted-foreground")}>{task.deadline || "No date"}</span><div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button onClick={() => completeTask(task)} aria-label={`Complete ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-success/10 hover:text-success"><Check className="h-3.5 w-3.5" /></button><button onClick={() => { setEditingTaskId(task.id); setEditingTaskTitle(task.title); }} aria-label={`Edit ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">Edit</button><button onClick={() => reassignTask(task)} aria-label={`Delegate ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Users className="h-3.5 w-3.5" /></button><button onClick={() => rescheduleTask(task)} aria-label={`Reschedule ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Calendar className="h-3.5 w-3.5" /></button><button onClick={() => setQuickMenuTaskId(current => current === task.id ? null : task.id)} aria-label={`More actions for ${task.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button></div></div>{editingTaskId === task.id && <div className="flex gap-2 border-t border-border bg-muted/25 px-4 py-2"><input autoFocus value={editingTaskTitle} onChange={event => setEditingTaskTitle(event.target.value)} onKeyDown={event => event.key === "Enter" && saveTaskTitle(task)} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground" /><button onClick={() => saveTaskTitle(task)} className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">Save</button><button onClick={() => setEditingTaskId(null)} className="rounded-lg px-2 text-[11px] text-muted-foreground">Cancel</button></div>}{quickMenuTaskId === task.id && <div className="absolute right-3 top-11 z-20 w-40 rounded-xl border border-border bg-popover p-1.5 shadow-[0_10px_24px_rgb(35_41_61_/_0.12)]"><button onClick={() => onTaskClick(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Open Detail</button><button onClick={() => duplicateTask(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Duplicate</button><button onClick={() => moveTaskToProject(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Move to Project</button><button onClick={() => moveTaskToNextArea(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-foreground hover:bg-muted">Change Area</button><button onClick={() => archiveTask(task)} className="w-full rounded-lg px-2.5 py-2 text-left text-[11px] text-overdue hover:bg-overdue/10">Archive / Cancel</button></div>}</div>)}{filteredTasks.length === 0 && <div className="px-5 py-12 text-center"><ListTodo className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No work matches these filters.</p><p className="mt-1 text-[11px] text-muted-foreground">Try a different area or clear a filter.</p></div>}{filteredTasks.length > 8 && <button onClick={() => setShowAllWork(current => !current)} className="w-full border-t border-border px-4 py-3 text-center text-[11px] font-medium text-primary transition-colors hover:bg-primary/[0.025]">{showAllWork ? "Show less" : "View all work →"}</button>}</div></section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">People with Open Work</p>{scopedPeople.length > 0 && <span className="text-[10px] text-muted-foreground">{scopedPeople.length} people</span>}</div>{scopedPeople.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{scopedPeople.map(person => { const personTasks = scopedAreaTasks.filter(task => task.assignee === person.name || task.nextActionBy === person.name); const followUpTasks = personTasks.filter(task => task.isWaiting && task.nextActionBy === person.name); const color = getPersonColor(person.name); return <div key={person.name} className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/25"><button onClick={() => onPersonClick(person.name)} className="flex w-full items-center gap-2.5 text-left"><div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold" style={personColorStyle(color)}>{getInitials(person.name)}</div><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-foreground">{person.name}</span><span className="block text-[10px] text-muted-foreground">{person.active} active · {person.waitingOnThem} waiting · Updated {person.lastUpdate}</span></span>{person.overdue > 0 && <span className="text-[10px] font-medium text-overdue">{person.overdue} overdue</span>}</button>{followUpTasks.length > 1 && <div className="mt-2 flex items-center justify-between border-t border-border pt-2"><span className="text-[10px] text-muted-foreground">{followUpTasks.length} items waiting</span><button onClick={() => generateFollowUp(person.name)} className="text-[10px] font-medium text-primary hover:text-primary/80">Generate Follow-Up</button></div>}{generatedFollowUp === person.name && <div className="mt-2 rounded-lg bg-primary/[0.05] p-2.5"><p className="text-[10px] leading-4 text-muted-foreground">Binnie will combine the {followUpTasks.length} waiting items into one calm update request.</p><div className="mt-2 flex gap-2"><button onClick={() => copyFollowUp(person.name)} className="rounded-lg bg-card px-2 py-1 text-[10px] font-medium text-foreground shadow-sm">{copiedFollowUp === person.name ? "Copied" : "Copy message"}</button><button onClick={() => onNavigate("followup")} className="text-[10px] font-medium text-primary">Open Follow Up</button></div></div>}</div>; })}</div> : <div className="luma-card px-5 py-10 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No delegated work in this organization.</p></div>}</section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Recent Activity</p><button onClick={() => setShowActivity(current => !current)} className="text-[11px] font-medium text-primary hover:text-primary/80">{showActivity ? "Show less" : "View Activity"}</button></div>{activityEntries.length ? <div className="luma-card divide-y divide-border/70">{activityEntries.map(entry => <button key={entry.key} onClick={() => entry.task ? onTaskClick(entry.task) : entry.project ? onProjectClick(entry.project.id) : undefined} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/45"><div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /><span className="min-w-0 flex-1"><span className="block text-[12px] text-foreground">{entry.text}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{entry.actor} · {entry.time}</span></span><ChevronRight className="mt-1 h-3.5 w-3.5 text-muted-foreground" /></button>)}</div> : <div className="luma-card px-5 py-10 text-center"><p className="text-sm font-medium text-foreground">No recent activity yet.</p><p className="mt-1 text-[11px] text-muted-foreground">Updates will appear here as work moves.</p></div>}</section>
        </div>

        <div className="space-y-6">
          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Current Projects</p><button onClick={() => setProjectOpen(true)} className="text-[11px] font-medium text-primary hover:text-primary/80">+ Add Project</button></div>{scopedProjects.length ? <div className="space-y-2">{scopedProjects.map(project => { const detail = PROJECT_DETAILS[project.id]; const remaining = Math.max(project.tasks - project.done, 0); return <button key={project.id} onClick={() => onProjectClick(project.id)} className="luma-card luma-card-hover w-full p-4 text-left"><div className="mb-2 flex items-start gap-3"><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-foreground">{project.name}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{detail?.currentFocus[0] || "Set a focused next step"}</span></span>{project.status === "at_risk" && <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning">Needs attention</span>}</div><div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", c.dot)} style={{ width: `${project.progress}%` }} /></div><div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{project.progress}% · {remaining} remaining</span><span>Target: {project.deadline}</span></div></button>; })}</div> : <div className="luma-card px-5 py-10 text-center"><FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">No active projects yet.</p><p className="mt-1 text-[11px] text-muted-foreground">Create one when a piece of work needs its own focus.</p></div>}</section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Resources</p><button onClick={() => openResourceForm()} className="text-[11px] font-medium text-primary hover:text-primary/80">+ Add Resource</button></div>{resources.length ? <div className="space-y-1.5">{resources.map((resource, index) => <div key={`${resource.label}-${index}`} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"><LinkIcon type={resource.type} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-foreground">{resource.label}</span>{(resource.area || resource.project) && <span className="block truncate text-[10px] text-muted-foreground">{resource.project || resource.area}</span>}</span>{resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10">Open ↗</a> : <button onClick={() => openResourceForm(index)} className="rounded-lg px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10">Add link</button>}</div>)}</div> : <div className="luma-card px-5 py-10 text-center"><Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">Keep important links close.</p><p className="mt-1 text-[11px] text-muted-foreground">Add your Drive, website, dashboards, or project tools here.</p></div>}</section>

          <section><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-warning">Needs Attention</p><span className="text-[10px] text-muted-foreground">{attentionTasks.length} items</span></div>{attentionTasks.length ? <div className="space-y-1.5">{attentionTasks.slice(0, 4).map(task => { const isReview = task.status === "review"; const reason = isReview ? "Needs Review" : task.isOverdue ? "Overdue" : `No update from ${task.nextActionBy} for ${task.waitingSince || "a while"}`; return <div key={task.id} className="rounded-xl border border-warning/15 bg-warning/[0.04] p-3"><p className="truncate text-[12px] font-medium text-foreground">{task.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{reason}</p><div className="mt-2 flex gap-2"><button onClick={() => onTaskClick(task)} className="rounded-lg bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground shadow-sm">{isReview ? "Review" : "Open"}</button>{!isReview && task.isWaiting && <button onClick={() => onNavigate("followup")} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-primary">Follow Up</button>}</div></div>; })}</div> : <div className="luma-card px-5 py-10 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success/45" /><p className="text-sm font-medium text-foreground">Nothing needs attention right now.</p></div>}</section>
        </div>
      </div>

      {captureOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-border bg-background p-4 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)] sm:p-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-[12px] font-semibold text-foreground">Quick Capture for {orgTitle}</p><p className="text-[10px] text-muted-foreground">This organization is already selected.</p></div><button onClick={() => setCaptureOpen(false)} aria-label="Close quick capture" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><QuickCapture organization={orgName} onSaved={() => refreshWorkspace("Saved to this organization")} /></div></div>}

      {projectOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Add project" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="luma-heading text-xl font-bold text-foreground">Add Project</h2><p className="mt-1 text-[11px] text-muted-foreground">{orgTitle} is already selected.</p></div><button onClick={() => setProjectOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Project name<input autoFocus value={projectDraft.name} onChange={event => setProjectDraft(current => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Organization<input value={orgTitle} disabled className="mt-1.5 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] text-muted-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Area<select value={projectDraft.area} onChange={event => setProjectDraft(current => ({ ...current, area: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground">{areas.map(area => <option key={area}>{area}</option>)}</select></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Description <span className="font-normal">(optional)</span><textarea value={projectDraft.description} onChange={event => setProjectDraft(current => ({ ...current, description: event.target.value }))} className="mt-1.5 min-h-16 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Target date <span className="font-normal">(optional)</span><input value={projectDraft.target} onChange={event => setProjectDraft(current => ({ ...current, target: event.target.value }))} placeholder="September" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Owner<input value={projectDraft.owner} onChange={event => setProjectDraft(current => ({ ...current, owner: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Current focus <span className="font-normal">(optional)</span><input value={projectDraft.focus} onChange={event => setProjectDraft(current => ({ ...current, focus: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label></div>{projectError && <p className="mt-3 text-[11px] text-overdue">{projectError}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setProjectOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={createProject} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Create Project</button></div></div></div>}

      {resourceManagerOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Manage resources" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-center justify-between"><div><h2 className="luma-heading text-xl font-bold text-foreground">Manage Resources</h2><p className="mt-1 text-[11px] text-muted-foreground">Keep the tools for {orgTitle} close.</p></div><button onClick={() => setResourceManagerOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="max-h-64 space-y-2 overflow-y-auto">{resources.length ? resources.map((resource, index) => <div key={`${resource.label}-${index}`} className="flex items-center gap-2 rounded-xl border border-border p-3"><LinkIcon type={resource.type} /><span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{resource.label}</span><button onClick={() => openResourceForm(index)} className="text-[11px] font-medium text-primary">Edit</button></div>) : <p className="rounded-xl bg-muted/45 px-3 py-6 text-center text-[11px] text-muted-foreground">No resources yet.</p>}</div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setResourceManagerOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Close</button><button onClick={() => openResourceForm()} className="rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">+ Add Resource</button></div></div></div>}

      {resourceFormOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Add resource" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="luma-heading text-xl font-bold text-foreground">{editingResourceIndex === null ? "Add Resource" : "Edit Resource"}</h2><p className="mt-1 text-[11px] text-muted-foreground">Binnie will recognize common links automatically.</p></div><button onClick={() => setResourceFormOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Resource name<input autoFocus value={resourceDraft.label} onChange={event => setResourceDraft(current => ({ ...current, label: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Type<select value={resourceDraft.type} onChange={event => setResourceDraft(current => ({ ...current, type: event.target.value as ResourceType }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground">{["website", "drive", "sheet", "doc", "figma", "github", "dashboard", "notion", "other"].map(type => <option key={type} value={type}>{type === "drive" ? "Google Drive" : type === "sheet" ? "Google Sheet" : type === "doc" ? "Google Doc" : type[0].toUpperCase() + type.slice(1)}</option>)}</select></label><label className="text-[11px] font-medium text-muted-foreground">Related area <span className="font-normal">(optional)</span><select value={resourceDraft.area} onChange={event => setResourceDraft(current => ({ ...current, area: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option value="">No area</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">URL <span className="font-normal">(optional)</span><input value={resourceDraft.url} onChange={event => setResourceDraft(current => ({ ...current, url: event.target.value }))} placeholder="https://" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Related project <span className="font-normal">(optional)</span><select value={resourceDraft.project} onChange={event => setResourceDraft(current => ({ ...current, project: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option value="">No project</option>{projectNames.map(project => <option key={project}>{project}</option>)}</select></label><label className="text-[11px] font-medium text-muted-foreground">Description <span className="font-normal">(optional)</span><input value={resourceDraft.description} onChange={event => setResourceDraft(current => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label></div>{resourceError && <p className="mt-3 text-[11px] text-overdue">{resourceError}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setResourceFormOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={saveResource} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Save</button></div></div></div>}

      {areasOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Manage areas" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="luma-heading text-xl font-bold text-foreground">Manage Areas</h2><p className="mt-1 text-[11px] text-muted-foreground">Group work in the way that makes sense for this organization.</p></div><button onClick={() => setAreasOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="space-y-2">{areas.map((area, index) => <div key={area} className="flex items-center gap-2 rounded-xl border border-border p-3"><span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{area}</span><button onClick={() => moveArea(area, -1)} disabled={index === 0} aria-label={`Move ${area} up`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button><button onClick={() => moveArea(area, 1)} disabled={index === areas.length - 1} aria-label={`Move ${area} down`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button><button onClick={() => renameArea(area)} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10">Rename</button><button onClick={() => hideArea(area)} className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-overdue hover:bg-overdue/10">Hide</button></div>)}</div><div className="mt-4 flex gap-2 border-t border-border pt-4"><input value={newArea} onChange={event => setNewArea(event.target.value)} onKeyDown={event => event.key === "Enter" && addArea()} placeholder="New area" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground" /><button onClick={addArea} className="rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">Add Area</button></div></div></div>}

      {orgSettingsOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Organization settings" className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><div className="mb-4 flex items-start justify-between"><div><h2 className="luma-heading text-xl font-bold text-foreground">Organization Settings</h2><p className="mt-1 text-[11px] text-muted-foreground">Keep the workspace details up to date.</p></div><button onClick={() => setOrgSettingsOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Organization name<input value={orgTitle} onChange={event => setOrgTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="sm:col-span-2 text-[11px] font-medium text-muted-foreground">Description<input value={orgDescription} onChange={event => setOrgDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground" /></label><label className="text-[11px] font-medium text-muted-foreground">Organization color<select value={orgAccent} onChange={event => setOrgAccent(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option>Slate blue</option><option>Dusty sage</option><option>Warm stone</option></select></label><label className="text-[11px] font-medium text-muted-foreground">Icon<select value={orgIcon} onChange={event => setOrgIcon(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option>Rounded marker</option><option>Building</option><option>Spark</option></select></label><label className="text-[11px] font-medium text-muted-foreground">Default timezone<select value={defaultTimezone} onChange={event => setDefaultTimezone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground"><option>Asia/Jakarta</option><option>Asia/Singapore</option><option>Europe/London</option><option>America/New_York</option></select></label><label className="text-[11px] font-medium text-muted-foreground">Default task area<select value={defaultArea} onChange={event => setDefaultArea(event.target.value as AreaName)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[12px] text-foreground">{areas.map(area => <option key={area}>{area}</option>)}</select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setOrgSettingsOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={() => { setOrgSettingsOpen(false); refreshWorkspace("Organization updated"); }} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground">Save changes</button></div></div></div>}

      {archiveConfirmOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-[1px] sm:items-center"><div role="dialog" aria-modal="true" aria-label="Archive organization" className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_20px_60px_rgb(35_41_61_/_0.16)]"><h2 className="luma-heading text-xl font-bold text-foreground">Archive {orgTitle}?</h2><p className="mt-2 text-[12px] leading-5 text-muted-foreground">The work will stay available for reference, but this organization will no longer appear as active.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setArchiveConfirmOpen(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button><button onClick={() => { setArchiveConfirmOpen(false); setArchived(true); refreshWorkspace("Organization archived"); }} className="rounded-xl bg-overdue px-4 py-2 text-[12px] font-medium text-white">Archive Organization</button></div></div></div>}
    </div>
  );
}

// ─── PROJECT DETAIL VIEW (NEW) ────────────────────────────────────────────────

type ProjectTab = "active" | "mine" | "delegated" | "waiting" | "review" | "completed";

function ProjectDetailView({ projectId, onBack, onTaskClick }: { projectId: string; onBack: () => void; onTaskClick: (t: Task) => void }) {
  const [tab, setTab] = useState<ProjectTab>("active");
  const detail = PROJECT_DETAILS[projectId];
  const basicProj = STRATEGIC_PROJECTS.find(p => p.id === projectId);
  if (!detail || !basicProj) {
    return <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10"><BackButton label="Projects" onClick={onBack} /><div className="luma-card p-8 text-center"><FolderKanban className="mx-auto mb-3 h-9 w-9 text-muted-foreground/35" /><h1 className="text-lg font-semibold text-foreground">Project not found</h1><p className="mt-1 text-sm text-muted-foreground">It may have been archived or moved.</p><button onClick={onBack} className="mt-4 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">Back to projects</button></div></div>;
  }

  const c = ORG_COLORS[detail.org];
  const projTasks = TASKS.filter(t => t.project === detail.name);

  const tabTasks: Record<ProjectTab, Task[]> = {
    active: projTasks.filter(t => t.status !== "done"),
    mine: projTasks.filter(t => t.nextActionBy === "me"),
    delegated: projTasks.filter(t => t.isDelegated),
    waiting: projTasks.filter(t => t.isWaiting),
    review: projTasks.filter(t => t.status === "review"),
    completed: projTasks.filter(t => t.status === "done"),
  };

  const tabs: { id: ProjectTab; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "mine", label: "My Tasks" },
    { id: "delegated", label: "Delegated" },
    { id: "waiting", label: "Waiting" },
    { id: "review", label: "Needs Review" },
    { id: "completed", label: "Completed" },
  ];

  const statusConfig = {
    on_track: { label: "On Track", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    at_risk: { label: "At Risk", color: "text-orange-400", bg: "bg-orange-400/10" },
    behind: { label: "Behind", color: "text-red-400", bg: "bg-red-400/10" },
  };
  const sc = statusConfig[detail.status];

  return (
    <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10">
      <BackButton label="Projects" onClick={onBack} />

      {/* Hero */}
      <div className="luma-card mb-6 p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <OrgBadge org={detail.org} />
              <AreaBadge area={detail.area} />
            </div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{detail.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-[11px] font-mono px-2 py-0.5 rounded", sc.bg, sc.color)}>{sc.label}</span>
              <span className="text-[11px] font-mono text-muted-foreground">Due {detail.deadline}</span>
            </div>
          </div>
          <div className="text-right">
            <p className={cn("text-4xl font-bold", c.text)} style={{ fontFamily: "var(--font-display)" }}>{detail.progress}%</p>
            <p className="text-[11px] font-mono text-muted-foreground">complete</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
          <div className={cn("h-full rounded-full transition-all", c.dot)} style={{ width: `${detail.progress}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Total Tasks", value: detail.tasks },
            { label: "Done", value: detail.done, color: "text-emerald-400" },
            { label: "Active", value: tabTasks.active.length, color: "text-indigo-400" },
            { label: "Waiting", value: tabTasks.waiting.length, color: "text-amber-400" },
            { label: "Delegated", value: tabTasks.delegated.length, color: "text-sky-400" },
          ].map(({ label, value, color }, index) => (
            <div key={label} className={cn("rounded-xl p-3 text-center", ["bg-[#eae6ff]/55", "bg-[#dcede7]/55", "bg-[#ddebfa]/55", "bg-[#f5e7b8]/45", "bg-[#f8e3d3]/50"][index])}>
              <p className={cn("text-xl font-bold", color || "text-foreground")} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Current Focus + Tasks */}
        <div className="space-y-5 lg:col-span-2">
          {/* Current Focus */}
          <div className="luma-card bg-[#fffdfb] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Current Focus</h2>
            </div>
            <div className="space-y-2">
              {detail.currentFocus.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-primary/10 bg-[#eae6ff]/45 p-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">{i + 1}</div>
                  <p className="text-[13px] text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Task tabs */}
          <div>
            <div className="flex gap-1 mb-3 p-1 bg-muted/20 rounded-lg border border-border">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn("flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all", tab === t.id ? "bg-card text-foreground border border-border shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {t.label}
                  {tabTasks[t.id].length > 0 && (
                    <span className={cn("ml-1 text-[10px]", tab === t.id ? "text-primary" : "text-muted-foreground/60")}>{tabTasks[t.id].length}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="luma-card space-y-2 overflow-hidden bg-[#fffdfb] p-3">
              {tabTasks[tab].length === 0
                ? <div className="py-8 text-center text-muted-foreground text-sm">No tasks in this view.</div>
                : tabTasks[tab].map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} compact />)}
            </div>
          </div>
        </div>

        {/* Right: Resources + Activity */}
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Resources</p>
            <div className="space-y-1.5">
              {detail.resources.map((r, i) => r.url === "#" ? <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"><LinkIcon type={r.type} /><span className="flex-1 text-[13px] text-foreground">{r.label}</span><span className="text-[10px] text-muted-foreground">Not connected</span></div> : <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/25 hover:bg-primary/[0.025]"><LinkIcon type={r.type} /><span className="flex-1 text-[13px] text-foreground">{r.label}</span><ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground" /></a>)}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</p>
            <div className="space-y-3">
              {detail.recentActivity.map((act, i) => {
                const actorColor = getPersonColor(act.actor);
                return (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={personColorStyle(actorColor)}>
                      {getInitials(act.actor)}
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground leading-snug">{act.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{act.actor} · {act.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
            <div key={fp.person} className="luma-card overflow-hidden">
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
          <h1 className="luma-heading text-3xl font-bold text-foreground">Organizations</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Your workspaces, all in one place.</p>
        </div>
        <button onClick={() => { setIsAdding(current => !current); setFormMessage(""); }} className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"><Plus className="h-3.5 w-3.5" /> Add Organization</button>
      </div>
      {isAdding && <div className="luma-card mb-5 grid gap-3 bg-[#fdfcff] p-4 sm:grid-cols-[1fr_1.4fr_auto]"><input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === "Enter" && addOrganization()} placeholder="Workspace name" className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /><input value={description} onChange={event => setDescription(event.target.value)} onKeyDown={event => event.key === "Enter" && addOrganization()} placeholder="Short description (optional)" className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /><div className="flex gap-2"><button onClick={addOrganization} className="rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground">Create</button><button onClick={() => setIsAdding(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button></div>{formMessage && <p className="sm:col-span-3 text-[11px] text-overdue">{formMessage}</p>}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ORGS_META.map(org => {
          const c = ORG_COLORS[org.name];
          const orgTasks = TASKS.filter(t => t.org === org.name);
          const activeTasks = orgTasks.filter(task => task.status !== "done");
          const orgProjects = STRATEGIC_PROJECTS.filter(project => project.org === org.name);
          const waiting = activeTasks.filter(task => task.isWaiting).length;
          const attention = activeTasks.filter(task => task.isOverdue || task.status === "review").length;
          const visibleAreas = org.areas.slice(0, 3);
          const currentFocus = orgProjects.slice(0, 2).map(project => project.name).join(" · ") || activeTasks[0]?.title || "A quieter personal workspace.";
          return (
            <button key={org.name} onClick={() => onOrgClick(org.name)}
              className={cn("luma-card luma-card-hover group relative flex h-full min-h-[19.5rem] overflow-hidden p-5 text-left", c.card)}>
              <div aria-hidden="true" className={cn("absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl", c.bg)} />
              <div className="relative flex h-full w-full flex-col">
                <div className="mb-4 grid min-h-[4.5rem] grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-start gap-x-3">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", c.bg, c.text)}><Building2 className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex h-5 items-center gap-2">
                      <h2 className="luma-heading min-w-0 flex-1 truncate text-[16px] font-bold leading-5 text-foreground">{org.name}</h2>
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
    return detail?.status === "at_risk" || projectTasks.some(task => task.isOverdue || task.isWaiting || task.status === "review");
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
      <button key={project.id} onClick={() => onProjectClick(project.id)} className={cn("luma-card luma-card-hover group relative flex h-full min-h-[21.25rem] overflow-hidden p-4 text-left sm:p-5", c.card)}>
        <div aria-hidden="true" className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-45 blur-2xl", c.bg)} />
        <div className="relative flex h-full w-full flex-col">
          <div className="mb-4 grid min-h-[4.25rem] grid-cols-[2.25rem_minmax(0,1fr)_1rem] items-start gap-x-3">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", c.bg, c.text)}><FolderKanban className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="flex h-5 items-center gap-2"><h2 className="luma-heading min-w-0 flex-1 truncate text-[15px] font-bold leading-5 text-foreground">{project.name}</h2>{attention && <span className="flex-shrink-0 rounded-full bg-warning/12 px-2 py-1 text-[10px] font-medium text-warning">Needs attention</span>}</div>
              <div className="mt-2 flex min-h-5 items-center gap-1.5 overflow-hidden"><OrgBadge org={project.org} />{detail && <AreaBadge area={detail.area} />}</div>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <div className="mb-3 flex items-end gap-3">
            <p className={cn("luma-heading text-2xl font-bold", c.text)}>{project.progress}%</p>
            <div className="min-w-0 flex-1 pb-1"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", c.dot)} style={{ width: `${project.progress}%` }} /></div></div>
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
        <div><h1 className="luma-heading text-3xl font-bold text-foreground">Projects</h1><p className="mt-1.5 text-sm text-muted-foreground">Keep important work moving.</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-1"><button onClick={() => setViewMode("grid")} aria-label="Project grid" aria-pressed={viewMode === "grid"} className={cn("rounded-lg p-1.5 transition-colors", viewMode === "grid" ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Layers className="h-3.5 w-3.5" /></button><button onClick={() => setViewMode("list")} aria-label="Project list" aria-pressed={viewMode === "list"} className={cn("rounded-lg p-1.5 transition-colors", viewMode === "list" ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><ListTodo className="h-3.5 w-3.5" /></button></div><button onClick={() => { setIsAdding(current => !current); setFormMessage(""); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"><Plus className="h-3.5 w-3.5" /> Add Project</button></div>
      </div>
      {isAdding && <div className="luma-card mb-5 grid gap-3 bg-[#fdfcff] p-4 sm:grid-cols-[1.4fr_1fr_auto]"><input autoFocus value={projectName} onChange={event => setProjectName(event.target.value)} onKeyDown={event => event.key === "Enter" && addProject()} placeholder="Project name" className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground" /><select value={projectOrg} onChange={event => setProjectOrg(event.target.value as OrgName)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground">{ORGS_META.map(org => <option key={org.name}>{org.name}</option>)}</select><div className="flex gap-2"><button onClick={addProject} className="rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-medium text-primary-foreground">Create</button><button onClick={() => setIsAdding(false)} className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted">Cancel</button></div>{formMessage && <p className="sm:col-span-3 text-[11px] text-overdue">{formMessage}</p>}</div>}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {[
          { id: "all" as const, label: "All", count: STRATEGIC_PROJECTS.length },
          { id: "active" as const, label: "Active", count: activeProjects.length },
          { id: "attention" as const, label: "Needs Attention", count: attentionProjects.length },
          { id: "completed" as const, label: "Completed", count: completedProjects.length },
        ].map(item => <button key={item.id} onClick={() => setFilter(item.id)} className={cn("rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors", filter === item.id ? "border-primary/25 bg-secondary text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground")}>{item.label}<span className="ml-1.5 opacity-65">{item.count}</span></button>)}
      </div>
      {filter === "all" ? <>{renderProjectGroup("Needs Attention", attentionProjects, "bg-warning")}{renderProjectGroup("Active Projects", activeProjects, "bg-primary")}</> : visibleProjects.length > 0 ? <div className={projectGridClass}>{visibleProjects.map(renderProjectCard)}</div> : <div className="luma-card py-14 text-center"><CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-success/50" /><p className="text-sm font-medium text-foreground">Nothing to show here right now.</p><p className="mt-1 text-[12px] text-muted-foreground">The rest of your work is safely organized.</p></div>}
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
        (t.assignee || "").toLowerCase().includes(query.toLowerCase())
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

const SIDEBAR_COLLAPSED_STORAGE_KEY = "luma-sidebar-collapsed";
const WORKSPACE_THEME_STORAGE_KEY = "luma-workspace-theme";

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
      { id: "people" as NavView, label: "People", icon: <UserCheck className="w-4 h-4" />, badge: PEOPLE_DATA.filter(p => p.needsFollowUp).length },
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
      <Image src="/binnie-brandmark.svg" alt="Binnie" width={44} height={44} priority className="h-10 w-10 flex-shrink-0" />
      {!compact && <div><p className="luma-heading text-[17px] font-bold lowercase text-foreground">binnie</p><p className="-mt-0.5 text-[10px] text-muted-foreground">Less to remember. More room to think.</p></div>}
    </div>
  );
}

const WORKSPACE_THEME_OPTIONS: { id: WorkspaceTheme; label: string; description: string; preview: string }[] = [
  { id: "soft", label: "Soft", description: "Warm, pastel, and airy.", preview: "luma-theme-preview-soft" },
  { id: "grounded", label: "Grounded", description: "Neutral, cool, and quiet.", preview: "luma-theme-preview-grounded" },
  { id: "dark", label: "Dark", description: "Low-light, calm, and premium.", preview: "luma-theme-preview-dark" },
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
        <div className="flex items-start justify-between border-b border-border px-5 py-5 sm:px-6"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Your account</p><h2 className="luma-heading mt-1 text-xl font-bold text-foreground">Profile & preferences</h2></div><button onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button></div>
        <div className="border-b border-border px-5 py-3 sm:px-6"><div className="flex gap-1 rounded-xl bg-muted/50 p-1">{[{ id: "profile" as const, label: "Profile" }, { id: "preferences" as const, label: "Preferences" }, { id: "settings" as const, label: "Settings" }].map(item => <button key={item.id} onClick={() => setSection(item.id)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors", section === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{item.label}</button>)}</div></div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-6 flex items-center gap-3"><Avatar name={draft.displayName || "Charlotte"} size="lg" /><div><p className="text-sm font-semibold text-foreground">{draft.displayName || "Charlotte"}</p><p className="text-[12px] text-muted-foreground">{draft.role}</p></div></div>
          {section === "profile" && <div className="space-y-4"><label className="block text-[11px] font-medium text-muted-foreground">Display name<input value={draft.displayName} onChange={event => update({ displayName: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground" /></label><label className="block text-[11px] font-medium text-muted-foreground">Role<input value={draft.role} onChange={event => update({ role: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground" /></label><label className="block text-[11px] font-medium text-muted-foreground">Email <span className="font-normal">(optional)</span><input value={draft.email} onChange={event => update({ email: event.target.value })} type="email" className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground" /></label></div>}
          {section === "preferences" && <div className="space-y-4"><label className="block text-[11px] font-medium text-muted-foreground">Timezone<select value={draft.timezone} onChange={event => update({ timezone: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground"><option>Asia/Jakarta</option><option>Asia/Singapore</option><option>Europe/London</option><option>America/New_York</option></select></label><label className="block text-[11px] font-medium text-muted-foreground">Preferred date format<select value={draft.dateFormat} onChange={event => update({ dateFormat: event.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground"><option>12 Aug 2026</option><option>Aug 12, 2026</option><option>2026-08-12</option></select></label></div>}
          {section === "settings" && <section><div className="mb-4"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Appearance</p><h3 className="luma-heading mt-1 text-lg font-bold text-foreground">Workspace Theme</h3><p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">Choose the atmosphere that feels best to work in.</p></div><div className="space-y-2.5">{WORKSPACE_THEME_OPTIONS.map(option => { const isSelected = theme === option.id; return <button key={option.id} onClick={() => onThemeChange(option.id)} className={cn("w-full rounded-2xl border p-3 text-left transition-colors", isSelected ? "border-primary/35 bg-secondary/50 shadow-sm" : "border-border bg-card hover:border-primary/25 hover:bg-muted/35")} aria-pressed={isSelected}><div className={cn("mb-3 rounded-xl border border-white/70 p-2.5", option.preview)}><div className="rounded-lg bg-[var(--preview-background)] p-2"><div className="flex h-9 items-center gap-2 rounded-md bg-[var(--preview-surface)] px-2 shadow-sm"><span className="h-4 w-4 rounded bg-[var(--preview-primary)]" /><span className="h-2 flex-1 rounded-full bg-[var(--preview-secondary)]" /><span className="h-3 w-3 rounded-full bg-[var(--preview-accent)]" /></div></div></div><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-foreground">{option.label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{option.description}</p></div>{isSelected && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}</div></button>; })}</div></section>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-6"><button onClick={onSignOut} className="rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Sign Out</button><button onClick={() => { onSave(draft); onClose(); }} className="rounded-xl bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">Save changes</button></div>
      </aside>
    </div>
  );
}

function Sidebar({ view, onNav, profile, onProfileClick, collapsed = false, onToggleCollapse, className, onNavigate }: { view: NavView; onNav: (v: NavView) => void; profile: UserProfile; onProfileClick: () => void; collapsed?: boolean; onToggleCollapse?: () => void; className?: string; onNavigate?: () => void }) {
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
        {NAV_GROUPS.map((group, gi) => (
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
                    isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[0_2px_8px_rgb(92_85_153_/_0.06)]" : "text-sidebar-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
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
  const [view, setView] = useState<NavView>("home");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgName | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>("soft");
  const [profile, setProfile] = useState<UserProfile>({ displayName: "Charlotte", role: "Owner", email: "", timezone: "Asia/Jakarta", dateFormat: "12 Aug 2026" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

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
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true") setSidebarCollapsed(true);
    }, 0);
    return () => window.clearTimeout(preferenceTimer);
  }, []);

  useEffect(() => {
    const themeTimer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(WORKSPACE_THEME_STORAGE_KEY);
      if (savedTheme === "grounded" || savedTheme === "dark") {
        setWorkspaceTheme(savedTheme);
        document.documentElement.dataset.theme = savedTheme;
      } else {
        document.documentElement.dataset.theme = "soft";
      }
    }, 0);
    return () => window.clearTimeout(themeTimer);
  }, []);

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
  }

  function changeWorkspaceTheme(theme: WorkspaceTheme) {
    setWorkspaceTheme(theme);
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(WORKSPACE_THEME_STORAGE_KEY, theme);
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
        ? <ProjectDetailView projectId={selectedProject} onBack={() => setView("projects")} onTaskClick={setSelectedTask} />
        : <ProjectsView onProjectClick={id => navTo("project-detail", { project: id })} />;
      case "search": return <SearchView onTaskClick={setSelectedTask} />;
      default: return <HomeView onTaskClick={setSelectedTask} onNavigate={navTo} onProjectClick={project => navTo("project-detail", { project })} onOrgClick={org => navTo("org-detail", { org })} userName={profile.displayName || "Charlotte"} />;
    }
  }

  return (
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
  );
}
