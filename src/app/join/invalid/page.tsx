import { redirect } from "next/navigation";

/** Legacy magic-link endpoint retired with username/password authentication. */
export default function LegacyInvalidInvitationPage() {
  redirect("/login");
}
