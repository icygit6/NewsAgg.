import nodemailer, { Transporter } from 'nodemailer'
import { logger } from '../lib/logger'

// Email delivery for password-reset / verification links.
//
// If SMTP_HOST is set we send for real over SMTP. Otherwise we fall back to a
// console transport that just logs the link — so the whole flow is fully
// testable in development with zero configuration (grep the server logs for
// "[mailer]"). Set SMTP_HOST/PORT/USER/PASS + MAIL_FROM to send real mail.
const SMTP_HOST = process.env.SMTP_HOST
const MAIL_FROM = process.env.MAIL_FROM || 'NewsAgg <no-reply@newsagg.local>'

let transporter: Transporter | null = null
if (SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT || 587)
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER.trim(), pass: (process.env.SMTP_PASS || '').replace(/\s/g, '') }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
}

export const mailerConfigured = Boolean(transporter)

function publicClientUrl(): string {
  const firstOrigin = (process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0]
  return process.env.PUBLIC_CLIENT_URL || firstOrigin || 'http://localhost:5173'
}

// Minimal branded HTML wrapper using the canonical NewsAgg navy→blue palette
// from client/src/styles/tokens.css. background-color is deliberately listed
// before the gradient so Gmail clients that strip gradients retain the brand
// blue rather than rendering a transparent CTA.
function wrap(heading: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px">${body}</p>
  <a href="${ctaUrl}" style="display:inline-block;background-color:#2563eb;background-image:linear-gradient(90deg,#173a63 0%,#2563eb 100%);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;box-shadow:0 6px 16px rgba(37,99,235,.24)">${ctaLabel}</a>
  <p style="font-size:12px;color:#94a3b8;margin:20px 0 0;word-break:break-all">Or paste this link into your browser:<br>${ctaUrl}</p>
</div>`
}

async function send(to: string, subject: string, html: string, text: string) {
  if (!transporter) {
    logger.info(
      { to, subject, text },
      '[mailer] SMTP not configured — logging email instead of sending'
    )
    return
  }
  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, html, text })
    logger.info({ to, subject }, '[mailer] email sent')
  } catch (err) {
    logger.error({ err, to, subject }, '[mailer] send failed')
    throw err
  }
}

export async function verifyMailerConnection(): Promise<boolean> {
  if (!transporter) return false
  await transporter.verify()
  return true
}

export async function sendPasswordResetEmail(to: string, rawToken: string) {
  const link = `${publicClientUrl()}/reset-password?token=${rawToken}`
  await send(
    to,
    'Reset your NewsAgg password',
    wrap(
      'Reset your password',
      "We received a request to reset your NewsAgg password. This link expires in 30 minutes. If you didn't ask for this, you can safely ignore this email.",
      'Reset password',
      link
    ),
    `Reset your NewsAgg password: ${link}\n\nThis link expires in 30 minutes. If you didn't request it, ignore this email.`
  )
}

export async function sendVerificationEmail(to: string, rawToken: string) {
  const link = `${publicClientUrl()}/verify-email?token=${rawToken}`
  await send(
    to,
    'Verify your NewsAgg email',
    wrap(
      'Verify your email',
      'Confirm your email address to finish setting up your NewsAgg account. This link expires in 24 hours.',
      'Verify email',
      link
    ),
    `Verify your NewsAgg email: ${link}\n\nThis link expires in 24 hours.`
  )
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// Admin alert for a new reader report. Report text is user input, so it is
// escaped before it enters the HTML body.
export async function sendAdminReportEmail(to: string, subject: string, lines: string[]) {
  const link = `${publicClientUrl()}/admin`
  const html = wrap('New report on NewsAgg', lines.map(escapeHtml).join('<br>'), 'Open admin page', link)
  await send(to, subject, html, `${lines.join('\n')}\n\nReview it at ${link}`)
}
