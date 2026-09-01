import "server-only";

import { Resend } from "resend";

export interface BinnieEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function sender() {
  return process.env.BINNIE_EMAIL_FROM || "Binnie <onboarding@resend.dev>";
}

/** Optional future transport for notifications and recovery, never sign-in. */
export async function sendBinnieEmail(message: BinnieEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("BINNIE_EMAIL_NOT_CONFIGURED: set RESEND_API_KEY before sending Binnie notifications.");
  }

  try {
    const result = await new Resend(apiKey).emails.send({
      from: sender(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (result.error) throw new Error(`BINNIE_EMAIL_DELIVERY_FAILED:${result.error.message}`);
    return { id: result.data?.id || "resend-accepted" };
  } catch (error) {
    throw error;
  }
}
