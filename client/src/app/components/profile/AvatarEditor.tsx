import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';
import { useUiText } from '../../i18n/uiText';
import { AVATAR_TEMPLATES, renderAvatarTemplate } from '../../lib/avatarTemplates';

interface AvatarEditorProps {
  isDark: boolean;
}

/** Avatar upload: downscale to a 96×96 cover-cropped webp data-URL (a few KB,
 * well under the server's 100k-char cap) and persist it server-side so the
 * photo follows the account across browsers. */
export function AvatarEditor({ isDark }: AvatarEditorProps) {
  const { t, user, setUser, avatarSrc } = useApp();
  const ui = useUiText();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // The camera button opens a small menu (upload, templates, remove) instead
  // of laying the template row out under the avatar.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const upload = async (dataUrl: string | null) => {
    setSaving(true);
    setError('');
    setSaved(false);
    const res = await authService.updateAvatar(dataUrl);
    if (res.success) {
      if (user) {
        const next = { ...user, avatar: res.avatar ?? dataUrl };
        setUser(next);
        authService.setUser(next);
      }
      setSaved(true);
    } else {
      setError(res.error || 'Photo update failed');
    }
    setSaving(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t.avatarInvalid);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        upload(canvas.toDataURL('image/webp', 0.85));
      };
      img.onerror = () => setError(t.avatarInvalid);
      img.src = String(reader.result);
    };
    reader.onerror = () => setError(t.avatarInvalid);
    reader.readAsDataURL(file);
  };

  const menuItem = `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
  }`;

  return (
    <div ref={menuRef} className="relative">
      <div className="relative w-24 h-24">
        <div className={`w-full h-full rounded-2xl overflow-hidden ring-4 ${isDark ? 'ring-slate-900' : 'ring-white'}`}>
          <img src={avatarSrc} alt={user?.username || ''} className="w-full h-full object-cover bg-[var(--brand)]" />
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={saving}
          aria-label={t.changePhoto}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          title={t.changePhoto}
          className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-md ring-2 transition-colors disabled:opacity-60 ${
            isDark ? 'bg-[var(--brand)] text-white ring-slate-900 hover:bg-[var(--brand-hover)]' : 'bg-[var(--brand)] text-white ring-white hover:bg-[var(--brand-hover)]'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        </button>
        <input ref={fileInputRef} type="file" name="avatar" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {menuOpen && (
        <div
          role="dialog"
          aria-label={t.changePhoto}
          className={`absolute left-0 top-full z-30 mt-3 w-[17rem] rounded-2xl border p-2 shadow-lg ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          <button type="button" disabled={saving} onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }} className={menuItem}>
            <Upload size={15} className="shrink-0 text-slate-400" />{ui('Upload photo')}
          </button>
          <p className={`px-2.5 pt-2 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ui('Or pick an avatar')}</p>
          <div role="group" aria-label={ui('Avatar templates')} className="grid grid-cols-4 gap-2 p-2.5">
            {AVATAR_TEMPLATES.map((template, index) => (
              <button
                key={template.id}
                type="button"
                disabled={saving}
                onClick={() => { setMenuOpen(false); void renderAvatarTemplate(template.src).then(upload, () => setError(t.avatarInvalid)); }}
                aria-label={`${ui('Use avatar')} ${index + 1}`}
                className="aspect-square overflow-hidden rounded-xl ring-2 ring-transparent transition-[transform,box-shadow] hover:ring-[var(--brand)] focus-visible:outline-none focus-visible:ring-[var(--brand)] disabled:opacity-50 motion-safe:hover:scale-105"
              >
                <img src={template.src} alt="" width={48} height={48} className="h-full w-full" />
              </button>
            ))}
          </div>
          {user?.avatar && (
            <button type="button" disabled={saving} onClick={() => { setMenuOpen(false); void upload(null); }} className={`${menuItem} ${isDark ? 'hover:text-red-300' : 'hover:text-red-600'}`}>
              <Trash2 size={15} className="shrink-0" />{t.removePhoto}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-2 max-w-[12rem] text-xs text-rose-500">{error}</p>}
      {saved && !error && <p role="status" aria-live="polite" className="mt-2 max-w-[12rem] text-xs text-emerald-500">{t.avatarUpdated}</p>}
    </div>
  );
}
