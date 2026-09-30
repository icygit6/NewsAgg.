import { useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { useCommentMutations, usePostComments, type PostComment } from '../../hooks/usePosts';

const MAX_COMMENT_LENGTH = 500;

function CommentRow({ comment, onReply, onDelete, isDark, own, deleting }: {
  comment: PostComment;
  onReply: (comment: PostComment) => void;
  onDelete: (id: number) => void;
  isDark: boolean;
  own: boolean;
  deleting: boolean;
}) {
  const ui = useUiText();
  return (
    <div className={`flex gap-2.5 py-3 ${comment.parent_id ? 'ml-5 border-l-2 border-cyan-500/25 pl-3' : ''}`}>
      <img loading="lazy" src={comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.username)}`} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <Link to={`/profile/${comment.username}`} className="font-semibold hover:text-cyan-500">{comment.display_name || comment.username}</Link>
          <time dateTime={comment.created_at} className="opacity-50">{new Date(comment.created_at).toLocaleString()}</time>
        </div>
        {comment.parent_id && comment.parent_username && <p className="mt-1 text-xs text-cyan-500">{ui('Reply to')} @{comment.parent_username}</p>}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.content}</p>
        <div className={`mt-1 flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <button type="button" onClick={() => onReply(comment)} className="font-semibold hover:text-cyan-500">{ui('Reply')}</button>
          {own && <button type="button" onClick={() => onDelete(comment.id)} disabled={deleting} className="inline-flex items-center gap-1 hover:text-rose-500 disabled:opacity-50"><Trash2 size={12} />{ui('Delete')}</button>}
        </div>
      </div>
    </div>
  );
}

export function PostComments({ postId }: { postId: number }) {
  const ui = useUiText();
  const { isDark, isAuthenticated, setSidebarOpen, user } = useApp();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = usePostComments(postId, true);
  const { create, remove } = useCommentMutations(postId);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [error, setError] = useState('');
  const comments = data?.pages.flatMap((page) => page.comments) ?? [];

  const submit = () => {
    if (!isAuthenticated) { setSidebarOpen(true); return; }
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH || create.isPending) return;
    setError('');
    create.mutate({ content: trimmed, parentId: replyTo?.id }, {
      onSuccess: () => { setContent(''); setReplyTo(null); },
      onError: (reason) => setError(reason.message),
    });
  };

  return (
    <section aria-label={ui('Comments')} className={`mt-3 border-t pt-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      {isLoading && <p role="status" className="text-xs opacity-60">{ui('Loading comments…')}</p>}
      {isError && <p role="alert" className="text-xs text-rose-500">{ui('Could not load comments.')} <button type="button" onClick={() => void refetch()} className="underline">{ui('Retry')}</button></p>}
      {!isLoading && !isError && comments.length === 0 && <p className="text-xs opacity-60">{ui('No comments yet. Start the conversation.')}</p>}
      <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
        {comments.map((comment) => <CommentRow key={comment.id} comment={comment} isDark={isDark} own={user?.id === comment.user_id} deleting={remove.isPending} onReply={(target) => { if (!isAuthenticated) { setSidebarOpen(true); return; } setReplyTo(target); }} onDelete={(id) => remove.mutate(id, { onError: (reason) => setError(reason.message) })} />)}
      </div>
      {hasNextPage && <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage} className="mt-2 text-xs font-semibold text-cyan-500 disabled:opacity-50">{ui(isFetchingNextPage ? 'Loading…' : 'Load more comments')}</button>}
      {replyTo && <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-cyan-500/10 px-3 py-2 text-xs"><span>{ui('Reply to')} @{replyTo.username}</span><button type="button" onClick={() => setReplyTo(null)} className="font-semibold">{ui('Cancel')}</button></div>}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onFocus={() => { if (!isAuthenticated) setSidebarOpen(true); }}
          onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submit(); } }}
          maxLength={MAX_COMMENT_LENGTH}
          rows={2}
          aria-label={replyTo ? ui('Write a reply') : ui('Write a comment')}
          placeholder={replyTo ? ui('Write a reply') : ui('Write a comment')}
          className={`min-w-0 flex-1 resize-y rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
        />
        <button type="button" onClick={submit} disabled={!content.trim() || create.isPending} aria-label={ui('Send comment')} className="rounded-xl bg-cyan-500 p-2.5 text-white disabled:opacity-50">
          {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <div className="mt-1 flex justify-end text-xs opacity-60">{content.length}/{MAX_COMMENT_LENGTH}</div>
      {error && <p role="alert" className="mt-1 text-xs text-rose-500">{error}</p>}
    </section>
  );
}
