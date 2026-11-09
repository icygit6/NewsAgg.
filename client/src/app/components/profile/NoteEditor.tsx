import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NotebookPen, X } from 'lucide-react';
import { useUiText } from '../../i18n/uiText';
import { useIsMobile } from '../ui/use-mobile';
import { button } from '../ui/styles';

interface NoteEditorProps {
  /** The saved note ('' when there is none). */
  note: string;
  onSave: (text: string) => void;
  onClose: () => void;
  storyTitle: string;
  /** The card's note chip, so pressing it again isn't taken for a click outside. */
  triggerRef: React.RefObject<HTMLElement | null>;
}

/** A bookmark's private note, shown first and edited only on request: a small
 * pop-up over the card on wider screens, a bottom sheet on phones. Both grow
 * with the note and never change the card's size. */
export function NoteEditor(props: NoteEditorProps) {
  const isPhone = useIsMobile(640);
  const note = useNoteState(props);
  return isPhone ? <NoteSheet {...props} state={note} /> : <NotePopover {...props} state={note} />;
}

type NoteState = ReturnType<typeof useNoteState>;

/** View ⇄ edit. Leaving the editor by clicking outside or the back gesture
 * keeps what was typed; Cancel or Escape goes back to the saved note. */
function useNoteState({ note, onSave, onClose }: NoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const startEdit = () => { setDraft(note); setEditing(true); };
  const save = () => { if (draft.trim() !== note) onSave(draft.trim()); setEditing(false); };
  const cancelEdit = () => setEditing(false);
  /** Click outside or the back gesture. */
  const dismiss = () => { if (editing && draft.trim() !== note) onSave(draft.trim()); onClose(); };
  return { editing, draft, setDraft, startEdit, save, cancelEdit, dismiss, close: onClose, note };
}

function NoteBody({ state, storyTitle, large }: { state: NoteState; storyTitle: string; large: boolean }) {
  const ui = useUiText();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // The field is exactly as tall as its text (up to a cap, then it scrolls).
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    // scrollHeight leaves out the border, which the box's height includes.
    field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
  }, [state.draft, state.editing]);
  useEffect(() => { if (!state.editing) primaryRef.current?.focus(); }, [state.editing]);

  // The pop-up sits on a narrow card, so its buttons are compact and never wrap.
  const actionRow = `flex justify-end gap-1.5 [&>button]:whitespace-nowrap ${large ? 'mt-3 [&>button]:min-h-11 [&>button]:flex-1' : 'mt-2 [&>button]:!px-3 [&>button]:!py-1.5 [&>button]:!text-xs'}`;

  if (state.editing) return (
    <>
      <textarea
        ref={fieldRef} autoFocus rows={2} value={state.draft} maxLength={1000}
        onChange={event => state.setDraft(event.target.value)}
        aria-label={`${ui('Note')}: ${storyTitle}`} placeholder={ui('Add a private note…')}
        onFocus={event => { const end = event.currentTarget.value.length; event.currentTarget.setSelectionRange(end, end); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); state.cancelEdit(); }
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); state.save(); }
        }}
        // 16px on phones so iOS doesn't zoom the page when the field takes focus.
        className={`block w-full resize-none overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 leading-relaxed text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${large ? 'max-h-[40vh] text-base' : 'max-h-64 text-sm'}`}
      />
      <div className={actionRow}>
        <button type="button" onClick={state.cancelEdit} className={button.ghost}>{ui('Cancel')}</button>
        <button type="button" onClick={state.save} className={button.primary}>{ui('Save')}</button>
      </div>
    </>
  );

  return (
    <>
      {state.note
        ? <p className={`overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100 ${large ? 'max-h-[50vh] text-base' : 'max-h-64 text-sm'}`}>{state.note}</p>
        : <p className={`text-slate-500 dark:text-slate-400 ${large ? 'text-base' : 'text-sm'}`}>{ui('No note for this story yet.')}</p>}
      <div className={actionRow}>
        <button type="button" onClick={state.close} className={button.ghost}>{ui('Close')}</button>
        <button ref={primaryRef} type="button" onClick={state.startEdit} className={button.primary}>
          <NotebookPen size={15} aria-hidden="true" />{ui(state.note ? 'Edit note' : 'Add note')}
        </button>
      </div>
    </>
  );
}

function NotePopover({ state, storyTitle, triggerRef }: NoteEditorProps & { state: NoteState }) {
  const ui = useUiText();
  const ref = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(state.dismiss);
  dismissRef.current = state.dismiss;
  const editingRef = useRef(state.editing);
  editingRef.current = state.editing;
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || triggerRef.current?.contains(target)) return;
      dismissRef.current();
    };
    // Escape while editing is handled by the field (back to the note).
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !editingRef.current) { dismissRef.current(); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [triggerRef]);

  // Anchored to the card (not clipped by it) just above the action row, and
  // grows upwards with the note.
  return (
    <div ref={ref} role="dialog" aria-label={`${ui('Note')}: ${storyTitle}`}
      className="absolute inset-x-2 bottom-[3.25rem] z-30 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{ui('Note')}</p>
      <NoteBody state={state} storyTitle={storyTitle} large={false} />
    </div>
  );
}

/** How far the on-screen keyboard covers the bottom of the layout viewport. */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
  }, []);
  return inset;
}

function NoteSheet({ state, storyTitle }: NoteEditorProps & { state: NoteState }) {
  const ui = useUiText();
  const inset = useKeyboardInset();
  const dismissRef = useRef(state.dismiss);
  dismissRef.current = state.dismiss;

  // The back gesture closes the sheet (keeping any edit) instead of leaving the
  // page: open adds a history entry that shares the router's state, so the
  // router sees the same location; closing any other way takes it off again.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // A reload while a sheet was open leaves its mark on the page's own entry.
    const { noteSheet: _stale, ...base } = window.history.state ?? {};
    if (_stale) window.history.replaceState(base, '');
    window.history.pushState({ ...base, noteSheet: true }, '');
    let poppedByBack = false;
    const onPopState = () => { poppedByBack = true; dismissRef.current(); };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.body.style.overflow = previous;
      if (!poppedByBack && window.history.state?.noteSheet) window.history.back();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div aria-hidden="true" onClick={state.dismiss} className="absolute inset-0 bg-black/40 motion-safe:animate-in motion-safe:fade-in-0" />
      <div role="dialog" aria-modal="true" aria-label={`${ui('Note')}: ${storyTitle}`} style={{ bottom: inset }}
        className="absolute inset-x-0 rounded-t-3xl bg-white px-4 pt-3 shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 dark:bg-slate-800">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{ui('Note')}</p>
            <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{storyTitle}</p>
          </div>
          <button type="button" onClick={state.dismiss} aria-label={ui('Close')} className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"><X size={18} /></button>
        </div>
        <NoteBody state={state} storyTitle={storyTitle} large />
      </div>
    </div>,
    document.body,
  );
}
