"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  approveInvitation,
  cancelInvitation,
  createBinnieAccount,
  createDirectoryPerson,
  rejectInvitation,
  removeBinnieAccess,
  removeOrganizationMembership,
  requestBinnieAccess,
  suspendUserAccount,
  updateOrganizationAccess,
} from "@/data/access";
import { changeBinnieUsername, resetBinniePassword } from "@/lib/account-provisioning";

const id = z.string().min(1).max(128);
const accessLevel = z.enum(["OWNER", "ORGANIZATION_MANAGER", "DEPARTMENT_HEAD", "MEMBER", "VIEWER"]);

function invalid(message: string) {
  return { ok: false as const, code: "VALIDATION" as const, message };
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/people/access");
}

export async function createDirectoryPersonAction(raw: unknown) {
  const parsed = z.object({
    name: z.string().trim().min(1).max(240),
    contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
    jobTitle: z.string().trim().max(240).optional(),
    organizationId: id,
    departmentIds: z.array(id).max(20).default([]),
    teamIds: z.array(id).max(20).default([]),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Name, organization, and valid membership details are required.");
  const result = await createDirectoryPerson({ ...parsed.data, contactEmail: parsed.data.contactEmail || undefined });
  if (result.ok) refresh();
  return result;
}

export async function requestBinnieAccessAction(raw: unknown) {
  const parsed = z.object({ personId: id, organizationId: id, requestedAccessLevel: accessLevel, requestedUsername: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a person, organization, access level, and username.");
  const result = await requestBinnieAccess(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function approveInvitationAction(raw: unknown) {
  const parsed = z.object({ invitationId: id, approvedAccessLevel: accessLevel, approvedUsername: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid request, access level, and username.");
  const result = await approveInvitation(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function rejectInvitationAction(raw: unknown) {
  const parsed = z.object({ invitationId: id, reason: z.string().trim().max(1_000).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("The rejection note is too long.");
  const result = await rejectInvitation(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function createBinnieAccountAction(raw: unknown) {
  const parsed = z.object({ personId: id, organizationId: id, accessLevel, username: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid person, organization, access level, and username.");
  const result = await createBinnieAccount(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function cancelInvitationAction(raw: unknown) {
  const parsed = z.object({ invitationId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid invitation.");
  const result = await cancelInvitation(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function resetBinniePasswordAction(raw: unknown) {
  const parsed = z.object({ personId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid account.");
  const result = await resetBinniePassword(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function changeBinnieUsernameAction(raw: unknown) {
  const parsed = z.object({ personId: id, username: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid account and username.");
  const result = await changeBinnieUsername(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function updateOrganizationAccessAction(raw: unknown) {
  const parsed = z.object({ personId: id, organizationId: id, accessLevel }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid access level.");
  const result = await updateOrganizationAccess(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function suspendUserAccountAction(raw: unknown) {
  const parsed = z.object({ personId: id, suspend: z.boolean() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid account.");
  const result = await suspendUserAccount(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function removeBinnieAccessAction(raw: unknown) {
  const parsed = z.object({ personId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid account.");
  const result = await removeBinnieAccess(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function removeOrganizationMembershipAction(raw: unknown) {
  const parsed = z.object({ personId: id, organizationId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid organization membership.");
  const result = await removeOrganizationMembership(parsed.data);
  if (result.ok) refresh();
  return result;
}
