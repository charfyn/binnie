"use server";

import { z } from "zod";
import { changeOwnPassword } from "@/lib/account-provisioning";

export type CreatePasswordState = { message: string; ok?: boolean };

export async function createPasswordAction(_previous: CreatePasswordState, formData: FormData): Promise<CreatePasswordState> {
  const parsed = z.object({
    password: z.string().min(8).max(128),
    confirmation: z.string().min(8).max(128),
  }).safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { message: "Use a password with at least 8 characters." };
  if (parsed.data.password !== parsed.data.confirmation) return { message: "The passwords do not match." };
  const result = await changeOwnPassword({ password: parsed.data.password });
  return result.ok ? { message: "Password saved.", ok: true } : { message: result.message };
}
