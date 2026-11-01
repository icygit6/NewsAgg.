import { describe, expect, it } from 'vitest'
import { bookmarkSchema, bookmarkUpdateSchema, collectionRenameSchema, postEditSchema, postReportSchema, publicProfileSchema } from './validate'

describe('bookmark and post validation', () => {
  it('rejects non-http bookmark URLs', () => {
    expect(bookmarkSchema.safeParse({ articleId: 'x', articleUrl: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('normalises collection names', () => {
    expect(bookmarkUpdateSchema.parse({ collectionName: '  Read   later ' }).collectionName).toBe('Read later')
    expect(bookmarkUpdateSchema.safeParse({ collectionName: '   ' }).success).toBe(false)
    expect(collectionRenameSchema.parse({ from: 'Research', to: ' Thesis  sources ' }).to).toBe('Thesis sources')
  })

  it('requires at least one bookmark update', () => {
    expect(bookmarkUpdateSchema.safeParse({}).success).toBe(false)
    expect(bookmarkUpdateSchema.safeParse({ isRead: true }).success).toBe(true)
  })

  it('enforces the 280 character edit limit', () => {
    expect(postEditSchema.safeParse({ content: 'x'.repeat(281) }).success).toBe(false)
  })

  it('accepts only supported report reasons', () => {
    expect(postReportSchema.safeParse({ reason: 'spam' }).success).toBe(true)
    expect(postReportSchema.safeParse({ reason: 'disagree' }).success).toBe(false)
  })

  it('bounds public profile fields', () => {
    expect(publicProfileSchema.safeParse({ displayName: 'Reader', bio: 'News enthusiast' }).success).toBe(true)
    expect(publicProfileSchema.safeParse({ bio: 'x'.repeat(241) }).success).toBe(false)
  })
})
