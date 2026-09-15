import { describe, it, expect, vi, afterEach } from 'vitest'
import { authService } from './authService'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authService password-reset flows', () => {
  it('forgotPassword POSTs the email to /auth/forgot-password', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true, message: 'sent' }) })
    vi.stubGlobal('fetch', fetchMock)

    const res = await authService.forgotPassword('a@b.com')

    expect(res.success).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/auth/forgot-password')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.com' })
  })

  it('resetPassword POSTs the token and new password to /auth/reset-password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await authService.resetPassword('tok-123', 'newpassword123')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/auth/reset-password')
    expect(JSON.parse(init.body)).toEqual({ token: 'tok-123', password: 'newpassword123' })
  })
})
