import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { API_BASE_URL, AUTH_UNAUTHORIZED_EVENT } from '../lib/apiFetch';

export interface AdminTable { name: string; estimated_rows: number; bytes: number }
export interface AdminOverview {
  users: number;
  posts: number;
  articles: number;
  open_article_reports: number;
  open_post_reports: number;
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
export interface AdminUser {
  id: number; username: string; display_name: string | null; email: string; role: string | null;
  email_verified: boolean; google_account: boolean; created_at: string; last_login: string | null;
  posts: number; reports_against: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  if (response.status === 401) window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error || `HTTP ${response.status}`);
  return body.data as T;
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

export function useAdminReports(enabled = true) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => request<{ articleReports: ArticleReport[]; postReports: PostReport[] }>('/api/admin/reports'),
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
  return { articleReport, postReport, deleteUser };
}
