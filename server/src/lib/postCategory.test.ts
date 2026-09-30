import { describe, it, expect } from 'vitest'
import { inferPostCategory } from './postCategory'
describe('post categories', () => {
  it('recognizes English, Indonesian, and Chinese comments', () => {
    expect(inferPostCategory('The hospital needs more funding')).toBe('Health')
    expect(inferPostCategory('Perubahan iklim perlu perhatian')).toBe('Climate')
    expect(inferPostCategory('今天的足球比賽很精彩')).toBe('Sport')
  })
  it('does not force a category onto an ambiguous comment', () => {
    expect(inferPostCategory('Interesting, thanks for sharing')).toBe('General')
    expect(inferPostCategory('Interesting', 'Science')).toBe('Science')
  })
})
