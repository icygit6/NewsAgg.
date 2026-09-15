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
    secure: process.env.SMTP_SECURE === '1' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
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

// Minimal branded HTML wrapper (cyan→pink gradient button), inlined so no
// template engine or asset pipeline is needed.
function wrap(heading: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px">${body}</p>
  <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(90deg,#06b6d4,#ec4899);color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${ctaLabel}</a>
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
  }
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
