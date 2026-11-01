import * as RadixDialog from '@radix-ui/react-dialog';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { useIsMobile } from '../ui/use-mobile';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Bug, CheckCircle2, Lightbulb, MessageSquare, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { OPEN_FEEDBACK_EVENT, useSendFeedback, type FeedbackKind } from '../../hooks/useFeedback';

const MAX_LENGTH = 2000;
const MIN_LENGTH = 5;

const KINDS: Array<{ id: FeedbackKind; label: string; icon: typeof Bug }> = [
  { id: 'bug', label: 'Bug', icon: Bug },
  { id: 'suggestion', label: 'Suggestion', icon: Lightbulb },
  { id: 'other', label: 'Other', icon: MessageSquare },
];

/** Feedback form for every reader, signed in or not. Bug reports, suggestions and anything
 * else go to /api/feedback; admins see them on the Admin page and get an email. */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ui = useUiText();
  const { isDark, user } = useApp();
  const location = useLocation();
  const send = useSendFeedback();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const messageId = useId();
  const emailId = useId();
  const countId = useId();
  // A draggable bottom sheet on phones, a dialog elsewhere; a sent message is confirmed with a toast.
  const isMobile = useIsMobile();
  const sheet = isMobile;
  const Dialog = sheet ? Drawer : RadixDialog;

  useEffect(() => {
    if (send.isSuccess && open) {
      onOpenChange(false);
      toast.success(ui('Thank you! Your feedback was sent.'), { description: ui('An admin will review it soon.') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send.isSuccess]);

  // A fresh form each time it opens, unless the last send failed and the text is worth keeping.
  useEffect(() => {
    if (open && send.isSuccess) {
      setMessage(''); setKind('bug'); send.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trimmed = message.trim();
  const tooShort = trimmed.length < MIN_LENGTH;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (tooShort || send.isPending) return;
    send.mutate({
      kind,
      message: trimmed,
      page: `${location.pathname}${location.search}`.slice(0, 300),
      ...(user ? {} : { contactEmail: contactEmail.trim() }),
      ...(website ? { website } : {}),
    });
  };

  const field = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    isDark ? 'border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500' : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
  }`;
  const muted = isDark ? 'text-slate-400' : 'text-gray-500';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={`fixed z-[95] overflow-y-auto overscroll-contain border p-5 shadow-2xl ${sheet
            ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.25rem)] outline-none'
            : 'left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl'} ${
            isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-gray-100 bg-white text-gray-900'
          }`}
        >
          {sheet && <div aria-hidden className={`mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`} />}
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-poppins text-lg font-bold">{ui('Send feedback')}</Dialog.Title>
              <Dialog.Description className={`mt-1 text-sm ${muted}`}>
                {ui('Report a bug or suggest an improvement. The NewsAgg team reads every message.')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={ui('Close')}
              className={`shrink-0 rounded-xl p-2 transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          {send.isSuccess ? (
            <div role="status" className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="font-semibold">{ui('Thank you! Your feedback was sent.')}</p>
              <p className={`text-sm ${muted}`}>{ui('An admin will review it soon.')}</p>
              <Dialog.Close className="mt-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]">
                {ui('Done')}
              </Dialog.Close>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{ui('What is it about?')}</legend>
                <div role="radiogroup" className="grid grid-cols-3 gap-2">
                  {KINDS.map(({ id, label, icon: Icon }) => {
                    const active = kind === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setKind(id)}
                        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-sm font-medium transition-colors ${
                          active ? 'bg-[var(--brand)] text-white' : isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="max-w-full break-words text-center leading-tight">{ui(label)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor={messageId} className="mb-1.5 block text-sm font-semibold">{ui('Your message')}</label>
                <textarea
                  id={messageId}
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, MAX_LENGTH))}
                  maxLength={MAX_LENGTH}
                  rows={5}
                  required
                  aria-describedby={countId}
                  placeholder={ui(kind === 'bug' ? 'What happened, and what did you expect?' : kind === 'suggestion' ? 'What would make NewsAgg better for you?' : 'Tell us anything.')}
                  className={`${field} resize-y min-h-28`}
                />
                <p id={countId} className={`mt-1 text-right text-xs tabular-nums ${muted}`}>{message.length}/{MAX_LENGTH}</p>
              </div>

              {!user && (
                <div>
                  <label htmlFor={emailId} className="mb-1.5 block text-sm font-semibold">
                    {ui('Email')} <span className={`font-normal ${muted}`}>({ui('optional, if you want a reply')})</span>
                  </label>
                  <input id={emailId} type="email" inputMode="email" autoComplete="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} maxLength={254} className={field} />
                </div>
              )}

              {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(event) => setWebsite(event.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />

              {send.isError && (
                <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600">
                  {send.error instanceof Error && !/^HTTP \d/.test(send.error.message) ? ui(send.error.message) : ui('Could not send feedback. Please try again.')}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <Dialog.Close type="button" className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {ui('Cancel')}
                </Dialog.Close>
                <button type="submit" disabled={tooShort || send.isPending} className="rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50">
                  {send.isPending ? ui('Sending…') : ui('Send feedback')}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Mounted once in Root; anything can open it with openFeedback(). */
export function FeedbackHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_FEEDBACK_EVENT, show);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, show);
  }, []);
  return <FeedbackDialog open={open} onOpenChange={setOpen} />;
}
