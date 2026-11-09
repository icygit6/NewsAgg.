import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

// Body validation middleware. Failures answer 400 with BOTH `message` and
// `error` carrying the same text: the /auth client services read `error`,
// the newer /api routes read `message`.
export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {})
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const message = issue
        ? `${issue.path.join('.') || 'body'}: ${issue.message}`
        : 'Invalid request body'
      return res.status(400).json({ success: false, message, error: message })
    }
    req.body = parsed.data
    next()
  }
}

// A username becomes part of its profile URL (/profile/<name>), where # ? / %
// and similar characters would send the link somewhere else. Letters in any
// script, digits, spaces and _ - . cover every name in use.
const USERNAME_DISALLOWED = /[^\p{L}\p{M}\p{N} _.-]+/gu
export const USERNAME_RULE = 'username may only use letters, digits, spaces and _ - .'

/** A name from elsewhere (a Google profile) reduced to the allowed characters. */
export const toUsername = (raw: string) => raw.replace(USERNAME_DISALLOWED, '').replace(/\s+/g, ' ').trim()

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('valid email required').max(255),
  username: z
    .string()
    .trim()
    .min(3, 'username must be 3-30 characters')
    .max(30, 'username must be 3-30 characters')
    .refine((name) => toUsername(name) === name, USERNAME_RULE),
  password: z.string().min(8, 'password must be at least 8 characters').max(128),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'terms must be accepted' }) }),
  emailUpdates: z.boolean().optional().default(false),
  preferredLanguage: z.enum(['en', 'zhTW']).optional().default('en'),
})

// Login stays permissive on password length: existing accounts predate the
// 8-character register rule and must still be able to sign in.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'email required').max(255),
  password: z.string().min(1, 'password required').max(128),
})

export const googleAuthSchema = z.object({
  token: z.string().min(10, 'Google credential required').max(4096),
  termsAccepted: z.boolean().optional().default(false),
  emailUpdates: z.boolean().optional().default(false),
  preferredLanguage: z.enum(['en', 'zhTW']).optional().default('en'),
})

export const accountPreferencesSchema = z.object({
  preferredLanguage: z.enum(['en', 'zhTW']).optional(),
  emailUpdates: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'at least one preference required')

// Password reset / email verification. Tokens are 64-hex (32 random bytes);
// stay lenient on the exact length but bound it.
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('valid email required').max(255),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, 'invalid or missing token').max(256),
  password: z.string().min(8, 'password must be at least 8 characters').max(128),
})

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(16, 'invalid or missing token').max(256),
})

export const backgroundSchema = z.object({
  background: z.number().int().min(0).max(5),
  image: z.string().max(150_000, 'Background image is too large')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Invalid background image')
    .refine(value => {
      const bytes = Buffer.from(value.split(',')[1], 'base64')
      if (value.startsWith('data:image/png;')) return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      if (value.startsWith('data:image/jpeg;')) return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      return bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
    }, 'Image format does not match its content').nullable().optional().default(null),
}).strict()

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'username must be 3-30 characters')
    .max(30, 'username must be 3-30 characters')
    .refine((name) => toUsername(name) === name, USERNAME_RULE),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().max(128).optional().default(''),
  newPassword: z.string().min(8, 'new password must be at least 8 characters').max(128),
})

// Avatar is a small client-resized image as a data-URL; the 100k-char cap
// stays well under the 200kb JSON body limit.
export const avatarSchema = z.object({
  avatar: z
    .string()
    .max(100_000, 'avatar too large')
    .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, 'invalid avatar image')
    .nullable(),
})

export const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE'),
  currentPassword: z.string().max(128).optional().default(''),
})

export const googleDisconnectSchema = z.object({
  currentPassword: z.string().max(128).optional().default(''),
})

export const postSchema = z.object({
  category: z.enum(['General','Sport','Health','Business','World','Politics','Lifestyle','Science','Climate']).optional(),
  content: z
    .string()
    .trim()
    .min(1, 'post content required')
    .max(280, 'post must be at most 280 characters'),
  articleId: z
    .string()
    .regex(/^[0-9a-f]{16}$/, 'invalid article reference')
    .optional(),
})

export const postEditSchema = z.object({
  category: z.enum(['General','Sport','Health','Business','World','Politics','Lifestyle','Science','Climate']).optional(),
  content: z.string().trim().min(1, 'post content required').max(280, 'post must be at most 280 characters'),
})

export const postCommentSchema = z.object({
  content: z.string().trim().min(1, 'comment required').max(500, 'comment must be at most 500 characters'),
  parentId: z.coerce.number().int().positive().optional(),
})

export const postReportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'misinformation', 'other']),
  details: z.string().trim().max(500).optional(),
})

export const articleReportSchema = z.object({
  reason: z.enum(['sentiment', 'topic', 'summary', 'translation', 'content', 'other']),
  message: z.string().trim().max(1000).optional().default(''),
})

export const blockUserSchema = z.object({ blockedUserId: z.number().int().positive() })

// General feedback (routes/feedback.ts). `website` is a honeypot: people never see
// it, form-filling bots do. contactEmail is optional and only offered to guests.
export const feedbackSchema = z.object({
  kind: z.enum(['bug', 'suggestion', 'other']),
  message: z.string().trim().min(5, 'Please write at least a few words').max(2000, 'Feedback must be at most 2000 characters'),
  page: z.string().trim().max(300).optional(),
  contactEmail: z.union([z.literal(''), z.string().trim().email('Enter a valid email address').max(254)]).optional(),
  website: z.string().max(200).optional(),
})

// Bookmark payloads come from the client's article cards. articleId is usually
// the 16-hex DB id but legacy fallbacks can be an encoded URL, so cap rather
// than pattern-match. Optional fields stay undefined → SQL NULL.
export const bookmarkSchema = z.object({
  articleId: z.string().trim().min(1, 'articleId required').max(512),
  articleUrl: z.string().trim().url('valid article URL required').max(2048).refine((value) => /^https?:\/\//i.test(value), 'article URL must use http or https'),
  articleTitle: z.string().max(512).optional(),
  urlToImage: z.string().url('valid image URL required').max(2048).refine((value) => /^https?:\/\//i.test(value), 'image URL must use http or https').optional().or(z.literal('')),
  sourceName: z.string().max(128).optional(),
  topic: z.string().max(64).optional(),
})

// Collection names collapse inner whitespace so "Read  later" and "Read later" are one collection.
const collectionName = z.string().transform((value) => value.replace(/\s+/g, ' ').trim()).pipe(z.string().min(1).max(60))

export const bookmarkUpdateSchema = z.object({
  collectionName: collectionName.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'at least one update required')

export const collectionRenameSchema = z.object({ from: z.string().min(1).max(60), to: collectionName })
export const collectionCreateSchema = z.object({ name: collectionName })
// moveTo null (or absent) deletes the collection's bookmarks along with it.
export const collectionDeleteSchema = z.object({ name: z.string().min(1).max(60), moveTo: collectionName.nullable().optional() })

export const publicProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).nullable().optional(),
  bio: z.string().trim().max(240).nullable().optional(),
})

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'message required').max(4000),
  articleId: z.string().regex(/^[0-9a-f]{16}$/, 'invalid article reference'),
  lang: z.string().trim().max(10).optional().default('en'),
  // Optional prior turns (F8 multi-turn). Absent → exact legacy single-turn path.
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      })
    )
    .max(20, 'too many history messages')
    .optional(),
})
