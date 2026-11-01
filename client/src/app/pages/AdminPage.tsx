import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Bug, Check, Database, Eye, ExternalLink, EyeOff, Flag, Lightbulb, MessageSquare, RotateCcw, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useUiText, useUiLocale } from '../i18n/uiText';
import {
  useAdminActions, useAdminFeedback, useAdminOverview, useAdminReports, useAdminUsers, useIsAdmin, useAdminPermissions, useDeletedContent,
  type AdminFeedback, type AdminUser, type ArticleReport, type PostReport,
} from '../hooks/useAdmin';

type Tab = 'overview' | 'reports' | 'feedback' | 'users' | 'deleted';

const FEEDBACK_KIND = {
  bug: { label: 'Bug', icon: Bug, tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  other: { label: 'Other', icon: MessageSquare, tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
} as const;

const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;

function StatusBadge({ status }: { status: string }) {
  const ui = useUiText();
  const tone = status === 'open' ? 'bg-amber-500/15 text-amber-600' : status === 'resolved' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-slate-500/15 text-slate-500';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{ui(status === 'open' ? 'Open' : status === 'resolved' ? 'Resolved' : status === 'reviewed' ? 'Reviewed' : status === 'rejected' ? 'Rejected' : 'Dismissed')}</span>;
}

function ActionButton({ onClick, disabled, tone = 'neutral', children }: { onClick: () => void; disabled?: boolean; tone?: 'neutral' | 'danger' | 'good'; children: ReactNode }) {
  const tones = {
    neutral: 'border-slate-400/40 hover:bg-slate-500/10',
    danger: 'border-rose-500/40 text-rose-600 hover:bg-rose-500/10',
    good: 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10',
  };
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${tones[tone]}`}>{children}</button>;
}

export function AdminPage() {
  const ui = useUiText();
  const locale = useUiLocale();
  const { user, isDark, setSidebarOpen } = useApp();
  const admin = useIsAdmin();
  const [tab, setTab] = useState<Tab>('overview');
  const overview = useAdminOverview();
  const reports = useAdminReports(tab === 'reports');
  const feedback = useAdminFeedback(tab === 'feedback');
  const users = useAdminUsers(tab === 'users');
  const actions = useAdminActions();
  const permissions = useAdminPermissions();
  const [deletedOffset, setDeletedOffset] = useState(0);
  const deleted = useDeletedContent(deletedOffset, tab === 'deleted');
  const [confirmUser, setConfirmUser] = useState<number | null>(null);
  const [error, setError] = useState('');

  const card = `rounded-2xl border p-5 ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`;
  const when = (value: string | null) => (value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const fail = (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason));

  if (!user) {
    return <div className="text-center py-24"><ShieldCheck className="mx-auto mb-4" /><h1 className="text-2xl font-bold">{ui('Sign in as an admin')}</h1><button onClick={() => setSidebarOpen(true)} className="mt-4 px-6 py-3 rounded-xl bg-[var(--brand)] text-white">{ui('Sign In')}</button></div>;
  }
  if (!admin) {
    return <div className="text-center py-24"><ShieldCheck className="mx-auto mb-4 opacity-50" /><h1 className="text-2xl font-bold">{ui('Admin access required')}</h1><p className="opacity-70 mt-2">{ui('This page is only available to the NewsAgg admin account.')}</p></div>;
  }

  const openReports = (overview.data?.open_article_reports ?? 0) + (overview.data?.open_post_reports ?? 0);
  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: 'overview', label: ui('Overview') },
    { id: 'reports', label: ui('Reports'), badge: openReports },
    { id: 'feedback', label: ui('Feedback'), badge: overview.data?.open_feedback ?? 0 },
    { id: 'users', label: ui('Users') },
    { id: 'deleted', label: ui('Deleted content') },
  ];

  return (
    <main className="px-4 md:px-6 py-8 space-y-5">
      <header className="flex items-start gap-3">
        <ShieldCheck size={32} className="text-blue-600 shrink-0 mt-1" />
        <div>
          <h1 className="text-3xl font-bold">{ui('Admin')}</h1>
          <p className="opacity-70">{ui('Moderate reports, posts and accounts, read user feedback, and inspect the database.')}</p>
        </div>
      </header>

      <div role="tablist" className={`flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border p-1 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        {tabs.map(({ id, label, badge }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex-1 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${tab === id ? 'text-white' : 'opacity-70 hover:opacity-100'}`}
            style={tab === id ? { background: 'var(--brand, #2563eb)' } : undefined}>
            {label}
            {badge ? <span className="rounded-full bg-rose-500 px-1.5 text-[11px] leading-5 text-white">{badge}</span> : null}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="flex justify-between rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600">{error}<button onClick={() => setError('')} aria-label={ui('Dismiss')}><X size={16} /></button></div>}

      {tab === 'overview' && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              [ui('Users'), overview.data?.users],
              [ui('Posts'), overview.data?.posts],
              [ui('Articles'), overview.data?.articles],
              [ui('Open reports'), overview.data ? openReports : undefined],
              [ui('New feedback'), overview.data?.open_feedback],
              [ui('Database size'), overview.data ? formatBytes(overview.data.database_bytes) : undefined],
            ].map(([label, value]) => (
              <div key={String(label)} className={card}>
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value ?? '…'}</p>
              </div>
            ))}
          </section>

          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2"><Database size={20} /><h2 className="text-lg font-bold">{ui('Database')}</h2></div>
              <a href="/dbviewer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--brand, #2563eb)' }}>
                {ui('Open database viewer')} <ExternalLink size={14} />
              </a>
            </div>
            <p className="text-sm opacity-70 mb-3">{ui('Read-only. The users, auth_tokens and account_sessions tables hold password hashes and sign-in tokens, so opening them shows “permission denied”. Browse accounts in the users_overview view instead.')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left opacity-60"><th className="py-2 pr-4">{ui('Table')}</th><th className="py-2 pr-4 text-right">{ui('Rows (approx.)')}</th><th className="py-2 text-right">{ui('Size')}</th></tr></thead>
                <tbody>
                  {overview.data?.tables.map((table) => (
                    <tr key={table.name} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <td className="py-1.5 pr-4 font-mono">{table.name}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{table.estimated_rows.toLocaleString(locale)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatBytes(table.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'reports' && (
        <>
          <section className={card}>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Flag size={18} />{ui('Article reports')}</h2>
            {reports.isLoading && <p className="opacity-60">{ui('Loading…')}</p>}
            {reports.data?.articleReports.length === 0 && <p className="opacity-60">{ui('No reports yet.')}</p>}
            <ul className="space-y-3">
              {reports.data?.articleReports.map((report: ArticleReport) => (
                <li key={report.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={report.status} />
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-600">{report.reason}</span>
                    <span className="opacity-60">{when(report.created_at)} · {report.reporter_username ? `@${report.reporter_username}` : ui('Guest')}</span>
                  </div>
                  <Link to={`/article/${report.article_id}`} className="mt-2 block font-semibold hover:text-blue-600 dark:hover:text-blue-400">{report.article_title || report.article_id}</Link>
                  {report.message && <p className="mt-1 text-sm whitespace-pre-wrap break-words opacity-80">{report.message}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.status === 'open' ? (
                      <>
                        <ActionButton tone="good" disabled={actions.articleReport.isPending} onClick={() => actions.articleReport.mutate({ id: report.id, status: 'resolved' }, { onError: fail })}><Check size={13} />{ui('Mark resolved')}</ActionButton>
                        <ActionButton disabled={actions.articleReport.isPending} onClick={() => actions.articleReport.mutate({ id: report.id, status: 'rejected' }, { onError: fail })}><X size={13} />{ui('Reject')}</ActionButton>
                      </>
                    ) : (
                      <ActionButton disabled={actions.articleReport.isPending} onClick={() => actions.articleReport.mutate({ id: report.id, status: 'open' }, { onError: fail })}><RotateCcw size={13} />{ui('Reopen')}</ActionButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Flag size={18} />{ui('Post reports')}</h2>
            {reports.data?.postReports.length === 0 && <p className="opacity-60">{ui('No reports yet.')}</p>}
            <ul className="space-y-3">
              {reports.data?.postReports.map((report: PostReport) => (
                <li key={report.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={report.status} />
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-600">{report.reason}</span>
                    {report.post_deleted && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-600">{ui('Post hidden')}</span>}
                    <span className="opacity-60">{when(report.created_at)} · {ui('reported by')} @{report.reporter_username}</span>
                  </div>
                  <p className="mt-2 text-sm"><Link to={`/profile/${report.author_username}`} className="font-semibold hover:text-blue-600 dark:hover:text-blue-400">@{report.author_username}</Link></p>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words opacity-80">{report.content}</p>
                  {report.details && <p className="mt-1 text-xs opacity-60">{ui('Details')}: {report.details}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.status === 'open' ? (
                      <>
                        <ActionButton tone="danger" disabled={actions.postReport.isPending} onClick={() => actions.postReport.mutate({ id: report.id, status: 'resolved', hidePost: true }, { onError: fail })}><EyeOff size={13} />{ui('Hide post and resolve')}</ActionButton>
                        <ActionButton disabled={actions.postReport.isPending} onClick={() => actions.postReport.mutate({ id: report.id, status: 'dismissed' }, { onError: fail })}><X size={13} />{ui('Dismiss')}</ActionButton>
                      </>
                    ) : (
                      <ActionButton disabled={actions.postReport.isPending} onClick={() => actions.postReport.mutate({ id: report.id, status: 'open' }, { onError: fail })}><RotateCcw size={13} />{ui('Reopen')}</ActionButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'feedback' && (
        <section className={card}>
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><MessageSquare size={18} />{ui('User feedback')} {feedback.data && <span className="opacity-60 font-normal">({feedback.data.length})</span>}</h2>
          <p className="text-sm opacity-70 mb-3">{ui('Bug reports, suggestions and other messages sent from the Send feedback form. New items are listed first.')}</p>
          {feedback.isLoading && <p className="opacity-60">{ui('Loading…')}</p>}
          {feedback.isError && <p className="text-rose-600">{ui('Could not load feedback.')}</p>}
          {feedback.data?.length === 0 && <p className="opacity-60">{ui('No feedback yet.')}</p>}
          <ul className="space-y-3">
            {feedback.data?.map((item: AdminFeedback) => {
              const kind = FEEDBACK_KIND[item.kind] ?? FEEDBACK_KIND.other;
              const KindIcon = kind.icon;
              const busy = actions.feedback.isPending;
              const move = (status: AdminFeedback['status']) => actions.feedback.mutate({ id: item.id, status }, { onError: fail });
              return (
                <li key={item.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={item.status} />
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${kind.tone}`}><KindIcon size={12} />{ui(kind.label)}</span>
                    <span className="opacity-60">#{item.id} · {when(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap break-words">{item.message}</p>
                  <div className="mt-2 flex flex-col gap-0.5 text-xs opacity-70">
                    <span className="break-words">
                      {ui('From')}: {item.username
                        ? <><Link to={`/profile/${item.username}`} className="font-semibold hover:text-blue-600 dark:hover:text-blue-400">@{item.username}</Link>{item.account_email && <> · <a href={`mailto:${item.account_email}`} className="hover:underline break-all">{item.account_email}</a></>}</>
                        : <>{ui('Guest')}{item.contact_email && <> · <a href={`mailto:${item.contact_email}`} className="hover:underline break-all">{item.contact_email}</a></>}</>}
                    </span>
                    {item.page && <span className="break-all">{ui('Page')}: <Link to={item.page} className="font-mono hover:text-blue-600 dark:hover:text-blue-400">{item.page}</Link></span>}
                    {item.user_agent && <span className="truncate" title={item.user_agent}>{ui('Device')}: {item.user_agent}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status === 'open' && <ActionButton disabled={busy} onClick={() => move('reviewed')}><Eye size={13} />{ui('Mark reviewed')}</ActionButton>}
                    {item.status !== 'resolved' && <ActionButton tone="good" disabled={busy} onClick={() => move('resolved')}><Check size={13} />{ui('Mark resolved')}</ActionButton>}
                    {item.status !== 'open' && <ActionButton disabled={busy} onClick={() => move('open')}><RotateCcw size={13} />{ui('Reopen')}</ActionButton>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'deleted' && <section className={card}>
        <h2 className="text-lg font-bold mb-3">{ui('Deleted content')}</h2>
        {deleted.isLoading && <p>{ui('Loading…')}</p>}
        {deleted.isError && <p role="alert">{ui('Could not load deleted content.')}</p>}
        {deleted.data?.length === 0 && <p>{ui('No deleted content.')}</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>{ui('Type')}</th><th>{ui('Post')}</th><th>{ui('Message')}</th><th>{ui('Deleted by')}</th><th>{ui('Date')}</th></tr></thead><tbody>
          {deleted.data?.map(item => <tr key={item.id} className="border-t border-slate-400/20 align-top">
            <td className="p-3">{item.kind} #{item.target_id}</td><td className="p-3">#{item.post_id}</td>
            <td className="p-3 min-w-64 max-w-xl whitespace-pre-wrap break-words"><span className="block text-xs opacity-60">@{item.author_username || '—'}</span>{item.content}</td>
            <td className="p-3">{item.deleted_by_username || '—'}</td><td className="p-3">{when(item.deleted_at)}</td>
          </tr>)}
        </tbody></table></div>
        <div className="flex gap-3 mt-4"><ActionButton disabled={deletedOffset === 0} onClick={() => setDeletedOffset(Math.max(0, deletedOffset - 50))}>{ui('Previous')}</ActionButton><ActionButton disabled={!deleted.data || deleted.data.length < 50} onClick={() => setDeletedOffset(deletedOffset + 50)}>{ui('Next')}</ActionButton></div>
      </section>}
      {tab === 'users' && (
        <section className={card}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Users size={18} />{ui('Users')} {users.data && <span className="opacity-60 font-normal">({users.data.length})</span>}</h2>
          {users.isLoading && <p className="opacity-60">{ui('Loading…')}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left opacity-60"><th className="py-2 pr-3">{ui('Account')}</th><th className="py-2 pr-3">{ui('Email')}</th><th className="py-2 pr-3 text-right">{ui('Posts')}</th><th className="py-2 pr-3 text-right">{ui('Reported')}</th><th className="py-2 pr-3">{ui('Joined')}</th><th className="py-2 pr-3">{ui('Last active')}</th><th className="py-2" /></tr></thead>
              <tbody>
                {users.data?.map((account: AdminUser) => {
                  const isAdminAccount = account.role === 'admin';
                  return (
                    <tr key={account.id} className={`border-t align-top ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <td className="py-2 pr-3">
                        <Link to={`/profile/${account.username}`} className="font-semibold hover:text-blue-600 dark:hover:text-blue-400">{account.display_name || account.username}</Link>
                        <div className="text-xs opacity-60">@{account.username}{isAdminAccount && <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">Admin</span>}</div>
                      </td>
                      <td className="py-2 pr-3 break-all">{account.email}<div className="text-xs opacity-60">{account.google_account ? 'Google' : ui('Password')}{account.email_verified ? '' : ` · ${ui('unverified')}`}</div></td>
                      <td className="py-2 pr-3 text-right tabular-nums">{account.posts}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{account.reports_against}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{when(account.created_at)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{when(account.last_login)}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {permissions.data?.canManageRoles && !account.can_manage_roles && <ActionButton disabled={actions.role.isPending} onClick={() => actions.role.mutate({ id: account.id, role: isAdminAccount ? 'user' : 'admin' }, { onError: fail })}>{ui(isAdminAccount ? 'Remove admin' : 'Make admin')}</ActionButton>}
                        {!isAdminAccount && (confirmUser === account.id ? (
                          <span className="inline-flex gap-2">
                            <ActionButton tone="danger" disabled={actions.deleteUser.isPending} onClick={() => actions.deleteUser.mutate(account.id, { onSuccess: () => setConfirmUser(null), onError: fail })}>{ui('Delete permanently')}</ActionButton>
                            <ActionButton onClick={() => setConfirmUser(null)}>{ui('Cancel')}</ActionButton>
                          </span>
                        ) : (
                          <ActionButton tone="danger" onClick={() => setConfirmUser(account.id)}><Trash2 size={13} />{ui('Delete user')}</ActionButton>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs opacity-60">{ui('Deleting a user also removes their posts, comments, likes, bookmarks and sessions. This cannot be undone.')}</p>
        </section>
      )}
    </main>
  );
}
