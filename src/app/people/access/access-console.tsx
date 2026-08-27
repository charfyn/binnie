"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AccessConsoleData } from "@/data/access";
import {
  approveInvitationAction,
  changeBinnieUsernameAction,
  createBinnieAccountAction,
  createDirectoryPersonAction,
  rejectInvitationAction,
  removeBinnieAccessAction,
  removeOrganizationMembershipAction,
  requestBinnieAccessAction,
  resetBinniePasswordAction,
  suspendUserAccountAction,
  updateOrganizationAccessAction,
} from "./actions";

const accessLevels = ["MEMBER", "VIEWER", "DEPARTMENT_HEAD", "ORGANIZATION_MANAGER", "OWNER"] as const;
const managerRequestLevels = ["MEMBER", "VIEWER", "DEPARTMENT_HEAD"] as const;

function label(value: string) {
  return value.split("_").map((word) => word[0] + word.slice(1).toLowerCase()).join(" ");
}

function accountLabel(person: AccessConsoleData["people"][number]) {
  if (person.accessRequestStatus === "PENDING_OWNER_APPROVAL") return "Pending Owner Review";
  if (person.accountStatus === "PERSON_ONLY") return "Person only";
  if (person.accountStatus === "SUSPENDED") return "Suspended";
  if (person.accountStatus === "ACCESS_REMOVED") return "Access removed";
  if (person.requiresPasswordChange) return "Password reset required";
  return "Active";
}

function suggestedUsername(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_.]+/g, "").slice(0, 30) || "member";
}

type AccountTarget = { personId: string; personName: string; organizationId: string; organizationName: string };
type CredentialReveal = { personName: string; username: string; temporaryPassword: string };

async function save(setMessage: (message: string) => void, action: () => Promise<{ ok: boolean; message?: string }>) {
  setMessage("");
  const result = await action();
  setMessage(result.ok ? "Saved." : result.message || "That change could not be saved.");
  return result;
}

export default function AccessConsole({ initialData }: { initialData: AccessConsoleData }) {
  const [message, setMessage] = useState("");
  const [organizationId, setOrganizationId] = useState(initialData.organizations[0]?.id || "");
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [requestLevel, setRequestLevel] = useState<Record<string, string>>({});
  const [requestUsername, setRequestUsername] = useState<Record<string, string>>({});
  const [approvalLevel, setApprovalLevel] = useState<Record<string, string>>({});
  const [approvalUsername, setApprovalUsername] = useState<Record<string, string>>({});
  const [accountTarget, setAccountTarget] = useState<AccountTarget | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountLevel, setAccountLevel] = useState("MEMBER");
  const [credentialReveal, setCredentialReveal] = useState<CredentialReveal | null>(null);
  const selectedOrganization = useMemo(() => initialData.organizations.find((organization) => organization.id === organizationId), [initialData.organizations, organizationId]);
  const pendingApprovals = initialData.invitations.filter((request) => request.status === "PENDING_OWNER_APPROVAL");

  function toggle(values: string[], value: string, setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function openCreateAccount(target: AccountTarget) {
    setAccountTarget(target);
    setAccountUsername(suggestedUsername(target.personName));
    setAccountLevel("MEMBER");
  }

  async function addPerson() {
    const result = await save(setMessage, async () => createDirectoryPersonAction({ name, contactEmail, jobTitle, organizationId, departmentIds, teamIds }));
    if (result.ok) {
      setName(""); setContactEmail(""); setJobTitle(""); setDepartmentIds([]); setTeamIds([]);
    }
  }

  async function createAccount() {
    if (!accountTarget) return;
    const result = await createBinnieAccountAction({ personId: accountTarget.personId, organizationId: accountTarget.organizationId, accessLevel: accountLevel, username: accountUsername });
    if (result.ok && "data" in result) {
      setCredentialReveal({ personName: accountTarget.personName, username: result.data.username, temporaryPassword: result.data.temporaryPassword });
      setAccountTarget(null);
      setMessage("Account created. Share the temporary password securely; it cannot be viewed again.");
    } else setMessage(result.message || "That account could not be created.");
  }

  async function approveRequest(request: AccessConsoleData["invitations"][number]) {
    const result = await approveInvitationAction({
      invitationId: request.id,
      approvedAccessLevel: approvalLevel[request.id] || request.requestedAccessLevel,
      approvedUsername: approvalUsername[request.id] || request.requestedUsername || suggestedUsername(request.personName),
    });
    if (result.ok && "data" in result) {
      setCredentialReveal({ personName: request.personName, username: result.data.username, temporaryPassword: result.data.temporaryPassword });
      setMessage("Account approved and created. Share the temporary password securely; it cannot be viewed again.");
    } else setMessage(result.message || "That request could not be approved.");
  }

  return <main className="min-h-dvh bg-background px-5 py-7 text-foreground sm:px-8 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">People</p><h1 className="binnie-heading mt-1 text-3xl font-bold">People &amp; access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Directory affiliation is separate from Binnie accounts. An account is linked to this existing Person—never a duplicate profile.</p></div>
        <Link href="/" className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-primary">Back to workspace</Link>
      </div>
      {message ? <p role="status" className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-foreground">{message}</p> : null}

      {initialData.isOwner ? <section className="mb-6 rounded-[1.25rem] border border-review/25 bg-review/[0.05] p-5"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-review">Needs my review</p><h2 className="mt-1 text-lg font-semibold">{pendingApprovals.length} account access request{pendingApprovals.length === 1 ? "" : "s"}</h2>{pendingApprovals.length ? <div className="mt-4 space-y-3">{pendingApprovals.map((request) => <article key={request.id} className="rounded-xl border border-border bg-card p-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-sm font-semibold">{request.personName}</p><p className="mt-1 text-[12px] text-muted-foreground">{request.organizationName} · Requested {label(request.requestedAccessLevel)} · Added by {request.requestedByName}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-muted-foreground">Username<input value={approvalUsername[request.id] || request.requestedUsername || suggestedUsername(request.personName)} onChange={(event) => setApprovalUsername((current) => ({ ...current, [request.id]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground" /></label><label className="text-[11px] text-muted-foreground">Approved access<select value={approvalLevel[request.id] || request.requestedAccessLevel} onChange={(event) => setApprovalLevel((current) => ({ ...current, [request.id]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground">{accessLevels.filter((level) => level !== "OWNER").map((level) => <option key={level} value={level}>{label(level)}</option>)}</select></label></div></div><div className="flex flex-wrap gap-2"><button onClick={() => void approveRequest(request)} className="rounded-lg bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground">Edit &amp; approve</button><button onClick={() => { const reason = window.prompt("Reason (optional)") || undefined; void save(setMessage, async () => rejectInvitationAction({ invitationId: request.id, reason })); }} className="rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground">Reject</button></div></div></article>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No account requests are waiting for review.</p>}</section> : null}

      <section className="mb-6 rounded-[1.25rem] border border-border bg-card p-5"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Add person</p><h2 className="mt-1 text-lg font-semibold">Keep the directory current</h2><p className="mt-1 text-[12px] text-muted-foreground">This creates a Person and organization, department, and team affiliations. It does not create login access.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[12px] font-medium text-muted-foreground">Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label><label className="text-[12px] font-medium text-muted-foreground">Contact email <span className="font-normal">(optional)</span><input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@company.com" type="email" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label><label className="text-[12px] font-medium text-muted-foreground">Job title <span className="font-normal">(optional)</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Marketing coordinator" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground" /></label><label className="text-[12px] font-medium text-muted-foreground">Organization<select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setDepartmentIds([]); setTeamIds([]); }} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">{initialData.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></div>{selectedOrganization ? <div className="mt-4 grid gap-4 md:grid-cols-2"><fieldset><legend className="text-[12px] font-medium text-muted-foreground">Departments</legend><div className="mt-2 flex flex-wrap gap-2">{selectedOrganization.departments.map((department) => <label key={department.id} className="cursor-pointer rounded-full border border-border bg-background px-2.5 py-1.5 text-[11px]"><input className="mr-1.5" type="checkbox" checked={departmentIds.includes(department.id)} onChange={() => toggle(departmentIds, department.id, setDepartmentIds)} />{department.name}</label>)}</div></fieldset><fieldset><legend className="text-[12px] font-medium text-muted-foreground">Teams</legend><div className="mt-2 flex flex-wrap gap-2">{selectedOrganization.teams.map((team) => <label key={team.id} className="cursor-pointer rounded-full border border-border bg-background px-2.5 py-1.5 text-[11px]"><input className="mr-1.5" type="checkbox" checked={teamIds.includes(team.id)} onChange={() => toggle(teamIds, team.id, setTeamIds)} />{team.name}</label>)}</div></fieldset></div> : null}<button disabled={!name.trim() || !organizationId} onClick={() => void addPerson()} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-45">Add person</button></section>

      <section className="mb-6 rounded-[1.25rem] border border-border bg-card p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Organizations</p><h2 className="mt-1 text-lg font-semibold">People &amp; access</h2></div><p className="text-[12px] text-muted-foreground">{initialData.organizations.reduce((total, organization) => total + organization.peopleCount, 0)} people · {initialData.organizations.reduce((total, organization) => total + organization.activeUserCount, 0)} Binnie users · {initialData.organizations.reduce((total, organization) => total + organization.pendingApprovalCount, 0)} pending approval</p></div><div className="mt-4 grid gap-3 md:grid-cols-2">{initialData.organizations.map((organization) => <article key={organization.id} className="rounded-xl border border-border bg-muted/20 p-4"><p className="font-semibold">{organization.name}</p><p className="mt-1 text-[12px] text-muted-foreground">{organization.peopleCount} People · {organization.activeUserCount} Binnie users · {organization.pendingApprovalCount} pending approval</p></article>)}</div></section>

      <section className="rounded-[1.25rem] border border-border bg-card p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Directory</p><h2 className="mt-1 text-lg font-semibold">Members</h2></div><p className="text-[12px] text-muted-foreground">{initialData.people.length} visible people</p></div><div className="mt-4 space-y-3">{initialData.people.map((person) => <article key={person.id} className="rounded-xl border border-border p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{person.name}</p><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{accountLabel(person)}</span>{person.username ? <span className="text-[11px] text-muted-foreground">@{person.username}</span> : null}</div><p className="mt-1 text-[12px] text-muted-foreground">{[person.jobTitle, person.contactEmail].filter(Boolean).join(" · ") || "Directory person"}</p><div className="mt-3 space-y-1.5">{person.memberships.map((membership) => <p key={membership.organizationId} className="text-[12px] text-muted-foreground"><span className="font-medium text-foreground">{membership.organizationName}</span>{membership.departments.length ? ` · ${membership.departments.map((department) => department.name).join(", ")}` : ""}{membership.teams.length ? ` · ${membership.teams.map((team) => team.name).join(", ")}` : ""}{membership.accessLevel ? ` · ${label(membership.accessLevel)}` : " · Person only"}</p>)}</div></div><div className="flex flex-wrap items-center gap-2">{person.memberships.map((membership) => <div key={membership.organizationId} className="flex flex-wrap items-center gap-2">{initialData.isOwner && person.accountStatus !== "PERSON_ONLY" && membership.accessLevel ? <select aria-label={`Access level for ${person.name} in ${membership.organizationName}`} value={membership.accessLevel} onChange={(event) => void save(setMessage, async () => updateOrganizationAccessAction({ personId: person.id, organizationId: membership.organizationId, accessLevel: event.target.value }))} className="rounded-lg border border-border bg-background px-2 py-2 text-[11px]">{accessLevels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select> : null}{person.accountStatus === "PERSON_ONLY" ? initialData.isOwner ? <button onClick={() => openCreateAccount({ personId: person.id, personName: person.name, organizationId: membership.organizationId, organizationName: membership.organizationName })} className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary">Create Binnie Account</button> : <><input value={requestUsername[`${person.id}:${membership.organizationId}`] || suggestedUsername(person.name)} onChange={(event) => setRequestUsername((current) => ({ ...current, [`${person.id}:${membership.organizationId}`]: event.target.value }))} aria-label={`Requested username for ${person.name}`} className="w-28 rounded-lg border border-border bg-background px-2 py-2 text-[11px]" /><select aria-label={`Requested access for ${person.name}`} value={requestLevel[`${person.id}:${membership.organizationId}`] || "MEMBER"} onChange={(event) => setRequestLevel((current) => ({ ...current, [`${person.id}:${membership.organizationId}`]: event.target.value }))} className="rounded-lg border border-border bg-background px-2 py-2 text-[11px]">{managerRequestLevels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select><button onClick={() => void save(setMessage, async () => requestBinnieAccessAction({ personId: person.id, organizationId: membership.organizationId, requestedAccessLevel: requestLevel[`${person.id}:${membership.organizationId}`] || "MEMBER", requestedUsername: requestUsername[`${person.id}:${membership.organizationId}`] || suggestedUsername(person.name) }))} className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary">Request Binnie Access</button></> : null}{initialData.isOwner && (person.accountStatus === "ACTIVE" || person.accountStatus === "SUSPENDED") ? <><button onClick={() => void (async () => { const result = await resetBinniePasswordAction({ personId: person.id }); if (result.ok && "data" in result) { setCredentialReveal({ personName: person.name, username: result.data.username, temporaryPassword: result.data.temporaryPassword }); setMessage("Password reset. Share the temporary password securely; it cannot be viewed again."); } else setMessage(result.message || "Password reset failed."); })()} className="rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">Reset password</button><button onClick={() => { const username = window.prompt(`New username for ${person.name}`, person.username || ""); if (username) void save(setMessage, async () => changeBinnieUsernameAction({ personId: person.id, username })); }} className="rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">Change username</button></> : null}{initialData.isOwner && person.accountStatus === "ACTIVE" ? <button onClick={() => void save(setMessage, async () => suspendUserAccountAction({ personId: person.id, suspend: true }))} className="rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">Suspend</button> : null}{initialData.isOwner && person.accountStatus === "SUSPENDED" ? <button onClick={() => void save(setMessage, async () => suspendUserAccountAction({ personId: person.id, suspend: false }))} className="rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">Reactivate</button> : null}{initialData.isOwner && (person.accountStatus === "ACTIVE" || person.accountStatus === "SUSPENDED") ? <button onClick={() => { if (window.confirm(`Remove Binnie access for ${person.name}? Their Person, history, tasks, and comments remain.`)) void save(setMessage, async () => removeBinnieAccessAction({ personId: person.id })); }} className="rounded-lg border border-overdue/25 px-3 py-2 text-[11px] text-overdue">Remove access</button> : null}<button onClick={() => { if (window.confirm(`Remove ${person.name} from ${membership.organizationName}? This does not delete their Person or other organization memberships.`)) void save(setMessage, async () => removeOrganizationMembershipAction({ personId: person.id, organizationId: membership.organizationId })); }} className="rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">Remove from org</button></div>)}</div></div></article>)}</div></section>

      {initialData.invitations.some((request) => request.status === "REJECTED" || request.status === "ACCEPTED" || request.status === "CANCELLED") ? <section className="mt-6 rounded-[1.25rem] border border-border bg-card p-5"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Account request history</p><div className="mt-3 space-y-2">{initialData.invitations.filter((request) => request.status === "REJECTED" || request.status === "ACCEPTED" || request.status === "CANCELLED").map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-[12px]"><p><span className="font-medium">{request.personName}</span> · {request.organizationName} · {label(request.status)}{request.approvedUsername ? ` · @${request.approvedUsername}` : ""}{request.rejectionReason ? ` · ${request.rejectionReason}` : ""}</p></div>)}</div></section> : null}
      {initialData.isOwner && initialData.audit.length > 0 ? <section className="mt-6 rounded-[1.25rem] border border-border bg-card p-5"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Access audit history</p><div className="mt-3 space-y-2">{initialData.audit.slice(0, 20).map((entry) => <p key={entry.id} className="rounded-xl bg-muted/35 px-3 py-2 text-[12px] text-muted-foreground"><span className="font-medium text-foreground">{entry.actor || "System"}</span> {label(entry.action)} {entry.target ? `· ${entry.target}` : ""}{entry.organization ? ` · ${entry.organization}` : ""}</p>)}</div></section> : null}
    </div>
    {accountTarget ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-5"><section className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6 shadow-xl"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Create Binnie Account</p><h2 className="mt-1 text-xl font-semibold">{accountTarget.personName}</h2><p className="mt-1 text-sm text-muted-foreground">{accountTarget.organizationName}. Binnie will generate a temporary password and require a new password on first sign-in.</p><label className="mt-5 block text-sm font-medium">Username<input value={accountUsername} onChange={(event) => setAccountUsername(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></label><label className="mt-4 block text-sm font-medium">Access level<select value={accountLevel} onChange={(event) => setAccountLevel(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">{accessLevels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select></label><div className="mt-6 flex justify-end gap-2"><button onClick={() => setAccountTarget(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">Cancel</button><button onClick={() => void createAccount()} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Create Account</button></div></section></div> : null}
    {credentialReveal ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 p-5"><section className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6 shadow-xl"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Account created</p><h2 className="mt-1 text-xl font-semibold">Share this once</h2><p className="mt-2 text-sm text-muted-foreground">Give {credentialReveal.personName} these details securely. Binnie stores only a Better Auth password hash; this temporary password cannot be shown again.</p><dl className="mt-5 space-y-3 rounded-xl border border-border bg-background p-4 text-sm"><div><dt className="text-[11px] text-muted-foreground">Username</dt><dd className="mt-1 font-medium">{credentialReveal.username}</dd></div><div><dt className="text-[11px] text-muted-foreground">Temporary password</dt><dd className="mt-1 break-all font-mono font-medium">{credentialReveal.temporaryPassword}</dd></div></dl><div className="mt-5 flex justify-end gap-2"><button onClick={() => void navigator.clipboard?.writeText(`Username: ${credentialReveal.username}\nTemporary password: ${credentialReveal.temporaryPassword}`)} className="rounded-xl border border-border px-4 py-2.5 text-sm">Copy</button><button onClick={() => setCredentialReveal(null)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Done</button></div></section></div> : null}
  </main>;
}
