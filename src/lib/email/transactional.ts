export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  sent: boolean;
  provider: "resend" | "disabled";
  messageId?: string;
  error?: string;
};

/**
 * Minimal provider abstraction with no SDK dependency. Production can use
 * Resend through its HTTPS API; local/test environments fail open into a
 * manual-delivery result so account provisioning never exposes a password.
 */
export async function sendTransactionalEmail(message: TransactionalEmail): Promise<EmailDeliveryResult> {
  const provider = String(process.env.EMAIL_PROVIDER ?? "disabled").toLowerCase();
  if (provider !== "resend") {
    return { sent: false, provider: "disabled", error: "EMAIL_PROVIDER is not configured" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false, provider: "resend", error: "RESEND_API_KEY or EMAIL_FROM is missing" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) {
      return { sent: false, provider: "resend", error: body.message || `Email provider returned ${response.status}` };
    }
    return { sent: true, provider: "resend", messageId: body.id };
  } catch (error) {
    return { sent: false, provider: "resend", error: error instanceof Error ? error.message : "EMAIL_DELIVERY_FAILED" };
  }
}
