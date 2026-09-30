import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { setSidebarOpen, setUser, resetPassword, logout } = vi.hoisted(() => ({
  setSidebarOpen: vi.fn(),
  setUser: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({ isDark: false, setSidebarOpen, setUser }),
}))

vi.mock('../services/authService', () => ({
  authService: { resetPassword, logout },
}))

import { ResetPasswordPage } from './ResetPasswordPage'

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens a fresh sign-in panel immediately after a successful reset', async () => {
    resetPassword.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/reset-password?token=test-token']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<div>Home destination</div>} />
        </Routes>
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText('New password'), 'newpassword123')
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => expect(screen.getByText('Home destination')).toBeInTheDocument())
    expect(resetPassword).toHaveBeenCalledWith('test-token', 'newpassword123')
    expect(logout).toHaveBeenCalledOnce()
    expect(setUser).toHaveBeenCalledWith(null)
    expect(setSidebarOpen).toHaveBeenCalledWith(true)
  })
})
