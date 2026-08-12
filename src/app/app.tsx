"use client";

import { useState, type ReactNode } from "react";
import {
  Home, CalendarDays, Inbox, Users, AlertTriangle,
  Building2, FolderKanban, Search, Sparkles, Paperclip,
  Link2, FileText, CheckCircle2, X, RotateCcw, MoreHorizontal,
  Settings, ExternalLink,
  ChevronRight, Plus, Globe, GitBranch, RefreshCw,
  ChevronDown, Check, Calendar, Download, Send, Zap,
  Hourglass, Eye, BarChart2, Layers, Timer,
  SlidersHorizontal, ArrowUpDown, Copy, ChevronLeft,
  MessageSquare, ListTodo, Target, UserCheck,
} from "lucide-react";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

// ─── TYPES ────────────────────────────────────────────────────────────────────

type OrgName = "Villa Khayangan" | "Apotik" | "Personal";
type AreaName = "System Development" | "Operations" | "Marketing" | "Finance" | "HR";
type Priority = "urgent" | "high" | "medium" | "low";
type TaskStatus = "todo" | "in_progress" | "waiting" | "review" | "done";
type NavView =
  | "home" | "today" | "this-week" | "inbox" | "delegated"
  | "waiting" | "review" | "overdue" | "organizations" | "projects" | "search"
  | "all-tasks" | "people" | "person-detail" | "org-detail" | "project-detail" | "followup";

interface TaskLink { label: string; url: string; type: "website" | "sheet" | "figma" | "github" | "drive" }
interface TaskFile { name: string; type: "pdf" | "excel" | "screenshot" | "doc" }
interface Activity { type: "assigned" | "updated" | "submitted" | "commented" | "revision" | "approved"; actor: string; text: string; time: string }

interface Task {
  id: string; title: string; org: OrgName; area: AreaName;
  project?: string; priority: Priority; status: TaskStatus;
  assignee?: string; nextActionBy: string;
  deadline?: string; waitingSince?: string; responseDue?: string;
  lastUpdate?: string; isDelegated: boolean; isWaiting: boolean;
  isOverdue?: boolean; isToday?: boolean; estimatedHours?: number;
  links?: TaskLink[]; files?: TaskFile[]; originalCapture?: string; activity?: Activity[];
}

interface PersonRecord {
  name: string; role: string; org: OrgName;
  active: number; waitingOnThem: number; waitingOnMe: number;
  overdue: number; lastUpdate: string; oldestUnanswered: string; needsFollowUp: boolean;
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
    isDelegated: true, isWaiting: true,
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
    isDelegated: false, isWaiting: true,
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
    isDelegated: false, isWaiting: false,
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

const ORG_RESOURCES: Record<OrgName, TaskLink[]> = {
  "Villa Khayangan": [
    { label: "Google Drive", url: "#", type: "drive" },
    { label: "Main Website", url: "#", type: "website" },
    { label: "Finance Dashboard", url: "#", type: "sheet" },
    { label: "Design System", url: "#", type: "figma" },
  ],
  "Apotik": [
    { label: "Inventory Sheet", url: "#", type: "sheet" },
    { label: "Operations Drive", url: "#", type: "drive" },
  ],
  "Personal": [
    { label: "Personal Drive", url: "#", type: "drive" },
    { label: "Budget Tracker", url: "#", type: "sheet" },
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

const ORG_COLORS: Record<OrgName, { bg: string; text: string; dot: string; border: string }> = {
  "Villa Khayangan": { bg: "bg-indigo-500/10", text: "text-indigo-400", dot: "bg-indigo-400", border: "border-indigo-400/30" },
  "Apotik": { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-400/30" },
  "Personal": { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400", border: "border-orange-400/30" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  urgent: { label: "Urgent", color: "text-red-400", bg: "bg-red-400/10", dot: "bg-red-400" },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10", dot: "bg-orange-400" },
  medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-400/10", dot: "bg-yellow-400" },
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-400/10", dot: "bg-slate-500" },
};

const AREA_COLORS: Record<AreaName, string> = {
  "System Development": "text-violet-400",
  "Operations": "text-sky-400",
  "Marketing": "text-pink-400",
  "Finance": "text-teal-400",
  "HR": "text-amber-400",
};

const PERSON_COLORS: Record<string, string> = {
  "Bu Desti": "#818cf8",
  "Purchasing Manager": "#34d399",
  "HR Manager": "#fb923c",
  "Design Team": "#f472b6",
  "Bank Officer": "#60a5fa",
  "Marketing Team": "#a78bfa",
  "You": "#fbbf24",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getPersonColor(name: string) {
  return PERSON_COLORS[name] || "#818cf8";
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function OrgBadge({ org }: { org: OrgName }) {
  const c = ORG_COLORS[org];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded", c.bg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {org}
    </span>
  );
}

function AreaBadge({ area }: { area: AreaName }) {
  return <span className={cn("text-[11px] font-mono", AREA_COLORS[area])}>{area}</span>;
}

function PriorityDot({ priority }: { priority: Priority }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", PRIORITY_CONFIG[priority].dot)} />;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const c = PRIORITY_CONFIG[priority];
  return <span className={cn("text-[11px] font-mono px-1.5 py-0.5 rounded", c.bg, c.color)}>{c.label}</span>;
}

function Avatar({ name, size = "sm" }: { name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const color = getPersonColor(name);
  const sz = size === "xs" ? "w-5 h-5 text-[9px]" : size === "md" ? "w-8 h-8 text-sm" : size === "lg" ? "w-10 h-10 text-sm" : "w-6 h-6 text-[10px]";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold flex-shrink-0", sz)}
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
      {getInitials(name)}
    </div>
  );
}

function StatusDot({ status }: { status: TaskStatus }) {
  const configs: Record<TaskStatus, string> = {
    todo: "bg-slate-500", in_progress: "bg-indigo-400 animate-pulse",
    waiting: "bg-amber-400", review: "bg-pink-400", done: "bg-emerald-400",
  };
  return <span className={cn("w-2 h-2 rounded-full flex-shrink-0", configs[status])} />;
}

function LinkIcon({ type }: { type: TaskLink["type"] }) {
  const configs: Record<TaskLink["type"], { icon: ReactNode; color: string; bg: string }> = {
    website: { icon: <Globe className="w-3 h-3" />, color: "text-sky-400", bg: "bg-sky-400/10" },
    sheet: { icon: <BarChart2 className="w-3 h-3" />, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    figma: { icon: <Layers className="w-3 h-3" />, color: "text-pink-400", bg: "bg-pink-400/10" },
    github: { icon: <GitBranch className="w-3 h-3" />, color: "text-slate-300", bg: "bg-slate-400/10" },
    drive: { icon: <FolderKanban className="w-3 h-3" />, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  };
  const c = configs[type];
  return (
    <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded", c.bg, c.color)}>
      {c.icon}
    </span>
  );
}

function SectionHeader({ label, count, color = "bg-indigo-400" }: { label: string; count?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {count !== undefined && (
        <span className="text-[11px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 ml-auto">{count}</span>
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
        "w-full text-left group rounded-lg border transition-all duration-150",
        "bg-card border-border hover:border-white/10 hover:bg-white/[0.02]",
        compact ? "p-3" : "p-4",
        task.isOverdue && "border-red-500/20 bg-red-500/[0.03]",
        task.status === "review" && "border-pink-500/20",
      )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0"><PriorityDot priority={task.priority} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm font-medium leading-snug text-foreground", compact && "text-[13px]")}>{task.title}</p>
            {task.isOverdue && <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded flex-shrink-0">OVERDUE</span>}
            {task.status === "review" && <span className="text-[10px] font-mono text-pink-400 bg-pink-400/10 px-1.5 py-0.5 rounded flex-shrink-0">REVIEW</span>}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <OrgBadge org={task.org} />
            <span className="text-muted-foreground text-[11px]">·</span>
            <AreaBadge area={task.area} />
            {task.deadline && (
              <span className="text-[11px] font-mono text-muted-foreground ml-auto flex items-center gap-1">
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
                <span className={cn("text-[11px] font-mono", isMyAction ? "text-amber-400" : "text-slate-400")}>
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

// ─── COMPACT TASK ROW (for All Tasks view) ────────────────────────────────────

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const isMyAction = task.nextActionBy === "me";
  const hasResources = (task.links?.length || 0) + (task.files?.length || 0) > 0;
  return (
    <button onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-white/[0.02] transition-colors group",
        task.isOverdue && "bg-red-500/[0.02]"
      )}>
      <PriorityDot priority={task.priority} />
      <p className="text-[13px] text-foreground flex-1 truncate pr-2">{task.title}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <OrgBadge org={task.org} />
        <span className="hidden lg:block"><AreaBadge area={task.area} /></span>
        {task.assignee
          ? <Avatar name={task.assignee} size="xs" />
          : <span className="w-5 h-5" />}
        <div className="flex items-center gap-1">
          <StatusDot status={task.status} />
        </div>
        {task.deadline
          ? <span className={cn("text-[11px] font-mono w-24 text-right", task.isOverdue ? "text-red-400" : "text-muted-foreground")}>{task.deadline}</span>
          : <span className="w-24 text-[11px] font-mono text-muted-foreground/40 text-right">No date</span>}
        <span className={cn("text-[11px] font-mono w-20 text-right", isMyAction ? "text-amber-400" : "text-slate-500")}>
          → {isMyAction ? "Me" : task.nextActionBy.split(" ")[0]}
        </span>
        {hasResources
          ? <span className="w-3 h-3 rounded-full bg-indigo-400/40 flex-shrink-0" title="Has resources" />
          : <span className="w-3 h-3 flex-shrink-0" />}
      </div>
    </button>
  );
}

// ─── TASK DETAIL DRAWER ───────────────────────────────────────────────────────

function TaskDetailDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[460px] h-full bg-[#0f1119] border-l border-border flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <PriorityDot priority={task.priority} />
              <OrgBadge org={task.org} />
              <AreaBadge area={task.area} />
            </div>
            <h2 className="text-base font-semibold text-foreground leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Status", value: <div className="flex items-center gap-1.5"><StatusDot status={task.status} /><span className="capitalize text-sm">{task.status.replace("_", " ")}</span></div> },
              { label: "Priority", value: <PriorityBadge priority={task.priority} /> },
              { label: "Assignee", value: task.assignee ? <div className="flex items-center gap-1.5"><Avatar name={task.assignee} size="xs" /><span className="text-sm">{task.assignee}</span></div> : <span className="text-sm text-muted-foreground">Unassigned</span> },
              { label: "Next Action By", value: <span className={cn("text-sm font-mono font-medium", task.nextActionBy === "me" ? "text-amber-400" : "text-indigo-400")}>{task.nextActionBy === "me" ? "You" : task.nextActionBy}</span> },
              { label: "Deadline", value: <span className={cn("text-sm font-mono", task.isOverdue ? "text-red-400" : "text-foreground")}>{task.deadline || "—"}</span> },
              { label: "Project", value: <span className="text-sm text-foreground">{task.project || "—"}</span> },
              { label: "Waiting Since", value: <span className="text-sm font-mono text-muted-foreground">{task.waitingSince || "—"}</span> },
              { label: "Response Due", value: <span className="text-sm font-mono text-muted-foreground">{task.responseDue || "—"}</span> },
              { label: "Last Update", value: <span className="text-sm text-muted-foreground">{task.lastUpdate || "—"}</span> },
              { label: "Est. Time", value: <span className="text-sm font-mono text-muted-foreground">{task.estimatedHours ? `${task.estimatedHours}h` : "—"}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-lg p-3">
                <p className="text-[11px] font-mono text-muted-foreground mb-1">{label}</p>
                {value}
              </div>
            ))}
          </div>
          {task.links && task.links.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Resources</h3>
              <div className="space-y-1.5">
                {task.links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group">
                    <LinkIcon type={link.type} />
                    <span className="text-sm text-foreground flex-1">{link.label}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {task.files && task.files.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Files</h3>
              <div className="space-y-1.5">
                {task.files.map((file, i) => {
                  const colors: Record<TaskFile["type"], string> = { pdf: "text-red-400", excel: "text-emerald-400", screenshot: "text-sky-400", doc: "text-blue-400" };
                  return (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer group">
                      <FileText className={cn("w-4 h-4 flex-shrink-0", colors[file.type])} />
                      <span className="text-sm text-foreground flex-1 truncate">{file.name}</span>
                      <Download className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {task.originalCapture && (
            <div>
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Original Capture</h3>
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
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
                          style={{ backgroundColor: actorColor + "22", color: actorColor }}>
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
        <div className="p-4 border-t border-border flex gap-2">
          <button className="flex-1 py-2 px-4 rounded-lg bg-primary text-[13px] font-medium text-white hover:bg-primary/80 transition-colors">
            {task.status === "review" ? "Approve" : "Mark Done"}
          </button>
          {task.status === "review" && (
            <button className="flex-1 py-2 px-4 rounded-lg bg-muted text-[13px] font-medium text-foreground hover:bg-muted/70 transition-colors border border-border">
              Request Revision
            </button>
          )}
          <button className="p-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────

function HomeView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
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
  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Monday, 12 August 2024</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Good morning, Bos.</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You have <span className="text-amber-400 font-medium">{todayTasks.length} tasks</span> today,{" "}
          <span className="text-red-400 font-medium">{overdueTasks.length} overdue</span>, and{" "}
          <span className="text-pink-400 font-medium">{reviewTasks.length} awaiting your review.</span>
        </p>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Today", value: todayTasks.length, sub: "~5h estimated", color: "text-indigo-400", icon: <CalendarDays className="w-4 h-4" /> },
          { label: "Overdue", value: overdueTasks.length, sub: "Needs immediate action", color: "text-red-400", icon: <AlertTriangle className="w-4 h-4" /> },
          { label: "Delegated", value: TASKS.filter(t => t.isDelegated).length, sub: "Across 3 people", color: "text-emerald-400", icon: <Users className="w-4 h-4" /> },
          { label: "Waiting", value: TASKS.filter(t => t.isWaiting).length, sub: "For responses", color: "text-amber-400", icon: <Hourglass className="w-4 h-4" /> },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">{label}</span>
              <span className={cn(color, "opacity-60")}>{icon}</span>
            </div>
            <p className={cn("text-3xl font-bold", color)} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <h2 className="text-sm font-semibold text-foreground">Today — Must Do</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-muted-foreground">
                  <Timer className="w-3 h-3 inline mr-1" />
                  ~{todayTasks.reduce((a, t) => a + (t.estimatedHours || 0), 0)}h estimated
                </span>
                <span className="text-[11px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">{todayTasks.length} tasks</span>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {todayTasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} compact />)}
              {todayTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />All done for today.
                </div>
              )}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
            </div>
            <div className="divide-y divide-border">
              {overdueTasks.length > 0 && (
                <div className="p-4">
                  <p className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-2">Overdue</p>
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
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-pink-500/[0.04] border border-pink-500/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t.assignee} submitted · {t.org} · {t.area}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => onTaskClick(t)} className="px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-colors">Approve</button>
                          <button onClick={() => onTaskClick(t)} className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-[11px] hover:text-foreground transition-colors">Review</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">Waiting on People</h2>
            </div>
            <div className="p-3 space-y-2">
              {waitingPeople.map(person => {
                const color = getPersonColor(person.name);
                return (
                  <div key={person.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
                      {getInitials(person.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{person.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{person.outstanding} outstanding · Oldest: {person.oldest}</p>
                    </div>
                    {person.overdue > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">{person.overdue} OD</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">This Week</h2>
            </div>
            <div className="p-4 space-y-3">
              {weekOrgs.map(({ org, tasks, done }) => {
                const c = ORG_COLORS[org];
                const pct = Math.round((done / tasks) * 100);
                return (
                  <div key={org}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("text-[12px] font-medium", c.text)}>{org}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{done}/{tasks}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", c.dot)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <h2 className="text-sm font-semibold text-foreground">Strategic Projects</h2>
            </div>
            <div className="p-3 space-y-2">
              {STRATEGIC_PROJECTS.map(proj => {
                const c = ORG_COLORS[proj.org];
                return (
                  <div key={proj.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
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

// ─── SMART INBOX VIEW ─────────────────────────────────────────────────────────

interface ParsedTask { title: string; org: OrgName; area: AreaName; assignee?: string; deadline?: string; priority: Priority; originalText: string; link?: string }

const DEMO_PARSED: ParsedTask[] = [
  { title: "Review website accommodation prices", org: "Villa Khayangan", area: "Marketing", assignee: "Bu Desti", deadline: "Wednesday", priority: "high", originalText: "ask Bu Desti to check website prices by Wednesday https://example.com", link: "https://example.com" },
  { title: "Fix purchasing settlement receipt flow", org: "Villa Khayangan", area: "System Development", priority: "high", deadline: "Tomorrow", originalText: "fix purchasing receipt flow because finance needs to calculate money return" },
  { title: "Check expired medicine inventory", org: "Apotik", area: "Operations", priority: "urgent", deadline: "Tomorrow", originalText: "tomorrow check apotik expired medicine issue" },
];

function InboxView() {
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTask[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());

  function handleProcess() {
    if (!input.trim()) return;
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setParsed(DEMO_PARSED); }, 1800);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Smart Inbox</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Capture Anything</h1>
        <p className="text-sm text-muted-foreground mt-1">Type it messy. AI will organize it.</p>
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6 focus-within:border-primary/40 transition-colors">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder={"Dump anything you need to remember or do…\n\nTry: \"ask Bu Desti to check website prices by Wednesday https://example.com\"\nOr: \"fix purchasing receipt flow because finance needs to calculate money return\""}
          className="w-full bg-transparent text-foreground text-sm leading-relaxed p-6 resize-none outline-none placeholder-muted-foreground min-h-[160px]" />
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-1">
            {[{ icon: <Paperclip className="w-3.5 h-3.5" />, label: "File" }, { icon: <Link2 className="w-3.5 h-3.5" />, label: "Link" }, { icon: <FileText className="w-3.5 h-3.5" />, label: "Doc" }].map(({ icon, label }) => (
              <button key={label} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">{icon} {label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {input && <span className="text-[11px] font-mono text-muted-foreground">{input.length} chars</span>}
            <button onClick={handleProcess} disabled={!input.trim() || processing}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                input.trim() && !processing ? "bg-primary text-white hover:bg-primary/80 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed")}>
              {processing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Organizing…</> : <><Sparkles className="w-3.5 h-3.5" />Organize with AI</>}
            </button>
          </div>
        </div>
      </div>
      {processing && (
        <div className="bg-card rounded-xl border border-primary/20 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">AI is reading your input…</p>
              <p className="text-[11px] text-muted-foreground">Detecting tasks, people, deadlines, and context</p>
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
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">AI Found {parsed.length} Tasks</p>
            <button onClick={() => setConfirmed(new Set(parsed.map((_, i) => i)))} className="text-[11px] text-primary hover:text-primary/80 transition-colors">Confirm All</button>
          </div>
          <div className="space-y-3">
            {parsed.map((pt, i) => {
              const isConfirmed = confirmed.has(i);
              return (
                <div key={i} className={cn("rounded-xl border transition-all duration-300", isConfirmed ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" : "bg-card border-border hover:border-white/10")}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <OrgBadge org={pt.org} /><AreaBadge area={pt.area} /><PriorityBadge priority={pt.priority} />
                        </div>
                        <p className="text-sm font-medium text-foreground">{pt.title}</p>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          {pt.assignee && <div className="flex items-center gap-1.5"><Avatar name={pt.assignee} size="xs" /><span className="text-[11px] text-muted-foreground">Assigned to {pt.assignee}</span></div>}
                          {pt.deadline && <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Due {pt.deadline}</span>}
                          {pt.link && <span className="text-[11px] text-sky-400 flex items-center gap-1"><Globe className="w-3 h-3" />Website attached</span>}
                        </div>
                        <div className="mt-2 px-2 py-1.5 rounded bg-muted/40 border-l-2 border-muted">
                          <p className="text-[11px] text-muted-foreground italic">&ldquo;{pt.originalText}&rdquo;</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {isConfirmed
                          ? <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-medium"><Check className="w-3 h-3" /> Saved</div>
                          : <>
                            <button onClick={() => setConfirmed(prev => new Set([...prev, i]))} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors">Confirm</button>
                            <button className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-[11px] hover:text-foreground transition-colors">Edit</button>
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

function DelegatedView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const delegated = TASKS.filter(t => t.isDelegated && t.assignee);
  const byPerson: Record<string, Task[]> = {};
  delegated.forEach(t => { if (t.assignee) { byPerson[t.assignee] = [...(byPerson[t.assignee] || []), t]; } });

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
            <div key={person} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
                  {getInitials(person)}
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-foreground">{person}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{tasks.length} active · Last update: {tasks[0]?.lastUpdate || "Unknown"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {overdue > 0 && <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-red-400/10 text-red-400">{overdue} overdue</span>}
                  <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground">{tasks.length} tasks</span>
                  <button className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><Send className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {tasks.map(task => (
                  <button key={task.id} onClick={() => onTaskClick(task)}
                    className={cn("w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all hover:border-white/10 hover:bg-white/[0.02]", task.isOverdue ? "bg-red-500/[0.04] border-red-500/15" : "bg-muted/20 border-transparent")}>
                    <PriorityDot priority={task.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5"><OrgBadge org={task.org} /><span className="text-muted-foreground text-[11px]">·</span><AreaBadge area={task.area} /></div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {task.waitingSince && <p className="text-[11px] font-mono text-muted-foreground">Waiting {task.waitingSince}</p>}
                      {task.isOverdue && <p className="text-[10px] font-mono text-red-400">Response overdue</p>}
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
  const reviewTasks = TASKS.filter(t => t.status === "review" && t.nextActionBy === "me");
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Review Queue</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Needs My Review</h1>
        <p className="text-sm text-muted-foreground mt-1">{reviewTasks.length} submissions waiting for your response</p>
      </div>
      <div className="space-y-4">
        {reviewTasks.map(task => {
          const submitActivity = task.activity?.find(a => a.type === "submitted");
          return (
            <div key={task.id} className="bg-card rounded-xl border border-pink-500/15 overflow-hidden hover:border-pink-500/25 transition-colors">
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
                    {task.links.map((l, i) => (
                      <a key={i} href={l.url} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border text-[11px] text-sky-400 hover:text-sky-300 transition-colors">
                        <LinkIcon type={l.type} />{l.label}
                      </a>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[13px] font-medium hover:bg-emerald-500/20 transition-colors"><Check className="w-4 h-4" /> Approve</button>
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-[13px] font-medium hover:bg-amber-500/20 transition-colors"><RotateCcw className="w-4 h-4" /> Request Revision</button>
                  <button onClick={() => onTaskClick(task)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-[13px] hover:text-foreground transition-colors ml-auto"><Eye className="w-4 h-4" /> Open Details</button>
                </div>
              </div>
            </div>
          );
        })}
        {reviewTasks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-sm">No submissions waiting for review.</p>
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
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Status Board</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Waiting</h1>
      </div>
      <div className="flex gap-1 mb-6 p-1 bg-muted/30 rounded-lg border border-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-2 px-3 rounded-md text-[12px] font-medium transition-all", tab === t.id ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.tasks.length > 0 && <span className={cn("ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{t.tasks.length}</span>}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {current.tasks.map(task => (
          <button key={task.id} onClick={() => onTaskClick(task)}
            className="w-full text-left bg-card rounded-xl border border-border hover:border-white/10 hover:bg-white/[0.02] transition-all p-4">
            <div className="flex items-start gap-3">
              <PriorityDot priority={task.priority} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">{task.title}</p>
                <div className="flex items-center gap-2 mb-2 flex-wrap"><OrgBadge org={task.org} /><AreaBadge area={task.area} /></div>
                <div className="grid grid-cols-3 gap-3">
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
          <div className="text-center py-12 text-muted-foreground"><Hourglass className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">Nothing here.</p></div>
        )}
      </div>
    </div>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────

function TodayView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const todayTasks = TASKS.filter(t => t.isToday && t.nextActionBy === "me");
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Monday, 12 Aug</p>
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
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-red-400 uppercase tracking-widest mb-1">Attention Required</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Overdue</h1>
        <p className="text-sm text-muted-foreground mt-1">{overdue.length} tasks past their deadline</p>
      </div>
      <div className="space-y-2">
        {overdue.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />)}
        {overdue.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-sm">Nothing overdue. Great job!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── THIS WEEK VIEW ───────────────────────────────────────────────────────────

const DAYS = ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16"];
const WEEK_TASKS: Record<string, Task[]> = {
  "Mon 12": TASKS.filter(t => t.isToday),
  "Tue 13": TASKS.filter(t => t.id === "t11"),
  "Wed 14": TASKS.filter(t => t.id === "t1" || t.id === "t8"),
  "Thu 15": TASKS.filter(t => t.id === "t6"),
  "Fri 16": TASKS.filter(t => t.id === "t7"),
};

function ThisWeekView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  return (
    <div className="p-8 h-full overflow-auto">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Week of 12 Aug</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>This Week</h1>
      </div>
      <div className="grid grid-cols-5 gap-3 min-h-[400px]">
        {DAYS.map(day => {
          const tasks = WEEK_TASKS[day] || [];
          const isToday = day === "Mon 12";
          return (
            <div key={day} className={cn("rounded-xl border flex flex-col", isToday ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card")}>
              <div className={cn("px-3 py-2.5 border-b", isToday ? "border-primary/20" : "border-border")}>
                <p className={cn("text-[12px] font-semibold", isToday ? "text-primary" : "text-foreground")}>{day}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{tasks.length} tasks</p>
              </div>
              <div className="p-2 space-y-1.5 flex-1">
                {tasks.map(t => (
                  <button key={t.id} onClick={() => onTaskClick(t)}
                    className="w-full text-left p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border">
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
  );
}

// ─── ALL TASKS VIEW (NEW) ─────────────────────────────────────────────────────

type QuickFilter = "mine" | "delegated" | "no-deadline" | "due-soon" | "overdue" | "waiting" | "completed" | null;
type SortBy = "deadline" | "priority" | "updated" | "org";

function AllTasksView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const [search, setSearch] = useState("");
  const [qf, setQf] = useState<QuickFilter>(null);
  const [sortBy, setSortBy] = useState<SortBy>("deadline");
  const [showFilters, setShowFilters] = useState(false);
  const [filterOrg, setFilterOrg] = useState<OrgName | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null);

  const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  let tasks = TASKS.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.org.toLowerCase().includes(q) && !t.area.toLowerCase().includes(q) && !(t.assignee || "").toLowerCase().includes(q)) return false;
    }
    if (filterOrg && t.org !== filterOrg) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (qf === "mine" && t.nextActionBy !== "me") return false;
    if (qf === "delegated" && !t.isDelegated) return false;
    if (qf === "no-deadline" && t.deadline) return false;
    if (qf === "overdue" && !t.isOverdue) return false;
    if (qf === "waiting" && !t.isWaiting) return false;
    if (qf === "completed" && t.status !== "done") return false;
    if (qf === "due-soon" && !t.isToday) return false;
    return true;
  });

  tasks = [...tasks].sort((a, b) => {
    if (sortBy === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortBy === "org") return a.org.localeCompare(b.org);
    return 0;
  });

  const quickFilters: { id: QuickFilter; label: string; count: number }[] = [
    { id: "mine", label: "My Tasks", count: TASKS.filter(t => t.nextActionBy === "me").length },
    { id: "delegated", label: "Delegated", count: TASKS.filter(t => t.isDelegated).length },
    { id: "no-deadline", label: "No Deadline", count: TASKS.filter(t => !t.deadline).length },
    { id: "due-soon", label: "Due Soon", count: TASKS.filter(t => t.isToday).length },
    { id: "overdue", label: "Overdue", count: TASKS.filter(t => t.isOverdue).length },
    { id: "waiting", label: "Waiting", count: TASKS.filter(t => t.isWaiting).length },
    { id: "completed", label: "Completed", count: TASKS.filter(t => t.status === "done").length },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Master List</p>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>All Tasks</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2 w-64 focus-within:border-primary/40 transition-colors">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
                className="bg-transparent text-sm text-foreground outline-none placeholder-muted-foreground flex-1 min-w-0" />
              {search && <button onClick={() => setSearch("")}><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] transition-colors", showFilters ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-white/10")}>
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters
              {(filterOrg || filterStatus || filterPriority) && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
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
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-[12px] font-medium text-white hover:bg-primary/80 transition-colors">
              <Plus className="w-3.5 h-3.5" />New Task
            </button>
          </div>
        </div>
        {/* Quick filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {quickFilters.map(f => (
            <button key={f.id} onClick={() => setQf(qf === f.id ? null : f.id)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border",
                qf === f.id
                  ? f.id === "overdue" ? "bg-red-400/15 text-red-400 border-red-400/30" : "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-white/10")}>
              {f.label}
              <span className={cn("font-mono", qf === f.id ? "" : "text-muted-foreground/60")}>{f.count}</span>
            </button>
          ))}
          {qf && <button onClick={() => setQf(null)} className="text-[11px] text-muted-foreground hover:text-foreground ml-1">Clear</button>}
        </div>
        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground">Org:</span>
              <div className="flex gap-1">
                {(["Villa Khayangan", "Apotik", "Personal"] as OrgName[]).map(org => {
                  const c = ORG_COLORS[org];
                  return (
                    <button key={org} onClick={() => setFilterOrg(filterOrg === org ? null : org)}
                      className={cn("px-2 py-1 rounded text-[11px] transition-colors border", filterOrg === org ? cn(c.bg, c.text, c.border) : "border-border text-muted-foreground hover:text-foreground")}>
                      {org.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground">Priority:</span>
              <div className="flex gap-1">
                {(["urgent", "high", "medium", "low"] as Priority[]).map(p => {
                  const c = PRIORITY_CONFIG[p];
                  return (
                    <button key={p} onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                      className={cn("px-2 py-1 rounded text-[11px] transition-colors border capitalize", filterPriority === p ? cn(c.bg, c.color) : "border-border text-muted-foreground hover:text-foreground")}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            {(filterOrg || filterStatus || filterPriority) && (
              <button onClick={() => { setFilterOrg(null); setFilterStatus(null); setFilterPriority(null); }}
                className="text-[11px] text-muted-foreground hover:text-foreground ml-auto">Clear filters</button>
            )}
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20">
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
      </div>

      {/* Task rows */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No tasks match your filters.</p>
          </div>
        ) : (
          tasks.map(task => <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task)} />)
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-3">
        <span className="text-[11px] font-mono text-muted-foreground">{tasks.length} of {TASKS.length} tasks</span>
        {(search || qf || filterOrg || filterStatus || filterPriority) && (
          <span className="text-[11px] text-primary">Filtered</span>
        )}
      </div>
    </div>
  );
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Accountability</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>People</h1>
      </div>

      {/* Summary alert */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { value: owesUpdate, label: "people owe me an update", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
          { value: waitingForMe, label: "people waiting for me", color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
          { value: overdueCount, label: "delegated tasks overdue", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
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
              className="w-full text-left bg-card rounded-xl border border-border hover:border-white/10 hover:bg-white/[0.02] transition-all p-5 group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
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
                <div className="grid grid-cols-4 gap-4 flex-shrink-0 text-center">
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
                <div className="text-right flex-shrink-0 min-w-[120px]">
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

function PersonDetailView({ personName, onBack, onTaskClick }: { personName: string; onBack: () => void; onTaskClick: (t: Task) => void }) {
  const person = PEOPLE_DATA.find(p => p.name === personName);
  if (!person) return null;
  const color = getPersonColor(person.name);
  const orgC = ORG_COLORS[person.org];

  const personTasks = TASKS.filter(t => t.assignee === personName || t.nextActionBy === personName);
  const groups: { label: string; color: string; tasks: Task[] }[] = [
    { label: "Waiting on Them", color: "bg-amber-400", tasks: personTasks.filter(t => t.nextActionBy === personName && t.status !== "done") },
    { label: "Submitted for My Review", color: "bg-pink-400", tasks: personTasks.filter(t => t.status === "review") },
    { label: "In Progress / Active", color: "bg-indigo-400", tasks: personTasks.filter(t => t.status === "in_progress") },
    { label: "Completed", color: "bg-emerald-400", tasks: personTasks.filter(t => t.status === "done") },
  ].filter(g => g.tasks.length > 0);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <BackButton label="People" onClick={onBack} />

      {/* Person header */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: color + "22", color, border: `2px solid ${color}44` }}>
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
            <button className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />Message
            </button>
            <button className="px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-[12px] hover:text-foreground transition-colors flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />Follow Up
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
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

function OrgDetailView({ orgName, onBack, onTaskClick, onProjectClick }: {
  orgName: OrgName; onBack: () => void; onTaskClick: (t: Task) => void; onProjectClick: (id: string) => void;
}) {
  const [selectedArea, setSelectedArea] = useState<AreaName | null>(null);
  const orgMeta = ORGS_META.find(o => o.name === orgName)!;
  const c = ORG_COLORS[orgName];
  const orgTasks = TASKS.filter(t => t.org === orgName);
  const filteredTasks = selectedArea ? orgTasks.filter(t => t.area === selectedArea) : orgTasks;
  const orgProjects = STRATEGIC_PROJECTS.filter(p => p.org === orgName);
  const orgPeople = PEOPLE_DATA.filter(p => p.org === orgName);
  const resources = ORG_RESOURCES[orgName];

  const stats = [
    { label: "Today", value: orgTasks.filter(t => t.isToday).length, color: "text-indigo-400" },
    { label: "This Week", value: orgTasks.length, color: "text-foreground" },
    { label: "Overdue", value: orgTasks.filter(t => t.isOverdue).length, color: "text-red-400" },
    { label: "Waiting", value: orgTasks.filter(t => t.isWaiting).length, color: "text-amber-400" },
    { label: "Delegated", value: orgTasks.filter(t => t.isDelegated).length, color: "text-emerald-400" },
    { label: "Review", value: orgTasks.filter(t => t.status === "review").length, color: "text-pink-400" },
  ];

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <BackButton label="Organizations" onClick={onBack} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={cn("w-3 h-3 rounded-sm", c.dot)} />
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{orgName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{orgMeta.desc}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors"><Plus className="w-3.5 h-3.5" />Quick Capture</button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-[12px] hover:text-foreground transition-colors"><FolderKanban className="w-3.5 h-3.5" />Add Project</button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className={cn("text-2xl font-bold", color)} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Areas + Tasks */}
        <div className="col-span-2 space-y-5">
          {/* Areas */}
          <div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Areas</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedArea(null)}
                className={cn("px-3 py-2 rounded-lg border text-[12px] font-medium transition-all", !selectedArea ? cn("border", c.border, c.bg, c.text) : "border-border text-muted-foreground hover:text-foreground")}>
                All
                <span className="ml-1.5 text-[10px] font-mono opacity-60">{orgTasks.length}</span>
              </button>
              {orgMeta.areas.map(area => {
                const count = orgTasks.filter(t => t.area === area).length;
                return (
                  <button key={area} onClick={() => setSelectedArea(selectedArea === area ? null : area)}
                    className={cn("px-3 py-2 rounded-lg border text-[12px] transition-all", selectedArea === area ? cn(AREA_COLORS[area], "bg-muted/60 border-white/15") : "border-border text-muted-foreground hover:text-foreground")}>
                    {area}
                    <span className="ml-1.5 text-[10px] font-mono opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                {selectedArea ? selectedArea : "All Tasks"} · {filteredTasks.length}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {filteredTasks.slice(0, 8).map(t => <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />)}
              {filteredTasks.length > 8 && (
                <div className="px-4 py-2.5 border-t border-border text-center">
                  <span className="text-[11px] text-muted-foreground">+{filteredTasks.length - 8} more tasks</span>
                </div>
              )}
              {filteredTasks.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">No tasks in this area.</div>
              )}
            </div>
          </div>

          {/* People in this org */}
          {orgPeople.length > 0 && (
            <div>
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">People with Open Work</p>
              <div className="grid grid-cols-2 gap-2">
                {orgPeople.map(person => {
                  const pc = getPersonColor(person.name);
                  return (
                    <div key={person.name} className="flex items-center gap-2.5 p-3 rounded-lg bg-card border border-border hover:border-white/10 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: pc + "22", color: pc, border: `1px solid ${pc}44` }}>
                        {getInitials(person.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{person.name}</p>
                        <p className="text-[10px] text-muted-foreground">{person.active} active · {person.waitingOnThem} waiting</p>
                      </div>
                      {person.overdue > 0 && <span className="text-[10px] font-mono text-red-400">{person.overdue} OD</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Projects + Resources */}
        <div className="space-y-5">
          {/* Projects */}
          {orgProjects.length > 0 && (
            <div>
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Current Projects</p>
              <div className="space-y-2">
                {orgProjects.map(proj => {
                  const statusColor = proj.status === "at_risk" ? "text-orange-400" : "text-emerald-400";
                  return (
                    <button key={proj.id} onClick={() => onProjectClick(proj.id)}
                      className="w-full text-left bg-card rounded-xl border border-border hover:border-white/10 transition-all p-4 group">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-[13px] font-medium text-foreground">{proj.name}</p>
                        <span className={cn("text-[11px] font-mono", statusColor)}>{proj.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                        <div className={cn("h-full rounded-full", c.dot)} style={{ width: `${proj.progress}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground">{proj.tasks - proj.done} remaining</span>
                        <span className="text-[10px] font-mono text-muted-foreground">Due {proj.deadline}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resources */}
          <div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Resources</p>
            <div className="space-y-1.5">
              {resources.map((r, i) => (
                <a key={i} href={r.url}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card border border-border hover:border-white/10 transition-colors group">
                  <LinkIcon type={r.type} />
                  <span className="text-[13px] text-foreground flex-1">{r.label}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Attention items */}
          {orgTasks.some(t => t.isOverdue || t.status === "review") && (
            <div>
              <p className="text-[11px] font-mono text-amber-400 uppercase tracking-wider mb-2">Needs Attention</p>
              <div className="space-y-1.5">
                {orgTasks.filter(t => t.isOverdue || t.status === "review").map(t => (
                  <button key={t.id} onClick={() => onTaskClick(t)}
                    className="w-full text-left p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/15 hover:border-amber-400/25 transition-colors">
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={t.priority} />
                      <p className="text-[12px] text-foreground truncate flex-1">{t.title}</p>
                      {t.isOverdue && <span className="text-[10px] text-red-400 flex-shrink-0">OD</span>}
                      {t.status === "review" && <span className="text-[10px] text-pink-400 flex-shrink-0">Review</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PROJECT DETAIL VIEW (NEW) ────────────────────────────────────────────────

type ProjectTab = "active" | "mine" | "delegated" | "waiting" | "review" | "completed";

function ProjectDetailView({ projectId, onBack, onTaskClick }: { projectId: string; onBack: () => void; onTaskClick: (t: Task) => void }) {
  const [tab, setTab] = useState<ProjectTab>("active");
  const detail = PROJECT_DETAILS[projectId];
  const basicProj = STRATEGIC_PROJECTS.find(p => p.id === projectId);
  if (!detail || !basicProj) return null;

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
    <div className="p-8 max-w-[1100px] mx-auto">
      <BackButton label="Projects" onClick={onBack} />

      {/* Hero */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
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
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Tasks", value: detail.tasks },
            { label: "Done", value: detail.done, color: "text-emerald-400" },
            { label: "Active", value: tabTasks.active.length, color: "text-indigo-400" },
            { label: "Waiting", value: tabTasks.waiting.length, color: "text-amber-400" },
            { label: "Delegated", value: tabTasks.delegated.length, color: "text-sky-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
              <p className={cn("text-xl font-bold", color || "text-foreground")} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Current Focus + Tasks */}
        <div className="col-span-2 space-y-5">
          {/* Current Focus */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Current Focus</h2>
            </div>
            <div className="space-y-2">
              {detail.currentFocus.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/[0.04] border border-primary/10">
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
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {tabTasks[tab].length === 0
                ? <div className="py-8 text-center text-muted-foreground text-sm">No tasks in this view.</div>
                : tabTasks[tab].map(t => <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />)}
            </div>
          </div>
        </div>

        {/* Right: Resources + Activity */}
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Resources</p>
            <div className="space-y-1.5">
              {detail.resources.map((r, i) => (
                <a key={i} href={r.url}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card border border-border hover:border-white/10 transition-colors group">
                  <LinkIcon type={r.type} />
                  <span className="text-[13px] text-foreground flex-1">{r.label}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </a>
              ))}
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
                      style={{ backgroundColor: actorColor + "22", color: actorColor }}>
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
  const [copied, setCopied] = useState<string | null>(null);

  const todayData = FOLLOWUP_DATA.filter(d => d.section === "today" && !followedUp.has(d.person));
  const laterData = FOLLOWUP_DATA.filter(d => d.section === "later" && !followedUp.has(d.person));
  const overdueData = FOLLOWUP_DATA.filter(d => d.items.some(i => i.status === "overdue") && !followedUp.has(d.person));
  const noUpdateData = FOLLOWUP_DATA.filter(d => d.items.some(i => i.status === "no_update") && !followedUp.has(d.person));

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

  const totalNeedFollowUp = todayData.length;
  const totalItems = FOLLOWUP_DATA.filter(d => !followedUp.has(d.person)).reduce((a, d) => a + d.items.length, 0);
  const overdueResponses = FOLLOWUP_DATA.filter(d => !followedUp.has(d.person)).flatMap(d => d.items.filter(i => i.status === "overdue")).length;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Action Center</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Follow-Up</h1>
        <p className="text-sm text-muted-foreground mt-1">Who should you contact today, and what for?</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
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
      <div className="flex gap-1 mb-5 p-1 bg-muted/20 rounded-lg border border-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-2 px-2 rounded-md text-[11px] font-medium transition-all", tab === t.id ? "bg-card text-foreground border border-border shadow-sm" : "text-muted-foreground hover:text-foreground")}>
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
            <div key={fp.person} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Person header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
                  {getInitials(fp.person)}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{fp.person}</h3>
                  <p className="text-[11px] text-muted-foreground">{fp.items.length} items need follow-up</p>
                </div>
                {!isGenerated ? (
                  <button onClick={() => setGenerated(prev => new Set([...prev, fp.person]))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />Generate Follow-Up
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400">
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
                    <span className="text-[11px] font-medium text-primary">AI Generated Message</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">Preview</span>
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">{fp_data.suggestedMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-primary/15">
                    <button onClick={() => handleCopy(fp.person, fp_data.suggestedMessage)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      {copied === fp.person ? <><Check className="w-3 h-3 text-emerald-400" />Copied!</> : <><Copy className="w-3 h-3" />Copy Message</>}
                    </button>
                    <button onClick={() => handleMarkDone(fp.person)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-colors">
                      <Check className="w-3 h-3" />Mark Followed Up
                    </button>
                    <button onClick={() => setGenerated(prev => { const n = new Set(prev); n.delete(fp.person); return n; })}
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
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Portfolio</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Organizations</h1>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {ORGS_META.map(org => {
          const c = ORG_COLORS[org.name];
          const orgTasks = TASKS.filter(t => t.org === org.name);
          const overdue = orgTasks.filter(t => t.isOverdue).length;
          return (
            <button key={org.name} onClick={() => onOrgClick(org.name)}
              className="text-left bg-card rounded-xl border border-border overflow-hidden hover:border-white/10 transition-all group">
              <div className={cn("h-1", c.dot)} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className={cn("text-base font-bold", c.text)} style={{ fontFamily: "var(--font-display)" }}>{org.name}</h2>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{org.desc}</p>
                  </div>
                  {overdue > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">{overdue} OD</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className={cn("text-xl font-bold", c.text)}>{orgTasks.length}</p>
                    <p className="text-[10px] text-muted-foreground">Active Tasks</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-xl font-bold text-foreground">{STRATEGIC_PROJECTS.filter(p => p.org === org.name).length}</p>
                    <p className="text-[10px] text-muted-foreground">Projects</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {org.areas.map(area => (
                    <div key={area} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/40 transition-colors">
                      <span className={cn("text-[12px]", AREA_COLORS[area])}>{area}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{TASKS.filter(t => t.org === org.name && t.area === area).length} tasks</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">View details</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
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
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Long-term</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Projects</h1>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {STRATEGIC_PROJECTS.map(proj => {
          const c = ORG_COLORS[proj.org];
          const projTasks = TASKS.filter(t => t.project === proj.name);
          const detail = PROJECT_DETAILS[proj.id];
          return (
            <button key={proj.id} onClick={() => onProjectClick(proj.id)}
              className="text-left bg-card rounded-xl border border-border overflow-hidden hover:border-white/10 transition-all group">
              <div className={cn("h-1", c.dot)} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{proj.name}</h2>
                    <OrgBadge org={proj.org} />
                  </div>
                  <span className={cn("text-2xl font-bold", c.text)}>{proj.progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3 mb-2">
                  <div className={cn("h-full rounded-full", c.dot)} style={{ width: `${proj.progress}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-3">
                  <span>{proj.done}/{proj.tasks} tasks</span>
                  <span>Due {proj.deadline}</span>
                </div>
                {detail && detail.currentFocus.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">Current Focus</p>
                    <div className="space-y-1">
                      {detail.currentFocus.slice(0, 2).map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <div className="w-1 h-1 rounded-full bg-primary/50 flex-shrink-0" />{f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {projTasks.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border">
                    {projTasks.slice(0, 2).map(t => (
                      <div key={t.id} className="flex items-center gap-2 py-1">
                        <StatusDot status={t.status} />
                        <span className="text-[12px] text-foreground truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Open project</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────

function SearchView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const [query, setQuery] = useState("");
  const results = query.length > 1
    ? TASKS.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.org.toLowerCase().includes(query.toLowerCase()) ||
        t.area.toLowerCase().includes(query.toLowerCase()) ||
        (t.assignee || "").toLowerCase().includes(query.toLowerCase())
      )
    : [];
  return (
    <div className="p-8 max-w-2xl mx-auto">
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
          <div className="space-y-2">{results.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />)}</div>
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
    items: [{ id: "home" as NavView, label: "Home", icon: <Home className="w-4 h-4" /> }]
  },
  {
    label: "Planning",
    items: [
      { id: "today" as NavView, label: "Today", icon: <CalendarDays className="w-4 h-4" />, badge: TASKS.filter(t => t.isToday && t.nextActionBy === "me").length },
      { id: "this-week" as NavView, label: "This Week", icon: <Calendar className="w-4 h-4" /> },
    ]
  },
  {
    label: "Capture",
    items: [
      { id: "inbox" as NavView, label: "Smart Inbox", icon: <Inbox className="w-4 h-4" />, highlight: true },
    ]
  },
  {
    label: "Track",
    items: [
      { id: "delegated" as NavView, label: "Delegated", icon: <Users className="w-4 h-4" />, badge: TASKS.filter(t => t.isDelegated).length },
      { id: "waiting" as NavView, label: "Waiting", icon: <Hourglass className="w-4 h-4" />, badge: TASKS.filter(t => t.isWaiting).length },
      { id: "review" as NavView, label: "Needs My Review", icon: <Eye className="w-4 h-4" />, badge: TASKS.filter(t => t.status === "review" && t.nextActionBy === "me").length },
      { id: "overdue" as NavView, label: "Overdue", icon: <AlertTriangle className="w-4 h-4" />, badge: TASKS.filter(t => t.isOverdue).length, urgent: true },
      { id: "followup" as NavView, label: "Follow-Up", icon: <MessageSquare className="w-4 h-4" />, badge: FOLLOWUP_DATA.filter(d => d.section === "today").length },
    ]
  },
  {
    label: "People",
    items: [
      { id: "people" as NavView, label: "People", icon: <UserCheck className="w-4 h-4" />, badge: PEOPLE_DATA.filter(p => p.needsFollowUp).length },
    ]
  },
  {
    label: "Organize",
    items: [
      { id: "all-tasks" as NavView, label: "All Tasks", icon: <ListTodo className="w-4 h-4" /> },
      { id: "organizations" as NavView, label: "Organizations", icon: <Building2 className="w-4 h-4" /> },
      { id: "projects" as NavView, label: "Projects", icon: <FolderKanban className="w-4 h-4" /> },
      { id: "search" as NavView, label: "Search", icon: <Search className="w-4 h-4" /> },
    ]
  },
];

function Sidebar({ view, onNav }: { view: NavView; onNav: (v: NavView) => void }) {
  const activeView = (["org-detail", "person-detail", "project-detail"].includes(view))
    ? (view === "org-detail" ? "organizations" : view === "project-detail" ? "projects" : "people") as NavView
    : view;

  return (
    <aside className="w-[220px] flex-shrink-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Command</p>
            <p className="text-[10px] font-mono text-muted-foreground -mt-0.5">Work OS</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {group.label && (
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-3 mb-1.5">{group.label}</p>
            )}
            {group.items.map((item: { id: NavView; label: string; icon: ReactNode; badge?: number; urgent?: boolean; highlight?: boolean }) => {
              const isActive = activeView === item.id;
              return (
                <button key={item.id} onClick={() => onNav(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all mb-0.5",
                    isActive ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                    item.highlight && !isActive && "text-primary/80"
                  )}>
                  <span className={cn("flex-shrink-0", isActive ? "text-primary" : "opacity-60")}>{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                      item.urgent ? "bg-red-400/15 text-red-400" : isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        {(["Villa Khayangan", "Apotik", "Personal"] as OrgName[]).map(org => {
          const c = ORG_COLORS[org];
          return (
            <button key={org} onClick={() => onNav("organizations")}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", c.dot)} />
              <span className="text-[12px] text-sidebar-foreground truncate">{org}</span>
            </button>
          );
        })}
      </div>
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center text-[11px] font-bold text-amber-400">BO</div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground truncate">Bos</p>
            <p className="text-[10px] font-mono text-muted-foreground">Owner</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function CommandApp() {
  const [view, setView] = useState<NavView>("home");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgName | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  function navTo(v: NavView, opts?: { org?: OrgName; project?: string; person?: string }) {
    setView(v);
    setSelectedTask(null);
    if (opts?.org !== undefined) setSelectedOrg(opts.org);
    if (opts?.project !== undefined) setSelectedProject(opts.project);
    if (opts?.person !== undefined) setSelectedPerson(opts.person);
  }

  function renderView() {
    switch (view) {
      case "home": return <HomeView onTaskClick={setSelectedTask} />;
      case "today": return <TodayView onTaskClick={setSelectedTask} />;
      case "this-week": return <ThisWeekView onTaskClick={setSelectedTask} />;
      case "inbox": return <InboxView />;
      case "delegated": return <DelegatedView onTaskClick={setSelectedTask} />;
      case "waiting": return <WaitingView onTaskClick={setSelectedTask} />;
      case "review": return <ReviewView onTaskClick={setSelectedTask} />;
      case "overdue": return <OverdueView onTaskClick={setSelectedTask} />;
      case "all-tasks": return <AllTasksView onTaskClick={setSelectedTask} />;
      case "people": return <PeopleView onPersonClick={name => navTo("person-detail", { person: name })} />;
      case "person-detail": return selectedPerson
        ? <PersonDetailView personName={selectedPerson} onBack={() => setView("people")} onTaskClick={setSelectedTask} />
        : <PeopleView onPersonClick={name => navTo("person-detail", { person: name })} />;
      case "followup": return <FollowUpView onTaskClick={setSelectedTask} />;
      case "organizations": return <OrganizationsView onOrgClick={org => navTo("org-detail", { org })} />;
      case "org-detail": return selectedOrg
        ? <OrgDetailView orgName={selectedOrg} onBack={() => setView("organizations")} onTaskClick={setSelectedTask} onProjectClick={id => navTo("project-detail", { project: id })} />
        : <OrganizationsView onOrgClick={org => navTo("org-detail", { org })} />;
      case "projects": return <ProjectsView onProjectClick={id => navTo("project-detail", { project: id })} />;
      case "project-detail": return selectedProject
        ? <ProjectDetailView projectId={selectedProject} onBack={() => setView("projects")} onTaskClick={setSelectedTask} />
        : <ProjectsView onProjectClick={id => navTo("project-detail", { project: id })} />;
      case "search": return <SearchView onTaskClick={setSelectedTask} />;
      default: return <HomeView onTaskClick={setSelectedTask} />;
    }
  }

  const isFullHeight = view === "all-tasks";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      <Sidebar view={view} onNav={v => navTo(v)} />
      <main className={cn("flex-1 overflow-hidden", isFullHeight ? "flex flex-col" : "overflow-y-auto")}>
        {renderView()}
      </main>
      {selectedTask && <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
