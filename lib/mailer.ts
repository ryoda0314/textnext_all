import "server-only";
import { createTransport, type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;

/** SMTP transport from SMTP_URL (e.g. smtp://user:pass@smtp.example.com:587). Null when not configured. */
export function getMailer() {
  if (transport !== undefined) return transport;
  transport = process.env.SMTP_URL ? createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export async function sendMail(to: string, subject: string, text: string) {
  const mailer = getMailer();
  if (!mailer) return false;
  await mailer.sendMail({ from: process.env.MAIL_FROM ?? "TextNext <no-reply@localhost>", to, subject, text });
  return true;
}
