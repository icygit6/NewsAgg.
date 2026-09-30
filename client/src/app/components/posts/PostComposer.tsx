import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { usePostMutations } from '../../hooks/usePosts';
import { useArticle } from '../../hooks/useArticle';
import { PostCategoryPicker } from './PostCategoryPicker';

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
  const { t, isDark, avatarSrc } = useApp();
  const { create } = usePostMutations();
  const [content, setContent] = useState(() => localStorage.getItem('postDraft') || '');
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');

  const { data: attached, isError: attachmentError } = useArticle(attachId);
  useEffect(() => { if (content) localStorage.setItem('postDraft', content); else localStorage.removeItem('postDraft'); }, [content]);

  const remaining = MAX_CHARS - content.length;
  const canSubmit = content.trim().length > 0 && remaining >= 0 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    setError('');
    create.mutate(
      { content: content.trim(), articleId: attachId, category: category || undefined },
      {
        onSuccess: () => {
          setContent('');
          setCategory('');
          onAttachClear?.();
        },
        onError: (err) => setError(err.message || t.postFailed),
      },
    );
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}
    >
      <div className="flex gap-3">
        <img
          src={avatarSrc}
          alt=""
          className="w-9 h-9 rounded-full object-cover bg-slate-300 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <textarea
            name="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.whatsHappening}
            rows={3}
            autoFocus={autoFocus}
            maxLength={MAX_CHARS}
            onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submit(); } }}
            className={`w-full resize-none bg-transparent outline-none text-sm leading-relaxed ${
              isDark
                ? 'text-slate-100 placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />

          {attachId && attached && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 mb-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
            >
              {attached.urlToImage && (
                <img
                  src={attached.urlToImage}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t.attachedArticle}
                </p>
                <p
                  className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                >
                  {attached.title}
                </p>
              </div>
              {onAttachClear && (
                <button
                  onClick={onAttachClear}
                  aria-label={t.cancel}
                  className={`p-1 rounded-full ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {attachId && attachmentError && <p role="alert" className="text-xs text-rose-500 mb-2">{ui("The attached article could not be loaded. Remove it or try again.")}</p>}

          {error && <p role="alert" aria-live="polite" className="text-xs text-rose-500 mb-2">{error}</p>}

          <PostCategoryPicker value={category} onChange={setCategory} allLabel={ui('Auto category')} isDark={isDark} ariaLabel={ui('Post category')} />
          <div className="mt-3 flex items-center justify-end gap-3">
            <span
              className={`text-xs tabular-nums ${
                remaining < 0
                  ? 'text-rose-500 font-bold'
                  : remaining <= 20
                    ? 'text-rose-400'
                    : isDark
                      ? 'text-slate-500'
                      : 'text-slate-400'
              }`}
            >
              {remaining}
            </span>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--brand-grad, #2563eb)' }}
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
