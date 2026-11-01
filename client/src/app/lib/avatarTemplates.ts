/** Ready-made avatars for readers who do not want to upload a photo. Each is a small SVG drawn
 * here, rendered to the same 96×96 webp an upload produces (the server only stores raster data
 * URLs), so templates and photos share one storage path. */

interface Template { id: string; bg: string; skin: string; hair: string; shirt: string; style: 'short' | 'long' | 'bun' | 'curly' | 'cap' | 'bald'; glasses?: boolean }

const TEMPLATES: Template[] = [
  { id: 'sky', bg: '#0369a1', skin: '#f2c9a0', hair: '#2b1d14', shirt: '#7dd3fc', style: 'short' },
  { id: 'rose', bg: '#be185d', skin: '#e8b48a', hair: '#1f1611', shirt: '#f9a8d4', style: 'long' },
  { id: 'grape', bg: '#6d28d9', skin: '#c68b5e', hair: '#111827', shirt: '#c4b5fd', style: 'curly', glasses: true },
  { id: 'forest', bg: '#15803d', skin: '#f5d0b0', hair: '#a0522d', shirt: '#86efac', style: 'bun' },
  { id: 'ember', bg: '#c2410c', skin: '#8d5a3b', hair: '#0f0f0f', shirt: '#fdba74', style: 'cap' },
  { id: 'teal', bg: '#0f766e', skin: '#f1c27d', hair: '#3f3f46', shirt: '#5eead4', style: 'bald', glasses: true },
  { id: 'gold', bg: '#b45309', skin: '#ffdbb5', hair: '#facc15', shirt: '#fde68a', style: 'long' },
  { id: 'ink', bg: '#1e293b', skin: '#d9a07a', hair: '#e5e7eb', shirt: '#94a3b8', style: 'short', glasses: true },
];

function hair(t: Template) {
  switch (t.style) {
    case 'short': return `<path d="M30 44c0-14 9-22 18-22s18 8 18 22c-4-6-10-9-18-9s-14 3-18 9z" fill="${t.hair}"/>`;
    case 'long': return `<path d="M27 50c0-17 9-27 21-27s21 10 21 27v20c-4 2-8 2-10 0V46c-4-4-8-6-11-6s-7 2-11 6v24c-2 2-6 2-10 0z" fill="${t.hair}"/>`;
    case 'bun': return `<circle cx="48" cy="20" r="7" fill="${t.hair}"/><path d="M30 44c0-14 9-21 18-21s18 7 18 21c-5-5-11-8-18-8s-13 3-18 8z" fill="${t.hair}"/>`;
    case 'curly': return `<g fill="${t.hair}"><circle cx="34" cy="34" r="7"/><circle cx="42" cy="27" r="7"/><circle cx="52" cy="26" r="7"/><circle cx="61" cy="32" r="7"/><circle cx="64" cy="41" r="5"/><circle cx="31" cy="42" r="5"/></g>`;
    case 'cap': return `<path d="M29 40c1-12 9-18 19-18s18 6 19 18z" fill="${t.hair}"/><rect x="26" y="38" width="34" height="5" rx="2.5" fill="${t.hair}"/>`;
    case 'bald': return `<path d="M31 46c0-3 1-5 2-7M65 46c0-3-1-5-2-7" stroke="${t.hair}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  }
}

function svg(t: Template) {
  const glasses = t.glasses
    ? `<g fill="none" stroke="#0f172a" stroke-width="2"><circle cx="41" cy="47" r="5"/><circle cx="55" cy="47" r="5"/><path d="M46 47h4"/></g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
<rect width="96" height="96" fill="${t.bg}"/>
<path d="M18 96c3-17 15-26 30-26s27 9 30 26z" fill="${t.shirt}"/>
<rect x="43" y="60" width="10" height="12" rx="4" fill="${t.skin}"/>
<ellipse cx="48" cy="46" rx="17" ry="19" fill="${t.skin}"/>
${hair(t)}
<circle cx="41" cy="47" r="2.2" fill="#0f172a"/><circle cx="55" cy="47" r="2.2" fill="#0f172a"/>
${glasses}
<path d="M42 55c3 3 9 3 12 0" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" fill="none"/>
</svg>`;
}

export const AVATAR_TEMPLATES = TEMPLATES.map((t) => ({ id: t.id, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(t))}` }));

/** Renders a template to the 96×96 webp the avatar endpoint accepts. */
export function renderAvatarTemplate(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, 96, 96);
      resolve(canvas.toDataURL('image/webp', 0.9));
    };
    img.onerror = () => reject(new Error('Template failed to load'));
    img.src = src;
  });
}
