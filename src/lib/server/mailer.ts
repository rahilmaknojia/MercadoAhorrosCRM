import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Transactional email via AWS SES (SESv2). Credentials come from the default AWS
// provider chain (env or IAM role). Configure with AWS_REGION, SES_FROM_EMAIL,
// optional SES_FROM_NAME. No-ops with a warning when SES_FROM_EMAIL is unset so the
// CRM still runs without SES configured.
const region = process.env.AWS_REGION || process.env.SES_REGION || "us-east-1";
const fromEmail = process.env.SES_FROM_EMAIL || "";
const fromName = process.env.SES_FROM_NAME || "Mercado Ahorros";

let client: SESv2Client | null = null;
function getClient(): SESv2Client {
  if (!client) client = new SESv2Client({ region });
  return client;
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = input.to.map((t) => t.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false, error: "No recipients." };
  if (!fromEmail) {
    console.warn(`[mailer] SES_FROM_EMAIL not set; skipping "${input.subject}" to ${to.join(", ")}`);
    return { ok: false, error: "Email is not configured (SES_FROM_EMAIL)." };
  }
  try {
    await getClient().send(
      new SendEmailCommand({
        FromEmailAddress: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        Destination: { ToAddresses: to },
        Content: {
          Simple: {
            Subject: { Data: input.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: input.html, Charset: "UTF-8" },
              ...(input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {}),
            },
          },
        },
      })
    );
    return { ok: true };
  } catch (error) {
    console.error("[mailer] send failed", error);
    return { ok: false, error: "Failed to send email." };
  }
}
