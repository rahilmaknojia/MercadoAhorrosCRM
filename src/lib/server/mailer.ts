import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Transactional email via AWS SES (SESv2). Configure with SES_REGION (or AWS_REGION),
// SES_FROM_EMAIL, optional SES_FROM_NAME. No-ops with a warning when SES_FROM_EMAIL is
// unset so the CRM still runs without SES configured.
//
// Credentials are DECOUPLED from the default AWS chain: DigitalOcean Spaces consumes
// the generic AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY pair, so SES uses its own
// dedicated SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY. If those are unset we fall back
// to the default AWS provider chain (so an IAM role still works without DO Spaces).
const region = process.env.SES_REGION || process.env.AWS_REGION || "us-east-1";
const fromEmail = process.env.SES_FROM_EMAIL || "";
const fromName = process.env.SES_FROM_NAME || "Mercado Ahorros";

const sesAccessKeyId = process.env.SES_ACCESS_KEY_ID;
const sesSecretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
const sesCredentials =
  sesAccessKeyId && sesSecretAccessKey
    ? { accessKeyId: sesAccessKeyId, secretAccessKey: sesSecretAccessKey }
    : undefined;

let client: SESv2Client | null = null;
function getClient(): SESv2Client {
  if (!client) client = new SESv2Client({ region, credentials: sesCredentials });
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
