import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = 26; next() },
  optionalAuth: (req: any, _res: any, next: any) => { req.userId = 26; next() },
}))
import { query } from '../db/client'
import { adminRouter } from './admin'
import { postsRouter } from './posts'

const db = vi.mocked(query)
const app = express().use(express.json()).use('/api/admin', adminRouter).use('/api/posts', postsRouter)
const admin = () => db.mockResolvedValueOnce({ rows: [{}] } as any)
const notAdmin = () => db.mockResolvedValueOnce({ rows: [] } as any)

describe('admin routes', () => {
  beforeEach(() => { db.mockReset() })

  it('denies delegated admins role assignment and protects the primary admin', async () => {
    admin()
    db.mockResolvedValueOnce({ rows: [] } as any)
    expect((await request(app).patch('/api/admin/users/13/role').send({ role: 'admin' })).status).toBe(403)
    expect(db.mock.calls[1][0]).toContain('owner.can_manage_roles=true')
    expect(db.mock.calls[1][0]).toContain('can_manage_roles=false')
  })
  it('keeps deleted content private to admins', async () => {
    notAdmin()
    expect((await request(app).get('/api/admin/deleted-content')).status).toBe(403)
    expect(db).toHaveBeenCalledTimes(1)
  })

  it('refuses signed-in accounts without the admin role', async () => {
    notAdmin()
    const response = await request(app).get('/api/admin/overview')
    expect(response.status).toBe(403)
    expect(db).toHaveBeenCalledTimes(1)
  })

  it('answers the nginx gate with 204 for an admin', async () => {
    admin()
    const response = await request(app).get('/api/admin/check')
    expect(response.status).toBe(204)
  })

  it('never deletes the signed-in admin', async () => {
    admin()
    const response = await request(app).delete('/api/admin/users/26')
    expect(response.status).toBe(400)
    expect(db).toHaveBeenCalledTimes(1)
  })

  it('deletes other users but excludes admin accounts in SQL', async () => {
    admin()
    db.mockResolvedValueOnce({ rows: [{ id: 13 }] } as any)
    const response = await request(app).delete('/api/admin/users/13')
    expect(response.status).toBe(200)
    expect(db).toHaveBeenLastCalledWith(expect.stringContaining("role IS DISTINCT FROM 'admin'"), [13])
  })

  it('can resolve a post report and hide the post', async () => {
    admin()
    db.mockResolvedValueOnce({ rows: [{ post_id: 9 }] } as any).mockResolvedValueOnce({ rows: [] } as any)
    const response = await request(app).patch('/api/admin/post-reports/4').send({ status: 'resolved', hidePost: true })
    expect(response.status).toBe(200)
    expect(db).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE posts SET deleted_at'), [9, 26])
  })

  it('rejects unknown article report states', async () => {
    admin()
    const response = await request(app).patch('/api/admin/article-reports/4').send({ status: 'deleted' })
    expect(response.status).toBe(400)
  })

  it('lets an admin delete someone else’s post', async () => {
    admin()
    db.mockResolvedValueOnce({ rows: [{ id: 5 }] } as any)
    const response = await request(app).delete('/api/posts/5')
    expect(response.status).toBe(200)
    expect(db).toHaveBeenLastCalledWith(expect.stringContaining('(user_id=$2 OR $3)'), [5, 26, true])
  })

  it('keeps non-admins limited to their own posts', async () => {
    notAdmin()
    db.mockResolvedValueOnce({ rows: [] } as any)
    const response = await request(app).delete('/api/posts/5')
    expect(response.status).toBe(404)
    expect(db).toHaveBeenLastCalledWith(expect.stringContaining('(user_id=$2 OR $3)'), [5, 26, false])
  })
})
