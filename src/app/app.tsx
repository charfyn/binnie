"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Home, CalendarDays, Inbox, Users, AlertTriangle,
  Building2, FolderKanban, Search, Sparkles, Paperclip,
  Link2, FileText, CheckCircle2, X, RotateCcw, MoreHorizontal,
  Settings, ExternalLink,
  ChevronRight, Plus, Globe, GitBranch, RefreshCw,
  ChevronDown, ChevronUp, Check, Calendar, Download, Send,
  Hourglass, Eye, BarChart2, Layers, Timer,
  SlidersHorizontal, ArrowUpDown, Copy, ChevronLeft,
  MessageSquare, ListTodo, Target, UserCheck, Menu, ImagePlus,
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
  "Villa Khayangan": { bg: "bg-[#eae6ff]", text: "text-[#6269b6]", dot: "bg-[#8e94f2]", border: "border-[#d9d6f6]" },
  "Apotik": { bg: "bg-[#dcede7]", text: "text-[#5d8970]", dot: "bg-[#88b69a]", border: "border-[#cbe1d6]" },
  "Personal": { bg: "bg-[#f8e3d3]", text: "text-[#ac765a]", dot: "bg-[#e3aa8e]", border: "border-[#f0d2be]" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  urgent: { label: "Needs attention", color: "text-overdue", bg: "bg-overdue/10", dot: "bg-overdue" },
  high: { label: "Important", color: "text-[#a87955]", bg: "bg-[#fff1e7]", dot: "bg-[#dfa17c]" },
  medium: { label: "Planned", color: "text-warning", bg: "bg-[#fff9e4]", dot: "bg-[#e2c66d]" },
  low: { label: "When there’s room", color: "text-muted-foreground", bg: "bg-muted", dot: "bg-[#a8afbd]" },
};

const AREA_COLORS: Record<AreaName, string> = {
  "System Development": "text-[#766fae]",
  "Operations": "text-[#6488a9]",
  "Marketing": "text-[#ac778d]",
  "Finance": "text-[#548c88]",
  "HR": "text-[#a67e48]",
};

const PERSON_COLORS: Record<string, string> = {
  "Bu Desti": "#9991cc",
  "Purchasing Manager": "#84ae91",
  "HR Manager": "#d39a7f",
  "Design Team": "#bb8ba0",
  "Bank Officer": "#86a6c6",
  "Marketing Team": "#a48fc5",
  "You": "#c7a55f",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getPersonColor(name: string) {
  return PERSON_COLORS[name] || "#9991cc";
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
  return <span className={cn("text-[11px] font-medium", AREA_COLORS[area])}>{area}</span>;
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
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
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
  const configs: Record<TaskLink["type"], { icon: ReactNode; color: string; bg: string }> = {
    website: { icon: <Globe className="w-3 h-3" />, color: "text-info", bg: "bg-[#edf4fb]" },
    sheet: { icon: <BarChart2 className="w-3 h-3" />, color: "text-success", bg: "bg-[#edf7f0]" },
    figma: { icon: <Layers className="w-3 h-3" />, color: "text-review", bg: "bg-[#f4effa]" },
    github: { icon: <GitBranch className="w-3 h-3" />, color: "text-[#6e7485]", bg: "bg-muted" },
    drive: { icon: <FolderKanban className="w-3 h-3" />, color: "text-warning", bg: "bg-[#fff9e4]" },
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

// ─── COMPACT TASK ROW (for All Tasks view) ────────────────────────────────────

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
                {task.links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 rounded-xl bg-muted/55 p-3 transition-colors hover:bg-secondary">
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
                  const colors: Record<TaskFile["type"], string> = { pdf: "text-overdue", excel: "text-success", screenshot: "text-info", doc: "text-primary" };
                  return (
                    <div key={i} className="group flex cursor-pointer items-center gap-2.5 rounded-xl bg-muted/55 p-3 transition-colors hover:bg-secondary">
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
        <div className="flex gap-2 border-t border-border p-4 sm:p-5">
          <button className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">
            {task.status === "review" ? "Approve" : "Mark Done"}
          </button>
          {task.status === "review" && (
            <button className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-primary/10">
              Request Revision
            </button>
          )}
          <button aria-label="More task actions" className="rounded-xl border border-border bg-muted p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <MoreHorizontal className="w-4 h-4" />
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

function createCapturePreviews(input: string): InlineCapturePreview[] {
  const lines = input.split("\n").map(line => line.trim()).filter(Boolean).slice(0, 4);

  return lines.map((line, index) => {
    const normalized = line.toLowerCase();
    const template = normalized.includes("website") || normalized.includes("desti")
      ? DEMO_PARSED[0]
      : normalized.includes("receipt") || normalized.includes("settlement")
        ? DEMO_PARSED[1]
        : normalized.includes("medicine") || normalized.includes("apotik")
          ? DEMO_PARSED[2]
          : DEMO_PARSED[index % DEMO_PARSED.length];
    const hasAssignee = normalized.includes("bu desti") || normalized.includes("manager") || normalized.includes("team");
    const hasDate = /mon|tue|wed|thu|fri|sat|sun|today|tomorrow|monday|tuesday|wednesday|thursday|friday/i.test(line);
    const inferredOrg: OrgName = normalized.includes("apotik") || normalized.includes("medicine")
      ? "Apotik"
      : normalized.includes("bank") || normalized.includes("personal")
        ? "Personal"
        : template.org;

    return {
      ...template,
      org: inferredOrg,
      title: template.title,
      originalText: line,
      assignee: hasAssignee ? template.assignee : undefined,
      deadline: hasDate ? template.deadline : undefined,
      uncertain: [
        ...(hasAssignee ? [] : ["assignee" as const]),
        ...(hasDate ? [] : ["deadline" as const]),
      ],
    };
  });
}

function QuickCapture() {
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previews, setPreviews] = useState<InlineCapturePreview[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [attachments, setAttachments] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  function resetCapture(messageText?: string) {
    setInput("");
    setPreviews([]);
    setEditing(null);
    setSaved(new Set());
    setAttachments([]);
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
      setPreviews(createCapturePreviews(input));
      setSaved(new Set());
      setProcessing(false);
    }, 700);
  }

  function updatePreview(index: number, patch: Partial<InlineCapturePreview>) {
    setPreviews(current => current.map((preview, previewIndex) => previewIndex === index ? { ...preview, ...patch } : preview));
  }

  function save(index: number) {
    setSaved(current => new Set([...current, index]));
    setEditing(null);
  }

  function saveAll() {
    setSaved(new Set(previews.map((_, index) => index)));
    setTimeout(() => resetCapture(previews.length === 1 ? "Saved to your workspace." : `${previews.length} items saved to your workspace.`), 650);
  }

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    setAttachments(current => [...current, ...Array.from(files).map(file => file.name)].slice(0, 4));
  }

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-[#d9d6f6] bg-[#eae6ff]/60 p-4 shadow-[0_10px_28px_rgb(35_41_61_/_0.055)] sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#ffffff]/75 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-24 h-16 w-16 rounded-full bg-[#dcede7] blur-xl" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
            <div>
              <h2 className="luma-heading text-[15px] font-bold text-foreground">Quick Capture</h2>
              <p className="text-[11px] text-muted-foreground">A thought is enough. Luma handles the structure.</p>
            </div>
          </div>
          {message && <span role="status" aria-live="polite" className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">{message}</span>}
        </div>
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          rows={previews.length ? 2 : 3}
          placeholder="What do you need to remember or do?"
          className="w-full resize-none rounded-2xl border border-[#ddd9f3] bg-white/90 px-3.5 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground/80 focus:border-primary/45"
        />
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((attachment, index) => <span key={`${attachment}-${index}`} className="rounded-full bg-white px-2 py-1 text-[10px] text-muted-foreground shadow-sm">{attachment}</span>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Attach file
            <input className="sr-only" type="file" multiple onChange={event => addAttachments(event.target.files)} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground">
            <ImagePlus className="h-3.5 w-3.5" /> Screenshot
            <input className="sr-only" type="file" accept="image/*" multiple onChange={event => addAttachments(event.target.files)} />
          </label>
          <span className="inline-flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Paste a link anytime</span>
          <button onClick={organize} disabled={!input.trim() || processing} className={cn("ml-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition-colors", input.trim() && !processing ? "bg-primary text-primary-foreground hover:bg-primary/85" : "cursor-not-allowed bg-white/65 text-muted-foreground") }>
            <Sparkles className="h-3.5 w-3.5" /> {processing ? "Organizing…" : "Organize with AI"}
          </button>
        </div>
        {previews.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-[#e2e0ef] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium text-secondary-foreground">Here’s what Luma understood.</p>
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
                      {preview.uncertain.length > 0 && !isSaved && <p className="mt-2 text-[10px] text-warning">Luma needs a little help with {preview.uncertain.map(field => field === "org" ? "the organization" : field === "assignee" ? "who owns it" : "the target date").join(" and ")}.</p>}
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
                  <button onClick={() => onToggle(card.id)} aria-pressed={card.visible} className={cn("relative h-5 w-9 flex-shrink-0 rounded-full transition-colors", card.visible ? "bg-primary" : "bg-muted") }>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", card.visible ? "translate-x-4" : "translate-x-0.5")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">{meta.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{meta.description}</p>
                  </div>
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
  onTaskClick, onNavigate, onProjectClick, onOrgClick,
}: {
  onTaskClick: (task: Task) => void; onNavigate: (view: NavView) => void;
  onProjectClick: (projectId: string) => void; onOrgClick: (org: OrgName) => void;
}) {
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
      <div className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-[#e7e5e0] bg-[#fffdf9] px-5 py-6 shadow-[0_4px_18px_rgb(35_41_61_/_0.035)] sm:px-7">
        <div aria-hidden="true" className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#eae6ff] blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-0 right-32 h-20 w-20 rounded-full bg-[#dcede7] blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Monday, 12 August</p>
            <h1 className="luma-heading text-3xl font-bold text-foreground sm:text-[2rem]">Good morning, Bos.</h1>
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
          { label: "Today", value: todayTasks.length, sub: "~5h of focused work", color: "text-primary", surface: "bg-[#eae6ff]/55", icon: <CalendarDays className="w-4 h-4" /> },
          { label: "Needs attention", value: overdueTasks.length, sub: "A gentle nudge", color: "text-overdue", surface: "bg-[#f7dde6]/45", icon: <AlertTriangle className="w-4 h-4" /> },
          { label: "Delegated", value: TASKS.filter(t => t.isDelegated).length, sub: "Across your teams", color: "text-success", surface: "bg-[#dcede7]/55", icon: <Users className="w-4 h-4" /> },
          { label: "Waiting", value: TASKS.filter(t => t.isWaiting).length, sub: "For a response", color: "text-info", surface: "bg-[#ddebfa]/55", icon: <Hourglass className="w-4 h-4" /> },
        ].map(({ label, value, sub, color, surface, icon }) => (
          <div key={label} className={cn("luma-card p-4 sm:p-5", surface)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
              <span className={cn(color, "opacity-60")}>{icon}</span>
            </div>
            <p className={cn("luma-heading text-3xl font-bold", color)}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </div>
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
                        <div className="flex gap-1.5">
                          <button onClick={() => onTaskClick(t)} className="rounded-lg bg-success/10 px-3 py-1.5 text-[11px] font-medium text-success transition-colors hover:bg-success/15">Approve</button>
                          <button onClick={() => onTaskClick(t)} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary">Review</button>
                        </div>
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
                      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
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
    setTimeout(() => { setProcessing(false); setParsed(createCapturePreviews(input)); }, 700);
  }

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Smart Inbox</p>
        <h1 className="luma-heading text-3xl font-bold text-foreground">A place to set it down.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Bring the whole brain dump. Luma will help organize the next step.</p>
      </div>
      <div className="luma-card mb-6 overflow-hidden focus-within:border-primary/40">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder={"Dump anything you need to remember or do…\n\nTry: \"ask Bu Desti to check website prices by Wednesday https://example.com\"\nOr: \"fix purchasing receipt flow because finance needs to calculate money return\""}
          className="min-h-[180px] w-full resize-none bg-transparent p-5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground sm:p-6" />
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-1">
            {[{ icon: <Paperclip className="w-3.5 h-3.5" />, label: "File" }, { icon: <Link2 className="w-3.5 h-3.5" />, label: "Link" }, { icon: <FileText className="w-3.5 h-3.5" />, label: "Doc" }].map(({ icon, label }) => (
              <button key={label} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">{icon} {label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {input && <span className="text-[11px] font-mono text-muted-foreground">{input.length} chars</span>}
            <button onClick={handleProcess} disabled={!input.trim() || processing}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                input.trim() && !processing ? "bg-primary text-primary-foreground hover:bg-primary/85" : "cursor-not-allowed bg-muted text-muted-foreground")}>
              {processing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Organizing…</> : <><Sparkles className="w-3.5 h-3.5" />Organize with Luma</>}
            </button>
          </div>
        </div>
      </div>
      {processing && (
        <div className="luma-card mb-6 border-primary/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Luma is organizing your notes…</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Luma found {parsed.length} tasks</p>
            <button onClick={() => setConfirmed(new Set(parsed.map((_, i) => i)))} className="text-[11px] text-primary hover:text-primary/80 transition-colors">Confirm All</button>
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
                        <p className="text-sm font-medium text-foreground">{pt.title}</p>
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
                  style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}>
                  {getInitials(person)}
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-foreground">{person}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{tasks.length} active · Last update: {tasks[0]?.lastUpdate || "Unknown"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {overdue > 0 && <span className="rounded-full bg-overdue/10 px-2 py-1 text-[10px] font-medium text-overdue">{overdue} to revisit</span>}
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{tasks.length} tasks</span>
                  <button className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><Send className="w-3.5 h-3.5" /></button>
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
  const reviewTasks = TASKS.filter(t => t.status === "review" && t.nextActionBy === "me");
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
                    {task.links.map((l, i) => (
                      <a key={i} href={l.url} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border text-[11px] text-sky-400 hover:text-sky-300 transition-colors">
                        <LinkIcon type={l.type} />{l.label}
                      </a>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 rounded-xl bg-success/10 px-4 py-2 text-[13px] font-medium text-success transition-colors hover:bg-success/15"><Check className="w-4 h-4" /> Approve</button>
                  <button className="flex items-center gap-1.5 rounded-xl bg-warning/10 px-4 py-2 text-[13px] font-medium text-warning transition-colors hover:bg-warning/15"><RotateCcw className="w-4 h-4" /> Request Revision</button>
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
  return (
    <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10">
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
    <div className="h-full overflow-auto p-5 sm:p-8 lg:p-10">
      <div className="mb-6">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Week of 12 Aug</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>This Week</h1>
      </div>
      <div className="overflow-x-auto pb-2">
      <div className="grid min-h-[400px] min-w-[58rem] grid-cols-[repeat(5,minmax(10rem,1fr))] gap-4">
        {DAYS.map((day, index) => {
          const tasks = WEEK_TASKS[day] || [];
          const isToday = day === "Mon 12";
          const tint = ["bg-[#eae6ff]/60", "bg-[#dcede7]/60", "bg-[#ddebfa]/60", "bg-[#f8e3d3]/55", "bg-[#f5e7b8]/45"][index];
          return (
            <div key={day} className={cn("luma-board-column flex flex-col", tint, isToday && "border-primary/45 shadow-[0_8px_22px_rgb(142_148_242_/_0.10)]")}>
              <div className={cn("border-b px-2 pb-3", isToday ? "border-primary/25" : "border-border/75")}>
                <p className={cn("text-[12px] font-semibold", isToday ? "text-primary" : "text-foreground")}>{day}</p>
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

type QuickFilter = "mine" | "delegated" | "no-deadline" | "due-soon" | "overdue" | "waiting" | "completed" | null;
type SortBy = "deadline" | "priority" | "updated" | "org";

function AllTasksView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const [search, setSearch] = useState("");
  const [qf, setQf] = useState<QuickFilter>(null);
  const [ownershipTab, setOwnershipTab] = useState<"all" | "mine" | "delegated" | "waiting" | "done">("all");
  const [taskLayout, setTaskLayout] = useState<"list" | "board">("list");
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
    if (ownershipTab === "mine" && t.nextActionBy !== "me") return false;
    if (ownershipTab === "delegated" && !t.isDelegated) return false;
    if (ownershipTab === "waiting" && !t.isWaiting) return false;
    if (ownershipTab === "done" && t.status !== "done") return false;
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
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Master List</p>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>All Tasks</h1>
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
            <button className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/85">
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
        {/* Quick filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {quickFilters.map(f => (
            <button key={f.id} onClick={() => setQf(qf === f.id ? null : f.id)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border",
                qf === f.id
                  ? f.id === "overdue" ? "border-overdue/25 bg-overdue/10 text-overdue" : "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground")}>
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

function PersonDetailView({ personName, onBack, onTaskClick }: { personName: string; onBack: () => void; onTaskClick: (t: Task) => void }) {
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
    { label: "Today", value: orgTasks.filter(t => t.isToday).length, color: "text-primary" },
    { label: "This Week", value: orgTasks.length, color: "text-foreground" },
    { label: "Dates to revisit", value: orgTasks.filter(t => t.isOverdue).length, color: "text-overdue" },
    { label: "Waiting", value: orgTasks.filter(t => t.isWaiting).length, color: "text-info" },
    { label: "Delegated", value: orgTasks.filter(t => t.isDelegated).length, color: "text-success" },
    { label: "Review", value: orgTasks.filter(t => t.status === "review").length, color: "text-review" },
  ];

  return (
    <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10">
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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="luma-card p-4 text-center">
            <p className={cn("text-2xl font-bold", color)} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Areas + Tasks */}
        <div className="space-y-5 lg:col-span-2">
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
            <div className="luma-card overflow-hidden">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {orgPeople.map(person => {
                  const pc = getPersonColor(person.name);
                  return (
                    <div key={person.name} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.025]">
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
                      className="luma-card luma-card-hover group w-full p-4 text-left">
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
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/25 hover:bg-primary/[0.025]">
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
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-warning">Needs attention</p>
              <div className="space-y-1.5">
                {orgTasks.filter(t => t.isOverdue || t.status === "review").map(t => (
                  <button key={t.id} onClick={() => onTaskClick(t)}
                    className="w-full rounded-xl border border-warning/15 bg-warning/[0.04] p-2.5 text-left transition-colors hover:border-warning/25">
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={t.priority} />
                      <p className="text-[12px] text-foreground truncate flex-1">{t.title}</p>
                      {t.isOverdue && <span className="flex-shrink-0 text-[10px] text-overdue">Due</span>}
                      {t.status === "review" && <span className="flex-shrink-0 text-[10px] text-review">Review</span>}
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
              {detail.resources.map((r, i) => (
                <a key={i} href={r.url}
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/25 hover:bg-primary/[0.025]">
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
                    <Sparkles className="w-3.5 h-3.5" />Draft with Luma
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
                    <span className="text-[11px] font-medium text-primary">Luma suggested message</span>
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
    <div className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Portfolio</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Organizations</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORGS_META.map(org => {
          const c = ORG_COLORS[org.name];
          const orgTasks = TASKS.filter(t => t.org === org.name);
          const overdue = orgTasks.filter(t => t.isOverdue).length;
          return (
            <button key={org.name} onClick={() => onOrgClick(org.name)}
              className="luma-card luma-card-hover group overflow-hidden text-left">
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
    <div className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Long-term</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Projects</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {STRATEGIC_PROJECTS.map(proj => {
          const c = ORG_COLORS[proj.org];
          const projTasks = TASKS.filter(t => t.project === proj.name);
          const detail = PROJECT_DETAILS[proj.id];
          return (
            <button key={proj.id} onClick={() => onProjectClick(proj.id)}
              className="luma-card luma-card-hover group overflow-hidden text-left">
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
    label: "Home",
    items: [{ id: "home" as NavView, label: "Home", icon: <Home className="w-4 h-4" /> }]
  },
  {
    label: "Plan",
    items: [
      { id: "today" as NavView, label: "Today", icon: <CalendarDays className="w-4 h-4" />, badge: TASKS.filter(t => t.isToday && t.nextActionBy === "me").length },
      { id: "this-week" as NavView, label: "This Week", icon: <Calendar className="w-4 h-4" /> },
      { id: "all-tasks" as NavView, label: "All Tasks", icon: <ListTodo className="w-4 h-4" /> },
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

function LumaMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-[#eeecff] text-[18px] font-bold text-primary shadow-[0_4px_10px_rgb(141_137_203_/_0.16)]">
        <span className="luma-heading -mt-px">L</span>
        <Sparkles aria-hidden="true" className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-[#b6aeeb]" />
      </div>
      {!compact && <div><p className="luma-heading text-[17px] font-bold text-foreground">Luma</p><p className="-mt-0.5 text-[10px] text-muted-foreground">Make space for what matters.</p></div>}
    </div>
  );
}

function Sidebar({ view, onNav, className, onNavigate }: { view: NavView; onNav: (v: NavView) => void; className?: string; onNavigate?: () => void }) {
  const activeView = (["org-detail", "person-detail", "project-detail"].includes(view))
    ? (view === "org-detail" ? "organizations" : view === "project-detail" ? "projects" : "people") as NavView
    : view;
  const choose = (target: NavView) => {
    onNav(target);
    onNavigate?.();
  };

  return (
    <aside className={cn("flex h-dvh w-[17rem] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar", className)}>
      <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-5">
        <LumaMark />
        <button onClick={() => choose("search")} aria-label="Search your workspace" className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"><Search className="h-4 w-4" /></button>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && (
              <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>
            )}
            {group.items.map((item: { id: NavView; label: string; icon: ReactNode; badge?: number; urgent?: boolean; highlight?: boolean }) => {
              const isActive = activeView === item.id;
              return (
                <button key={item.id} onClick={() => choose(item.id)}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200",
                    isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[0_2px_8px_rgb(92_85_153_/_0.06)]" : "text-sidebar-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
                    item.highlight && !isActive && "text-primary"
                  )}>
                  <span className={cn("flex-shrink-0", isActive ? "text-primary" : "opacity-65")}>{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={cn("min-w-[19px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-medium",
                      item.urgent ? "bg-overdue/10 text-overdue" : isActive ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent/60">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff5d9] text-[11px] font-bold text-warning">BO</div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground truncate">Bos</p>
            <p className="text-[10px] text-muted-foreground">Owner</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function LumaApp() {
  const [view, setView] = useState<NavView>("home");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgName | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  function navTo(v: NavView, opts?: { org?: OrgName; project?: string; person?: string }) {
    setView(v);
    setSelectedTask(null);
    if (opts?.org !== undefined) setSelectedOrg(opts.org);
    if (opts?.project !== undefined) setSelectedProject(opts.project);
    if (opts?.person !== undefined) setSelectedPerson(opts.person);
  }

  function renderView() {
    switch (view) {
      case "home": return <HomeView onTaskClick={setSelectedTask} onNavigate={navTo} onProjectClick={project => navTo("project-detail", { project })} onOrgClick={org => navTo("org-detail", { org })} />;
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
      default: return <HomeView onTaskClick={setSelectedTask} onNavigate={navTo} onProjectClick={project => navTo("project-detail", { project })} onOrgClick={org => navTo("org-detail", { org })} />;
    }
  }

  const isFullHeight = view === "all-tasks";

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar className="hidden lg:flex" view={view} onNav={v => navTo(v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-sidebar/90 px-4 backdrop-blur-sm lg:hidden">
          <button aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)} className="rounded-xl p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><Menu className="h-5 w-5" /></button>
          <LumaMark compact />
          <button aria-label="Search your workspace" onClick={() => navTo("search")} className="rounded-xl p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><Search className="h-5 w-5" /></button>
        </header>
        <main className={cn("min-h-0 flex-1 overflow-hidden", isFullHeight ? "flex flex-col" : "overflow-y-auto")}>
          {renderView()}
        </main>
      </div>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-[#293047]/15 backdrop-blur-[1px]" />
          <Sidebar className="relative z-10 !flex shadow-[16px_0_40px_rgb(38_48_71_/_0.12)]" view={view} onNav={v => navTo(v)} onNavigate={() => setMobileMenuOpen(false)} />
        </div>
      )}
      {selectedTask && <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
