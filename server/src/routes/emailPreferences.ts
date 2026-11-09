import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { query } from '../db/client'
import { logger } from '../lib/logger'
import { verifyUnsubscribeToken } from '../lib/unsubscribeToken'
import { clientIp, ipBucket } from '../lib/clientIp'

// Public (no session) because it is opened from an email client. Authority
// comes from the signed token in the link, not from a cookie.
export const emailPreferencesRouter = Router()

emailPreferencesRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => ipBucket(clientIp(req)),
    message: { success: false, message: 'Too many requests' },
  })
)

const PAGE = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eaf0f5;font-family:Arial,'Microsoft JhengHei',sans-serif;color:#173a63}
main{max-width:420px;margin:24px;padding:32px;background:#fff;border:1px solid #dae3ec;border-top:5px solid #173a63;border-radius:16px}
h1{font-size:20px;margin:0 0 12px}p{font-size:14px;line-height:1.7;color:#475569;margin:0 0 18px}
button,a.btn{display:inline-block;border:0;border-radius:8px;background:#173a63;color:#fff;font-size:14px;font-weight:bold;padding:12px 20px;text-decoration:none;cursor:pointer}
a.plain{color:#3f6796;font-size:13px;margin-left:12px}</style></head><body><main>${body}</main></body></html>`

function tokenFrom(req: Request): string | undefined {
  const fromQuery = typeof req.query.token === 'string' ? req.query.token : undefined
  const fromBody = typeof req.body?.token === 'string' ? req.body.token : undefined
  return fromQuery ?? fromBody
}

const invalid = (res: Response) =>
  res.status(400).type('html').send(
    PAGE(
      'Link not valid',
      `<h1>This link is not valid</h1><p>It may be incomplete. You can turn email updates off any time from your profile.<br>此連結無效。你可以隨時在個人檔案中關閉電子郵件更新。</p><a class="btn" href="/profile">Open profile／開啟個人檔案</a>`
    )
  )

// GET only shows a confirmation. Mail scanners and link previews fetch URLs
// automatically, so a GET must never change anything.
emailPreferencesRouter.get('/unsubscribe', (req: Request, res: Response) => {
  const token = tokenFrom(req)
  if (verifyUnsubscribeToken(token) === null) return invalid(res)
  res.type('html').send(
    PAGE(
      'Unsubscribe',
      `<h1>Stop the daily email?</h1><p>You will no longer receive the NewsAgg morning edition. You can switch it back on from your profile.<br>你將不再收到 NewsAgg 晨間簡報，之後可在個人檔案重新開啟。</p>
<form method="post" action="/api/email/unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe／取消訂閱</button><a class="plain" href="/">Keep it／保留</a></form>`
    )
  )
})

// POST performs it: from the button above, or as an RFC 8058 one-click request
// from the mail client (List-Unsubscribe-Post), which posts to the same URL.
emailPreferencesRouter.post('/unsubscribe', async (req: Request, res: Response) => {
  const userId = verifyUnsubscribeToken(tokenFrom(req))
  if (userId === null) return invalid(res)
  try {
    await query('UPDATE users SET email_updates = false WHERE id = $1', [userId])
    logger.info({ userId }, '[email] unsubscribed from daily email')
    if (req.accepts(['html', 'json']) === 'json') return res.json({ success: true })
    res.type('html').send(
      PAGE(
        'Unsubscribed',
        `<h1>You are unsubscribed</h1><p>The daily email has been turned off for your account.<br>你的帳號已關閉每日電子郵件。</p><a class="btn" href="/">Back to NewsAgg／回到 NewsAgg</a>`
      )
    )
  } catch (err: any) {
    logger.error({ err: err?.message }, '[POST /api/email/unsubscribe]')
    res.status(500).type('html').send(PAGE('Try again', '<h1>Something went wrong</h1><p>Please try again in a moment.<br>請稍後再試。</p>'))
  }
})
