import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { usePostMutations } from '../../hooks/usePosts';
import { useArticle } from '../../hooks/useArticle';
import { PostCategorySelect } from './PostCategorySelect';
import { errorText } from '../ui/ErrorNote';

const MAX_CHARS = 280;

interface PostComposerProps {
  /** Article id pre-attached via /posts?compose=1&attach=<id> or "Quote this". */
  attachId?: string;
  onAttachClear?: () => void;
  autoFocus?: boolean;
}

/** ≤280-char composer with live counter (rose past 260) and an optional
 * attached-article preview chip. */
export function PostComposer({ attachId, onAttachClear, autoFocus = false }: PostComposerProps) {
  const ui = useUiText();
  const { t, avatarSrc } = useApp();
  const { create } = usePostMutations();
  const [content, setContent] = useState(() => localStorage.getItem('postDraft') || '');
  const [error, setError] = useState('');
  const [category, setCategory] = useState('General');

  const { data: attached, isError: attachmentError } = useArticle(attachId);
  useEffect(() => { if (content) localStorage.setItem('postDraft', content); else localStorage.removeItem('postDraft'); }, [content]);

  const remaining = MAX_CHARS - content.length;
  const canSubmit = content.trim().length > 0 && remaining >= 0 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    setError('');
    create.mutate(
      { content: content.trim(), articleId: attachId, category },
      {
        onSuccess: () => {
          setContent('');
          setCategory('General');
          onAttachClear?.();
        },
        onError: (err) => setError(err.message || t.postFailed),
      },
    );
  };

  return (
    <div
      className={`rounded-2xl border p-4 bg-white border-slate-200 dark:bg-slate-900/70 dark:border-slate-800`}
    >
      <div className="flex gap-3">
        <img
          src={avatarSrc}
          alt=""
          className="w-9 h-9 rounded-full object-cover bg-slate-300 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="relative">
            <textarea
              name="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.whatsHappening}
              rows={3}
              autoFocus={autoFocus}
              maxLength={MAX_CHARS}
              onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submit(); } }}
              className={`block w-full resize-none field-sizing-content min-h-24 max-h-72 pt-2 pb-6 bg-transparent outline-none text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500`}
            />
            {/* Count sits in the writing area's corner; the bottom padding keeps text clear of it. */}
            <span
              className={`pointer-events-none absolute bottom-1 right-0 text-xs tabular-nums ${
                remaining < 0
                  ? 'text-red-500 font-bold'
                  : remaining <= 20
                    ? 'text-red-400'
                    : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {content.length}/{MAX_CHARS}
            </span>
          </div>

          {attachId && attached && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 mb-2 border-slate-200 dark:border-slate-700`}
            >
              {attached.urlToImage && (
                <img
                  src={attached.urlToImage}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs text-slate-400 dark:text-slate-500`}>
                  {t.attachedArticle}
                </p>
                <p
                  className={`text-xs font-medium truncate text-slate-800 dark:text-slate-200`}
                >
                  {attached.title}
                </p>
              </div>
              {onAttachClear && (
                <button
                  onClick={onAttachClear}
                  aria-label={t.cancel}
                  className={`p-1 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {attachId && attachmentError && <p role="alert" className={`text-xs ${errorText} mb-2`}>{ui("The attached article could not be loaded. Remove it or try again.")}</p>}

          {error && <p role="alert" aria-live="polite" className={`text-xs ${errorText} mb-2`}>{error}</p>}

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <PostCategorySelect variant="compose" value={category} onChange={setCategory} label={ui('Post category')} />
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--brand)' }}
            >
              {create.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {t.post}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
