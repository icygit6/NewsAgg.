import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { authFetch } from '../lib/apiFetch';

export interface AdminTable { name: string; estimated_rows: number; bytes: number }
export interface AdminOverview {
  users: number;
  posts: number;
  articles: number;
  open_article_reports: number;
  open_post_reports: number;
  open_feedback?: number;
  database_bytes: number;
  tables: AdminTable[];
}
export interface ArticleReport {
  id: number; article_id: string; reason: string; message: string; status: string; created_at: string;
  article_title: string | null; reporter_username: string | null;
}
export interface PostReport {
  id: number; reason: string; details: string | null; status: string; created_at: string;
  post_id: number; content: string; post_deleted: boolean; author_username: string; reporter_username: string;
}
export interface AdminFeedback {
  id: number; kind: 'bug' | 'suggestion' | 'other'; message: string; page: string | null; contact_email: string | null;
  user_agent: string | null; status: 'open' | 'reviewed' | 'resolved'; created_at: string;
  username: string | null; account_email: string | null;
}
export interface AdminUser {
  can_manage_roles?: boolean;
  id: number; username: string; display_name: string | null; email: string; role: string | null;
  email_verified: boolean; google_account: boolean; created_at: string; last_login: string | null;
  posts: number; reports_against: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(path, { ...init, headers: { 'Content-Type': 'application/json' } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error || `HTTP ${response.status}`);
  return body.data as T;
}

export interface DeletedContent {
  id: number; kind: string; target_id: number; post_id: number; content: string;
  deleted_at: string; author_username: string | null; deleted_by_username: string | null;
}
export function useAdminPermissions() {
  const admin = useIsAdmin();
  return useQuery({ queryKey: ['admin', 'permissions'], queryFn: () => request<{ canManageRoles: boolean }>('/api/admin/permissions'), enabled: admin });
}
export function useDeletedContent(offset: number, enabled: boolean, postId?: number) {
  const admin = useIsAdmin();
  return useQuery({ queryKey: ['admin', 'deleted', offset, postId], queryFn: () => request<DeletedContent[]>(`/api/admin/deleted-content?offset=${offset}${postId ? `&postId=${postId}` : ''}`), enabled: admin && enabled, staleTime: 0 });
}

/** The open-item counts behind the navigation badge (/api/admin/attention). */
export type AdminAttention = Pick<AdminOverview, 'open_article_reports' | 'open_post_reports' | 'open_feedback'>;

/** Everything waiting for an admin: open article and post reports plus unread feedback. */
export function adminAttentionCount(overview: AdminAttention | undefined) {
  return (overview?.open_article_reports ?? 0) + (overview?.open_post_reports ?? 0) + (overview?.open_feedback ?? 0);
}

export function useIsAdmin() {
  const { user } = useApp();
  return user?.role === 'admin';
}

export function useAdminOverview() {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => request<AdminOverview>('/api/admin/overview'),
    enabled: admin,
    refetchInterval: 60_000,
  });
}

/** The navigation badge. Every page an admin has open runs this, so it asks for
 * three counts, not the whole overview, and only every few minutes or when the
 * tab is brought back into view. */
export function useAdminAttention() {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ['admin', 'attention'],
    queryFn: () => request<AdminAttention>('/api/admin/attention'),
    enabled: admin,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminReports(enabled = true) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => request<{ articleReports: ArticleReport[]; postReports: PostReport[] }>('/api/admin/reports'),
    enabled: admin && enabled,
  });
}

export function useAdminFeedback(enabled = true) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: () => request<AdminFeedback[]>('/api/admin/feedback'),
    enabled: admin && enabled,
  });
}

export function useAdminUsers(enabled = true) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => request<AdminUser[]>('/api/admin/users'),
    enabled: admin && enabled,
  });
}

export function useAdminActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
    void qc.invalidateQueries({ queryKey: ['posts'] });
  };
  const articleReport = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'open' | 'resolved' | 'rejected' }) =>
      request(`/api/admin/article-reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: refresh,
  });
  const postReport = useMutation({
    mutationFn: ({ id, status, hidePost }: { id: number; status: 'open' | 'resolved' | 'dismissed'; hidePost?: boolean }) =>
      request(`/api/admin/post-reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status, hidePost }) }),
    onSuccess: refresh,
  });
  const deleteUser = useMutation({
    mutationFn: (id: number) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  const feedback = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AdminFeedback['status'] }) =>
      request(`/api/admin/feedback/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: refresh,
  });
  const role = useMutation({
    mutationFn: ({ id, role }: { id: number; role: 'admin' | 'user' }) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: refresh,
  });
  return { articleReport, postReport, deleteUser, feedback, role };
}
