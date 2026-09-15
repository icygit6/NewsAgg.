import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/client'
import { JWT_SECRET } from '../config'
import { logger } from '../lib/logger'
import { authMiddleware } from '../middleware/auth'
import {
  validateBody,
  registerSchema,
  loginSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../middleware/validate'
import {
  generateToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
  VERIFY_TOKEN_TTL_MS,
} from '../lib/tokens'
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mailer'
import {
  requireCaptcha,
  loginCaptchaGate,
  loginNeedsCaptcha,
  recordLoginFailure,
  clearLoginFailures,
} from '../middleware/captcha'

// Ports server.js /auth routes against the live `users` table
// (integer id, `password` column). Response shape: { success, token, user, error? }.
// Error responses now carry a correct 4xx/5xx status (they used to all be 200).
export const authRouter = Router()

function signToken(userId: number | string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' } as jwt.SignOptions)
}

// Single source of truth for the user object the client receives. `emailVerified`
// is surfaced (camelCase) so the client can show a soft "verify your email" banner.
function shapeUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar: row.avatar,
    emailVerified: row.email_verified ?? false,
  }
}

// Issue a single-use token of the given kind, storing only its hash. Any
// previous unused token of the same kind for this user is dropped first, so a
// user only ever has one outstanding reset / verify link.
async function issueToken(userId: number | string, kind: 'reset' | 'verify', ttlMs: number) {
  const { raw, hash } = generateToken()
  const expiresAt = new Date(Date.now() + ttlMs)
  await query('DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2 AND used_at IS NULL', [
    userId,
    kind,
  ])
  await query(
    'INSERT INTO auth_tokens (user_id, token_hash, kind, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, hash, kind, expiresAt]
  )
  return raw
}

// POST /auth/register
authRouter.post(
  '/register',
  requireCaptcha,
  validateBody(registerSchema),
  async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body

    const userCheck = await query('SELECT id FROM users WHERE email = $1 OR username = $2', [
      email,
      username,
    ])
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email or username already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await query(
      'INSERT INTO users (email, username, password, last_login) VALUES ($1, $2, $3, now()) RETURNING id, email, username, avatar, email_verified',
      [email, username, hashedPassword]
    )

    const user = result.rows[0]
    // Fire off the verification email but don't block signup on it (soft-gated:
    // the account is usable immediately; the client shows a "verify" banner).
    issueToken(user.id, 'verify', VERIFY_TOKEN_TTL_MS)
      .then((raw) => sendVerificationEmail(user.email, raw))
      .catch((err) => logger.error({ err }, 'verification email on register failed'))

    const token = signToken(user.id)
    res.status(201).json({ success: true, token, user: shapeUser(user) })
  } catch (error: any) {
    // 23505 = unique violation: closes the check-then-insert race when two
    // registers with the same email/username land concurrently.
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email or username already exists' })
    }
    logger.error({ err: error }, 'Register error')
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
  }
)

// POST /auth/login — `loginCaptchaGate` only challenges once this IP has tripped
// the failed-login threshold; below it, sign-in stays frictionless. The 401s
// echo `captchaRequired` so the form knows when to render the widget.
authRouter.post(
  '/login',
  loginCaptchaGate,
  validateBody(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body

      const result = await query(
        'SELECT id, email, username, password, avatar, email_verified FROM users WHERE email = $1',
        [email]
      )
      if (result.rows.length === 0) {
        recordLoginFailure(req)
        return res.status(401).json({
          success: false,
          error: 'User not found',
          captchaRequired: loginNeedsCaptcha(req),
        })
      }

      const user = result.rows[0]
      if (!user.password) {
        return res.status(401).json({ success: false, error: 'This account signs in with Google' })
      }
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        recordLoginFailure(req)
        return res.status(401).json({
          success: false,
          error: 'Invalid password',
          captchaRequired: loginNeedsCaptcha(req),
        })
      }

      clearLoginFailures(req)
      query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]).catch(() => {})
      const token = signToken(user.id)
      res.json({ success: true, token, user: shapeUser(user) })
    } catch (error: any) {
      logger.error({ err: error }, 'Login error')
      res.status(500).json({ success: false, error: 'Login failed' })
    }
  }
)

// POST /auth/forgot-password — always answers 200 with a generic message so it
// can't be used to enumerate which emails have accounts.
authRouter.post(
  '/forgot-password',
  requireCaptcha,
  validateBody(forgotPasswordSchema),
  async (req: Request, res: Response) => {
    const generic = {
      success: true,
      message: 'If an account exists for that email, a reset link is on its way.',
    }
    try {
      const { email } = req.body
      const result = await query('SELECT id, password FROM users WHERE email = $1', [email])
      const user = result.rows[0]
      // Only password accounts can reset a password; Google-only accounts have
      // none. Either way the response is identical (no enumeration).
      if (user?.password) {
        const raw = await issueToken(user.id, 'reset', RESET_TOKEN_TTL_MS)
        await sendPasswordResetEmail(email, raw)
      }
      res.json(generic)
    } catch (error: any) {
      logger.error({ err: error }, 'forgot-password error')
      // Still answer generically — never leak failure detail to a guesser.
      res.json(generic)
    }
  }
)

// POST /auth/reset-password — consumes a single-use reset token.
authRouter.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body
      // Atomically claim the token: the WHERE clause guards used/expired, and
      // RETURNING gives us the owner — so a token can't be redeemed twice.
      const claimed = await query(
        `UPDATE auth_tokens SET used_at = now()
         WHERE token_hash = $1 AND kind = 'reset' AND used_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        [hashToken(token)]
      )
      if (claimed.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid or expired reset link' })
      }
      const userId = claimed.rows[0].user_id
      const hashed = await bcrypt.hash(password, 10)
      // Resetting via an emailed link also proves control of the inbox, so the
      // email is verified as a side effect. Drop any other outstanding tokens.
      await query('UPDATE users SET password = $1, email_verified = true WHERE id = $2', [
        hashed,
        userId,
      ])
      await query('DELETE FROM auth_tokens WHERE user_id = $1 AND used_at IS NULL', [userId])
      res.json({ success: true, message: 'Your password has been reset. You can now sign in.' })
    } catch (error: any) {
      logger.error({ err: error }, 'reset-password error')
      res.status(500).json({ success: false, error: 'Could not reset password' })
    }
  }
)

// POST /auth/verify-email — consumes a single-use verification token.
authRouter.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.body
      const claimed = await query(
        `UPDATE auth_tokens SET used_at = now()
         WHERE token_hash = $1 AND kind = 'verify' AND used_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        [hashToken(token)]
      )
      if (claimed.rows.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid or expired verification link' })
      }
      await query('UPDATE users SET email_verified = true WHERE id = $1', [claimed.rows[0].user_id])
      res.json({ success: true, message: 'Email verified. Thanks!' })
    } catch (error: any) {
      logger.error({ err: error }, 'verify-email error')
      res.status(500).json({ success: false, error: 'Could not verify email' })
    }
  }
)

// POST /auth/resend-verification — Bearer-protected (we resend to the signed-in
// user's own address, so there's nothing to enumerate).
authRouter.post('/resend-verification', authMiddleware, async (req: any, res: Response) => {
  try {
    const result = await query('SELECT email, email_verified FROM users WHERE id = $1', [
      req.userId,
    ])
    const user = result.rows[0]
    if (!user) {
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    if (user.email_verified) {
      return res.json({ success: true, alreadyVerified: true })
    }
    const raw = await issueToken(req.userId, 'verify', VERIFY_TOKEN_TTL_MS)
    await sendVerificationEmail(user.email, raw)
    res.json({ success: true, message: 'Verification email sent.' })
  } catch (error: any) {
    logger.error({ err: error }, 'resend-verification error')
    res.status(500).json({ success: false, error: 'Could not send verification email' })
  }
})

// POST /auth/google
authRouter.post('/google', validateBody(googleAuthSchema), async (req: Request, res: Response) => {
  try {
    const { token } = req.body

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      logger.error('GOOGLE_CLIENT_ID is not set — cannot verify Google sign-in')
      return res
        .status(500)
        .json({ success: false, error: 'Google sign-in is not configured on the server' })
    }

    const { OAuth2Client } = await import('google-auth-library')
    const googleClient = new OAuth2Client(clientId)
    let payload
    try {
      // Throws on an expired token, a bad signature, or an audience mismatch
      // (the token was issued for a different GOOGLE_CLIENT_ID than the server's).
      const ticket = await googleClient.verifyIdToken({ idToken: token, audience: clientId })
      payload = ticket.getPayload()
    } catch (verifyErr) {
      logger.warn({ err: verifyErr }, 'Google ID token verification failed')
      return res.status(401).json({
        success: false,
        error:
          'Could not verify your Google sign-in — the token is expired or was issued for a different app. Try again.',
      })
    }

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Google authentication failed' })
    }

    const email = payload.email
    // Accounts are matched/created by email, so the email must be verified —
    // an unverified-email Google identity could otherwise claim an existing
    // account (Google sets email_verified:false on some Workspace/imported
    // accounts; for normal Gmail it is always true).
    if (!email || payload.email_verified !== true) {
      return res
        .status(401)
        .json({ success: false, error: 'Google account email is missing or unverified' })
    }
    const username = payload.name || email.split('@')[0]

    const userResult = await query(
      'SELECT id, email, username, avatar, email_verified FROM users WHERE email = $1',
      [email]
    )

    if (userResult.rows.length === 0) {
      // First Google sign-in: create the account on the spot, passwordless.
      // Google already verified the email, so email_verified starts true.
      const localPart = email.split('@')[0]
      let base = (username || localPart).trim().slice(0, 24)
      if (base.length < 3) base = `${base}${localPart}user`.slice(0, 24)

      for (let attempt = 0; attempt < 4; attempt++) {
        const candidate =
          attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30)
        try {
          const created = await query(
            'INSERT INTO users (email, username, google_id, email_verified, last_login) VALUES ($1, $2, $3, true, now()) RETURNING id, email, username, avatar, email_verified',
            [email, candidate, payload.sub]
          )
          const newUser = created.rows[0]
          const newToken = signToken(newUser.id)
          return res.json({ success: true, token: newToken, user: shapeUser(newUser) })
        } catch (e: any) {
          // 23505 = unique violation (username taken) → retry with a suffix.
          if (e?.code !== '23505') throw e
        }
      }
      return res.status(500).json({ success: false, error: 'Could not create account' })
    }

    const user = userResult.rows[0]
    // Signing in with Google proves control of the email, so mark it verified.
    // payload.sub comes from the server-verified token, never the client;
    // COALESCE keeps an already-linked id untouched.
    query(
      'UPDATE users SET last_login = now(), google_id = COALESCE(google_id, $2), email_verified = true WHERE id = $1',
      [user.id, payload.sub]
    ).catch(() => {})
    const authToken = signToken(user.id)
    res.json({ success: true, token: authToken, user: shapeUser({ ...user, email_verified: true }) })
  } catch (err: any) {
    logger.error({ err }, 'Google auth error')
    res.status(401).json({ success: false, error: 'Google authentication failed' })
  }
})
