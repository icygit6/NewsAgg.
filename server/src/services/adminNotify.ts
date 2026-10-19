import { logger } from '../lib/logger'
import { query } from '../db/client'
import { sendAdminReportEmail } from './mailer'

// Emails every admin account about a new reader report. Runs after the
// response is sent; a mail failure is logged and never fails the report.
export function notifyAdminsOfReport(subject: string, lines: string[]): void {
  setImmediate(async () => {
    try {
      const admins = await query("SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL")
      for (const { email } of admins.rows) await sendAdminReportEmail(email, subject, lines)
    } catch (err: any) {
      logger.error({ err: err?.message }, '[admin notify] report email failed')
    }
  })
}
