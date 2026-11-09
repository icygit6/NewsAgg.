import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { ChevronDown, Eraser, Loader2, Send, Sparkles, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { getArticleId } from '../../services/newsAPI';
import { getRuntimeConfig } from '../../lib/runtimeConfig';
import { getMain, useMainScrolledPast } from '../../hooks/useMainScroll';
import { ScrollTopButton } from '../ui/ScrollTopButton';
import type { Language } from '../../i18n/translations';
import type { NewsArticle } from '../../types/article';
import { authFetch } from '../../lib/apiFetch';

// Backend proxy keeps GROQ_API_KEY server-side (see CLAUDE.md: POST /api/chat).

// App language codes → human-language codes the model should answer in.
const LANG_CODE: Record<Language, string> = {
  en: 'en',
  zhTW: 'zh-TW',
};

// History caps: persist at most 30 turns per article; replay the last 10 to
// the model (the server trims further to its token budget).
const STORED_TURNS = 30;
const REPLAYED_TURNS = 10;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ index: number; text: string }>;
}

const loadHistory = (key: string): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').slice(-STORED_TURNS) : [];
  } catch {
    return [];
  }
};

interface ArticleChatProps {
  article: NewsArticle;
  isDark: boolean;
}

export function ArticleChat({ article, isDark }: ArticleChatProps) {
  const { user } = useApp();
  return <ArticleChatSession key={`${user?.id ?? 'guest'}:${getArticleId(article)}`} article={article} isDark={isDark} />;
}

function ArticleChatSession({ article, isDark }: ArticleChatProps) {
  const { t, language, newsMode, isAuthenticated, user } = useApp();
  // In Multi mode answers follow the article's own language, like its text.
  const answerLang = newsMode === 'original'
    ? ((article.language || '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en')
    : LANG_CODE[language];
  const storageKey = `chat:${user?.id ?? 'guest'}:${getArticleId(article)}`;
  // Name the actual model (from the API's public config) instead of a generic
  // "AI"; falls back to the translated generic label when the API hasn't
  // reported one.
  const modelLabel = getRuntimeConfig().chatModelLabel;
  const askLabel = modelLabel ? t.askModel.replace('{model}', modelLabel) : t.askAI;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(storageKey));
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledDown = useMainScrolledPast(400, storageKey);
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const scrimOpacity = useTransform(x, value => Math.max(0, 1 - Math.max(0, value) / 320));
  const leaving = useRef(false);
  // A fresh opening starts at rest; the panel unmounts on close, so this only clears the last swipe.
  useLayoutEffect(() => {
    if (!open) return;
    leaving.current = false;
    x.set(0);
  }, [open, x]);

  // Escape closes the panel; the focus goes back to where it was.
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); before?.focus?.({ preventScroll: true }); };
  }, [open]);

  const startSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || leaving.current) return;
    // The message box and its text keep their own gestures.
    if ((event.target as Element).closest('input, textarea, select, summary, details')) return;
    dragControls.start(event);
  };
  const endSwipe = (_event: unknown, info: PanInfo) => {
    const close = info.offset.x > 90 || info.velocity.x > 500;
    // Continue from where the finger let go, with its speed, instead of snapping back and re-sliding.
    const spring = { type: 'spring' as const, stiffness: 520, damping: 44, velocity: info.velocity.x, restDelta: 1, restSpeed: 10 };
    if (!close) { animate(x, 0, reducedMotion ? { duration: 0 } : spring); return; }
    leaving.current = true;
    const distance = panelRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    animate(x, distance, { ...(reducedMotion ? { duration: 0 } : spring), onComplete: () => setOpen(false) });
  };
  // Phones: fold the pill into a circle while reading down, bring it back when scrolling up or at the top.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    setCompact(false);
    let last = getMain()?.scrollTop ?? 0;
    const onScroll = (event: Event) => {
      const main = getMain();
      if (!main || event.target !== main) return;
      const top = main.scrollTop;
      if (top <= 200) setCompact(false);
      else if (top > last + 8) setCompact(true);
      else if (top < last - 8) setCompact(false);
      if (Math.abs(top - last) > 8) last = top;
    };
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [storageKey]);
  // Tracks which article the state currently belongs to, so a reply that
  // resolves after navigating to another article (component stays mounted)
  // can't write the old article's conversation into the new one's state —
  // the persist effect would then save it under the wrong storage key.
  const activeKeyRef = useRef(storageKey);

  // Re-hydrate when navigating between articles (component stays mounted).
  useEffect(() => {
    activeKeyRef.current = storageKey;
    setMessages(loadHistory(storageKey));
    setLoading(false); // any in-flight reply belongs to the previous article
  }, [storageKey]);

  // Persist per-article history, capped so localStorage stays small.
  useEffect(() => {
    try {
      if (messages.length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(messages.slice(-STORED_TURNS)));
    } catch {
      // Quota/private-mode failures just lose persistence, never the chat.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const clearChat = () => setMessages([]);

  const sendMessage = async (preset?: string) => {
    const trimmed = (preset ?? input).trim();
    if (!trimmed || loading) return;

    const keyAtSend = storageKey;
    const history = messages.slice(-REPLAYED_TURNS);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    // Stale guard: drop the result if the user navigated to a different
    // article while this reply was in flight.
    const stillCurrent = () => activeKeyRef.current === keyAtSend;

    try {
      if (!isAuthenticated) throw new Error('Please sign in to use AI chat.');
      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          articleId: getArticleId(article),
          lang: answerLang,
          ...(history.length > 0 ? { messages: history } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      const reply =
        typeof payload?.data === 'string'
          ? payload.data
          : payload?.data?.reply ?? payload?.message ?? 'No response received.';
      if (stillCurrent()) {
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content: reply,
            citations: Array.isArray(payload?.data?.citations) ? payload.data.citations : [],
          },
        ]);
      }
    } catch (error) {
      if (stillCurrent()) {
        const message = error instanceof Error && error.message === 'Please sign in to use AI chat.'
          ? (language === 'zhTW' ? '請先登入以使用 AI 問答。' : 'Please sign in to use AI chat.')
          : t.aiUnavailable;
        setMessages([...nextMessages, { role: 'assistant', content: message }]);
      }
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Floating controls (hidden while the panel is open). On phones the scroll-to-top
          circle stacks above the trigger, so both sit in one thumb column and the trigger
          never moves; desktop shows scroll-to-top beside the reading column instead.
          The pill folds into a circle while reading down the page. */}
      {!open && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          <ScrollTopButton show={scrolledDown} className="lg:hidden" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={askLabel}
            className={`group inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20 bg-[var(--brand)] hover:bg-[var(--brand-hover)] hover:shadow-xl hover:-translate-y-0.5 transition-all ${compact ? 'max-lg:size-12 lg:py-3 lg:pl-4 lg:pr-5' : 'py-3 pl-4 pr-5'}`}
          >
            <Sparkles size={16} className="transition-transform group-hover:rotate-12" />
            <span className={compact ? 'max-lg:hidden' : ''}>{askLabel}</span>
          </button>
        </div>
      )}

      {/* Portaled to the body like the account drawer, so it covers the top bar and bottom tabs. */}
      {createPortal(
      <AnimatePresence>
        {open && (
          <>
            {/* Dimmer below lg, where the panel covers most of the page. Desktop stays
                scrim-free so the article keeps scrolling behind the docked panel. It
                follows the drag, and has no backdrop blur (re-blurring every frame made
                the slide stutter on phones). */}
            <motion.div
              key="chat-overlay"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] lg:hidden"
            >
              <motion.div style={{ opacity: scrimOpacity }} className="absolute inset-0 bg-black/40" />
            </motion.div>
            {/* Two layers, like the account drawer: the outer one only slides in and out
                (a compositor transform); the inner one is what a swipe drags. */}
            <motion.aside
              key="chat-panel"
              ref={panelRef}
              aria-label={askLabel}
              initial={{ transform: 'translateX(100%)' }}
              animate={{ transform: 'translateX(0%)' }}
              exit={{ transform: 'translateX(100%)', transition: { duration: reducedMotion ? 0 : 0.2, ease: [0.4, 0, 1, 1] } }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
              style={{ willChange: 'transform' }}
              className="fixed inset-y-0 right-0 z-[70] w-full sm:w-[400px] sm:max-w-[95vw]"
            >
            <motion.div
              // Swipe right to close (touch and pen only; a mouse keeps selecting text).
              drag="x"
              dragListener={false}
              dragControls={dragControls}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 1 }}
              dragMomentum={false}
              onPointerDown={startSwipe}
              onDragEnd={endSwipe}
              style={{ x, willChange: 'transform' }}
              className="touch-pan-y flex h-full flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] border-l shadow-2xl sm:rounded-l-3xl bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-700/60"
            >
              <div className={`relative shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-700/60`}>
                {/* Gradient hairline, echoing the floating trigger. */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--brand)]" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-white shadow-sm bg-[var(--brand)]">
                      <Sparkles size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm font-semibold truncate text-slate-900 dark:text-slate-100`}>{t.askAI}</p>
                        {modelLabel && (
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-slate-800 dark:text-blue-300 dark:ring-1 dark:ring-slate-700`}
                          >
                            {modelLabel}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate text-slate-500 dark:text-slate-400`}>{t.chatAbout} {article.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {messages.length > 0 && (
                      <button
                        type="button"
                        onClick={clearChat}
                        aria-label={t.clearChat}
                        title={t.clearChat}
                        className={`p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400`}
                      >
                        <Eraser size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t.chatClose}
                      title={t.chatClose}
                      onClick={() => setOpen(false)}
                      className={`p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300`}
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
                {messages.length === 0 && !loading && (
                  <div className="pt-6 text-center">
                    <span className={`inline-grid place-items-center w-12 h-12 rounded-2xl ${isDark ? 'bg-slate-800 text-blue-300' : 'bg-blue-50 text-blue-600 dark:text-blue-400'}`}>
                      <Sparkles size={20} />
                    </span>
                    <p className={`mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300`}>{t.chatWelcome}</p>
                    <p className={`mt-1 text-xs text-slate-400 dark:text-slate-500`}>{t.chatGrounded}</p>
                    {/* Starter questions: one tap sends, so an empty panel is
                        never a blank prompt the reader has to fill in. */}
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {t.chatSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-1 dark:ring-slate-700 dark:hover:bg-slate-700`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-white bg-[var(--brand)]">
                        <Sparkles size={14} />
                      </span>
                    )}
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-[var(--brand)] text-white rounded-br-md'
                          : 'bg-slate-50 text-slate-800 ring-1 ring-slate-100 rounded-bl-md dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-700/60 dark:rounded-bl-md'
                      }`}
                    >
                      {message.content}
                      {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                        <details className={`group mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/60`}>
                          <summary
                            className={`list-none cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200`}
                          >
                            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                            {t.chatSources} · {message.citations.length}
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {message.citations.map((citation) => (
                              <p
                                key={citation.index}
                                className={`line-clamp-4 rounded-lg px-2 py-1.5 text-xs leading-relaxed bg-white text-slate-500 dark:bg-slate-900/60 dark:text-slate-400`}
                              >
                                <span className={`mr-1 font-semibold text-blue-600 dark:text-blue-300`}>[{citation.index}]</span>
                                {citation.text}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex items-end gap-2 justify-start">
                    <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-white bg-[var(--brand)]">
                      <Sparkles size={14} />
                    </span>
                    <div className={`flex items-center gap-1 px-3.5 py-3 rounded-2xl rounded-bl-md shadow-sm bg-slate-50 ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700/60`}>
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className={`w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-400`}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={`shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-700/60`}>
                <div
                  className={`flex items-center gap-2 rounded-2xl pl-3.5 pr-1.5 py-1.5 bg-slate-100 focus-within:ring-2 focus-within:ring-blue-500/30 dark:bg-slate-800 dark:focus-within:ring-2 dark:focus-within:ring-blue-500/40`}
                >
                  <input
                    name="chat-message"
                    aria-label={t.chatPlaceholder}
                    autoComplete="off"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.chatPlaceholder}
                    className={`flex-1 min-w-0 bg-transparent py-1.5 text-sm outline-none text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500`}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    aria-label={t.chatSend}
                    title={t.chatSend}
                    disabled={!input.trim() || loading}
                    className="grid place-items-center shrink-0 w-9 h-9 rounded-xl text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-40 transition-all"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </motion.div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>,
      document.body)}
    </>
  );
}
