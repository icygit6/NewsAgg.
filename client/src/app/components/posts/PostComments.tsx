import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Loader2, Send, Trash2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { useCommentMutations, usePostComments, type PostComment } from '../../hooks/usePosts';
import { InfiniteScrollFooter } from '../ui/InfiniteScrollFooter';
import { useDeletedContent } from '../../hooks/useAdmin';
import { LoadError } from '../ui/ErrorNote';
import { errorText } from '../ui/ErrorNote';
import { LoadingIndicator } from '../ui/ContentSkeleton';
import { emptyNote } from '../ui/styles';

const MAX_COMMENT_LENGTH = 500;

interface Thread { root: PostComment; replies: PostComment[] }

// The API returns each thread as its top-level comment followed by its
// replies; group them back up, keeping the server's order.
function toThreads(comments: PostComment[]): Thread[] {
  const threads = new Map<number, Thread>();
  for (const comment of comments) {
    const rootId = comment.root_id ?? comment.id;
    const thread = threads.get(rootId);
    if (!thread) threads.set(rootId, { root: comment, replies: [] });
    else thread.replies.push(comment);
  }
  return [...threads.values()];
}

function CommentRow({ comment, rootId, onReply, onDelete, own, deleting }: {
  comment: PostComment;
  rootId: number;
  onReply: (comment: PostComment) => void;
  onDelete: (id: number) => void;
  isDark: boolean;
  own: boolean;
  deleting: boolean;
}) {
  const ui = useUiText();
  if (comment.removed) return <p className="py-3 text-xs italic opacity-60">{ui('Comment removed')}</p>;
  return (
    <div className="flex gap-2.5 py-3">
      <img loading="lazy" src={comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.username)}`} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <Link to={`/profile/${comment.username}`} className="font-semibold hover:text-blue-600 dark:hover:text-blue-400">{comment.display_name || comment.username}</Link>
          <time dateTime={comment.created_at} className="opacity-50">{new Date(comment.created_at).toLocaleString()}</time>
        </div>
        {comment.parent_id && comment.parent_id !== rootId && comment.parent_username && <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">{ui('Reply to')} @{comment.parent_username}</p>}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.content}</p>
        <div className={`mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400`}>
          <button type="button" onClick={() => onReply(comment)} className="font-semibold hover:text-blue-600 dark:hover:text-blue-400">{ui('Reply')}</button>
          {own && <button type="button" onClick={() => onDelete(comment.id)} disabled={deleting} className="inline-flex items-center gap-1 hover:text-red-500 disabled:opacity-50"><Trash2 size={14} />{ui('Delete')}</button>}
        </div>
      </div>
    </div>
  );
}

function Composer({ label, pending, autoFocus, onSubmit, onCancel }: {
  label: string;
  pending: boolean;
  isDark: boolean;
  autoFocus?: boolean;
  onSubmit: (content: string) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const ui = useUiText();
  const { isAuthenticated, setSidebarOpen } = useApp();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!isAuthenticated) { setSidebarOpen(true); return; }
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH || pending) return;
    setError('');
    try { await onSubmit(trimmed); setContent(''); } catch (reason) { setError((reason as Error).message); }
  };

  return (
    <div className="mt-2">
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onFocus={() => { if (!isAuthenticated) setSidebarOpen(true); }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void submit(); }
            if (event.key === 'Escape' && onCancel) onCancel();
          }}
          autoFocus={autoFocus}
          maxLength={MAX_COMMENT_LENGTH}
          rows={2}
          aria-label={label}
          placeholder={label}
          className={`min-w-0 flex-1 resize-y rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700`}
        />
        <button type="button" onClick={() => void submit()} disabled={!content.trim() || pending} aria-label={ui('Send comment')} className="rounded-xl bg-[var(--brand)] p-2.5 text-white disabled:opacity-50">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-end gap-3 text-xs">
        {onCancel && <button type="button" onClick={onCancel} className="font-semibold opacity-70 hover:opacity-100">{ui('Cancel')}</button>}
        <span className="opacity-60">{content.length}/{MAX_COMMENT_LENGTH}</span>
      </div>
      {error && <p role="alert" className={`mt-1 text-xs ${errorText}`}>{error}</p>}
    </div>
  );
}

export function PostComments({ postId }: { postId: number }) {
  const ui = useUiText();
  const { isDark, isAuthenticated, setSidebarOpen, user } = useApp();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = usePostComments(postId, true);
  const { create, remove } = useCommentMutations(postId);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const deleted = useDeletedContent(0, showDeleted, postId);
  const threads = toThreads(data?.pages.flatMap((page) => page.comments) ?? []);

  const setOpen = (rootId: number, open: boolean) => setExpanded((current) => {
    const next = new Set(current);
    if (open) next.add(rootId); else next.delete(rootId);
    return next;
  });
  const startReply = (target: PostComment) => {
    if (!isAuthenticated) { setSidebarOpen(true); return; }
    setOpen(target.root_id ?? target.id, true);
    setReplyTo(target);
  };
  const row = (comment: PostComment, rootId: number) => (
    <CommentRow key={comment.id} comment={comment} rootId={rootId} isDark={isDark} own={user?.id === comment.user_id || user?.role === 'admin'} deleting={remove.isPending} onReply={startReply} onDelete={(id) => remove.mutate(id, { onError: (reason) => setError(reason.message) })} />
  );

  return (
    <section aria-label={ui('Comments')} className={`mt-3 border-t pt-3 border-slate-200 dark:border-slate-700`}>
      {isLoading && <LoadingIndicator label={ui('Loading comments…')} />}
      {isError && <LoadError message={ui('Could not load comments.')} onRetry={() => void refetch()} />}
      {!isLoading && !isError && threads.length === 0 && <p className={emptyNote}>{ui('No comments yet. Start the conversation.')}</p>}
      <div className={`divide-y divide-slate-100 dark:divide-slate-800`}>
        {threads.map(({ root, replies }) => {
          const open = expanded.has(root.id);
          const replying = replyTo && (replyTo.root_id ?? replyTo.id) === root.id;
          return (
            <div key={root.id}>
              {row(root, root.id)}
              {replies.length > 0 && (
                <button type="button" onClick={() => setOpen(root.id, !open)} aria-expanded={open} className="mb-2 ml-10 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                  <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  {open ? ui('Hide replies') : `${ui('View replies')} (${replies.length})`}
                </button>
              )}
              {(open && replies.length > 0 || replying) && (
                <div className="mb-3 ml-5 border-l-2 border-blue-500/25 pl-3">
                  {open && <div className={`divide-y divide-slate-100 dark:divide-slate-800`}>{replies.map((reply) => row(reply, root.id))}</div>}
                  {replying && (
                    <div className="pb-1">
                      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">{ui('Reply to')} @{replyTo.username}</p>
                      <Composer
                        key={replyTo.id}
                        autoFocus
                        label={ui('Write a reply')}
                        isDark={isDark}
                        pending={create.isPending}
                        onCancel={() => setReplyTo(null)}
                        onSubmit={(content) => create.mutateAsync({ content, parentId: replyTo.id }).then(() => { setReplyTo(null); setOpen(root.id, true); })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <InfiniteScrollFooter compact hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} isError={isFetchNextPageError} fetchNextPage={fetchNextPage} />
      {user?.role === 'admin' && <details className="mt-3 text-sm" onToggle={event => { const open = event.currentTarget.open; setShowDeleted(open); if (open) void deleted.refetch(); }}>
        <summary className="cursor-pointer font-semibold">{ui('Deleted messages')} · {ui('Admin only')}</summary>
        {deleted.isError && <LoadError message={ui('Could not load deleted content.')} />}
        {deleted.data?.map(item => <div key={item.id} className="py-2 border-b border-slate-400/20"><p className="text-xs opacity-60">#{item.target_id} · @{item.author_username || '—'} · {new Date(item.deleted_at).toLocaleString()}</p><p className="whitespace-pre-wrap break-words">{item.content}</p></div>)}
        {deleted.data?.length === 0 && <p className={emptyNote}>{ui('No deleted content.')}</p>}
      </details>}
      <Composer label={ui('Write a comment')} isDark={isDark} pending={create.isPending && !replyTo} onSubmit={(content) => create.mutateAsync({ content })} />
      {error && <p role="alert" className={`mt-1 text-xs ${errorText}`}>{error}</p>}
    </section>
  );
}
