import { useUiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const slug = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/** A titled section of a policy or methodology page; the heading gets an anchor for the contents list. */
export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  const id = slug(title);
  return (
    <section id={id} className="scroll-mt-6 border-t border-slate-200 pt-6 first:border-t-0 first:pt-0 dark:border-slate-800">
      <h2 className="group mb-3 text-lg font-bold text-slate-900 dark:text-slate-50">
        <a href={`#${id}`} className="no-underline hover:text-[var(--brand)]">{title}</a>
      </h2>
      <div className="space-y-3 text-[15px] leading-7 text-slate-600 dark:text-slate-300 [&_li]:marker:text-slate-400">{children}</div>
    </section>
  );
}

const LINKS = [
  { to: '/insights?view=sources', en: 'Collection sources', zh: '採集來源' },
  { to: '/terms', en: 'Terms', zh: '服務條款' },
  { to: '/privacy', en: 'Privacy', zh: '隱私政策' },
  { to: '/editorial-policy', en: 'Editorial & corrections', zh: '編輯與更正' },
  { to: '/methodology', en: 'How NewsAgg works', zh: 'NewsAgg 如何運作' },
  { to: '/insights?view=research', en: 'Research & tests', zh: '研究與測試' },
];

/** Shared shell for the footer pages (terms, privacy, editorial, methodology): a header with an
 * icon and date, tabs between the pages, a contents list beside the text on wide screens. */
export function DocLayout({ icon: Icon, title, intro, meta, children, back, extra }: {
  icon: LucideIcon; title: string; intro?: ReactNode; meta?: string; children: ReactNode; back: string; extra?: ReactNode;
}) {
  const ui = useUiText();
  const { language } = useApp();
  const zh = language === 'zhTW';
  const { pathname } = useLocation();
  const body = useRef<HTMLDivElement>(null);
  const [contents, setContents] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    const headings = Array.from(body.current?.querySelectorAll('section[id] > h2') ?? []);
    setContents(headings.map((heading) => ({ id: heading.parentElement!.id, title: heading.textContent ?? '' })));
  }, [children, language]);

  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-white" aria-hidden>
          <Icon size={22} />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-4xl">{title}</h1>
        {meta && <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{meta}</p>}
        {intro && <div className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">{intro}</div>}
        <nav aria-label={ui('Policies and methodology')} className="mt-6 flex flex-wrap gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.to;
            return (
              <Link key={link.to} to={link.to} aria-current={active ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
                {zh ? link.zh : link.en}
              </Link>
            );
          })}
          <a href="/research-foundations.html" className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            {ui('Research foundations')}
          </a>
        </nav>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {contents.length > 2 && (
          <aside className="hidden lg:block">
            <nav aria-label={ui('On this page')} className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{ui('On this page')}</p>
              <ul className="space-y-1">
                {contents.map((item) => (
                  <li key={item.id}><a href={`#${item.id}`} className="block rounded-lg px-2 py-1.5 leading-snug text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{item.title}</a></li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
        <div className={contents.length > 2 ? '' : 'lg:col-span-2'}>
          {extra}
          <div ref={body} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-8">{children}</div>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            <ArrowLeft size={16} />{back}
          </Link>
        </div>
      </div>
    </article>
  );
}
