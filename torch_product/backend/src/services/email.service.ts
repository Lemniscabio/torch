import { Resend } from "resend";
import { env } from "../config/env";

let resend: Resend | null = null;

function getResendClient() {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const client = getResendClient();

  if (!client) {
    console.log(`[password-reset] ${email}: ${resetUrl}`);
    return;
  }

  await client.emails.send({
    from: env.AUTH_EMAIL_FROM,
    to: email,
    subject: "Reset your Torch password",
    text: [
      "Reset your Torch password",
      "",
      "Use the link below to choose a new password. This link expires soon.",
      "",
      resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b">
        <h1 style="font-size:22px;margin:0 0 12px">Reset your Torch password</h1>
        <p>Use the link below to choose a new password. This link expires soon.</p>
        <p>
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px">
            Reset password
          </a>
        </p>
        <p style="color:#71717a;font-size:14px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
