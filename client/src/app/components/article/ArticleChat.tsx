import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, ChevronDown, Eraser, Loader2, Send, Sparkles, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { getArticleId } from '../../services/newsAPI';
import { getRuntimeConfig } from '../../lib/runtimeConfig';
import { useUiText } from '../../i18n/uiText';
import { scrollMainToTop, useMainScrolledPast } from '../ScrollToTop';
import type { Language } from '../../i18n/translations';
import type { NewsArticle } from '../../types/article';

// Backend proxy keeps GROQ_API_KEY server-side (see CLAUDE.md: POST /api/chat).
const API_BASE = import.meta.env.VITE_API_URL || '';

// App language codes → human-language codes the model should answer in.
const LANG_CODE: Record<Language, string> = {
  en: 'en',
  id: 'id',
  zhCN: 'zh-CN',
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
  const ui = useUiText();
  const scrolledDown = useMainScrolledPast(400, storageKey);
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
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        credentials: 'include',
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
      {/* Floating controls (hidden while the panel is open): scroll-to-top sits
          beside the chat trigger in one row instead of stacking above it. */}
      {!open && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-6 z-40 flex items-center gap-3">
          <AnimatePresence>
            {scrolledDown && (
              <motion.button
                key="to-top"
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => scrollMainToTop(true)}
                aria-label={ui('Scroll to top')}
                title={ui('Scroll to top')}
                className={`grid place-items-center w-11 h-11 rounded-full shadow-lg ring-1 transition-colors ${isDark ? 'bg-slate-800 text-slate-100 ring-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
              >
                <ArrowUp size={18} />
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/20 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <Sparkles size={16} className="transition-transform group-hover:rotate-12" />
            {askLabel}
          </button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile-only dimmer: on small screens the panel covers most of the
                width, so a tap-to-close scrim helps. Desktop stays scrim-free so
                the article keeps scrolling behind the docked panel. */}
            <motion.div
              key="chat-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="chat-panel"
              aria-label={askLabel}
              initial={{ x: 380, opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0.5 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className={`fixed top-0 right-0 z-[60] h-dvh w-full max-w-sm flex flex-col overflow-hidden border-l shadow-2xl lg:rounded-l-3xl ${isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-gray-100'}`}
            >
              <div className={`relative shrink-0 px-4 py-3 border-b ${isDark ? 'border-slate-700/60' : 'border-gray-100'}`}>
                {/* Gradient hairline, echoing the floating trigger. */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-pink-500" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-white shadow-sm bg-gradient-to-br from-cyan-500 to-pink-500">
                      <Sparkles size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{t.askAI}</p>
                        {modelLabel && (
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${isDark ? 'bg-slate-800 text-cyan-300 ring-1 ring-slate-700' : 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100'}`}
                          >
                            {modelLabel}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t.chatAbout} {article.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {messages.length > 0 && (
                      <button
                        type="button"
                        onClick={clearChat}
                        aria-label={t.clearChat}
                        title={t.clearChat}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
                      >
                        <Eraser size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t.chatClose}
                      title={t.chatClose}
                      onClick={() => setOpen(false)}
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && !loading && (
                  <div className="pt-6 text-center">
                    <span className={`inline-grid place-items-center w-12 h-12 rounded-2xl ${isDark ? 'bg-slate-800 text-cyan-300' : 'bg-cyan-50 text-cyan-600'}`}>
                      <Sparkles size={20} />
                    </span>
                    <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{t.chatWelcome}</p>
                    <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{t.chatGrounded}</p>
                    {/* Starter questions: one tap sends, so an empty panel is
                        never a blank prompt the reader has to fill in. */}
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {t.chatSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDark ? 'bg-slate-800 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700' : 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'}`}
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
                      <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-white bg-gradient-to-br from-cyan-500 to-pink-500">
                        <Sparkles size={12} />
                      </span>
                    )}
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-br-md'
                          : isDark
                            ? 'bg-slate-800 text-slate-100 ring-1 ring-slate-700/60 rounded-bl-md'
                            : 'bg-gray-50 text-gray-800 ring-1 ring-gray-100 rounded-bl-md'
                      }`}
                    >
                      {message.content}
                      {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                        <details className={`group mt-2.5 pt-2.5 border-t ${isDark ? 'border-slate-700/60' : 'border-gray-200'}`}>
                          <summary
                            className={`list-none cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
                            {t.chatSources} · {message.citations.length}
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {message.citations.map((citation) => (
                              <p
                                key={citation.index}
                                className={`line-clamp-4 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed ${isDark ? 'bg-slate-900/60 text-slate-400' : 'bg-white text-gray-500'}`}
                              >
                                <span className={`mr-1 font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>[{citation.index}]</span>
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
                    <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-white bg-gradient-to-br from-cyan-500 to-pink-500">
                      <Sparkles size={12} />
                    </span>
                    <div className={`flex items-center gap-1 px-3.5 py-3 rounded-2xl rounded-bl-md shadow-sm ${isDark ? 'bg-slate-800 ring-1 ring-slate-700/60' : 'bg-gray-50 ring-1 ring-gray-100'}`}>
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-slate-400' : 'bg-gray-400'}`}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={`shrink-0 px-4 py-3 border-t ${isDark ? 'border-slate-700/60' : 'border-gray-100'}`}>
                <div
                  className={`flex items-center gap-2 rounded-2xl pl-3.5 pr-1.5 py-1.5 ${isDark ? 'bg-slate-800 focus-within:ring-2 focus-within:ring-cyan-500/40' : 'bg-gray-100 focus-within:ring-2 focus-within:ring-cyan-500/30'}`}
                >
                  <input
                    name="chat-message"
                    aria-label={t.chatPlaceholder}
                    autoComplete="off"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.chatPlaceholder}
                    className={`flex-1 min-w-0 bg-transparent py-1.5 text-sm outline-none ${isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-gray-900 placeholder:text-gray-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    aria-label={t.chatSend}
                    title={t.chatSend}
                    disabled={!input.trim() || loading}
                    className="grid place-items-center shrink-0 w-9 h-9 rounded-xl text-white bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-40 transition-all"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
