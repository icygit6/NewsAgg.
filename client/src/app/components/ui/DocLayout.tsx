import { segment } from './styles';
import { StyledSelect } from './StyledSelect';
import { useUiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, ArrowUpRight, ChevronDown, type LucideIcon } from 'lucide-react';
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

/** The pages that share this layout: tabs on wider screens (`short` labels), a picker on phones (full names). */
const PAGES = [
  { to: '/terms', en: 'Terms of Service', zh: '服務條款', shortEn: 'Terms', shortZh: '條款' },
  { to: '/privacy', en: 'Privacy Policy', zh: '隱私政策', shortEn: 'Privacy', shortZh: '隱私' },
  { to: '/editorial-policy', en: 'Editorial & corrections', zh: '編輯與更正', shortEn: 'Editorial', shortZh: '編輯' },
  { to: '/methodology', en: 'How NewsAgg works', zh: 'NewsAgg 如何運作', shortEn: 'How it works', shortZh: '運作方式' },
];

/** Related pages outside this set (the Insights tabs and a standalone document), listed apart from the tabs. */
const RELATED = [
  { to: '/insights?view=sources', en: 'Collection sources', zh: '採集來源' },
  { to: '/insights?view=research', en: 'Research & tests', zh: '研究與測試' },
  { to: '/research-foundations.html', en: 'Research foundations', zh: '研究基礎', external: true },
];

/** Shared shell for the footer pages (terms, privacy, editorial, methodology): a header with an
 * icon and date, tabs between the pages, then the text. Header and text share one column centred
 * on the page; the contents list sits in the left margin when the margin has room for it
 * (container ≥ 69rem: the 44rem column plus two 12.5rem margins), otherwise it folds into an
 * "On this page" menu under the header. `wide` is for pages that are a grid rather than prose. */
export function DocLayout({ icon: Icon, title, intro, meta, children, back, extra, wide = false }: {
  icon: LucideIcon; title: string; intro?: ReactNode; meta?: string; children: ReactNode; back: string; extra?: ReactNode; wide?: boolean;
}) {
  const ui = useUiText();
  const { language, isDark } = useApp();
  const navigate = useNavigate();
  const zh = language === 'zhTW';
  const { pathname } = useLocation();
  const body = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [contents, setContents] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    const headings = Array.from(body.current?.querySelectorAll('section[id] > h2') ?? []);
    setContents(headings.map((heading) => ({ id: heading.parentElement!.id, title: heading.textContent ?? '' })));
  }, [children, language]);

  const hasContents = contents.length > 2;
  const contentLinks = (onPick?: () => void) => (
    <ul className="space-y-1">
      {contents.map((item) => (
        <li key={item.id}><a href={`#${item.id}`} onClick={onPick} className="block rounded-lg px-2 py-1.5 leading-snug text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{item.title}</a></li>
      ))}
    </ul>
  );

  return (
    <article className="@container w-full px-4 py-8 md:px-6 md:py-10">
      <div className={`mx-auto w-full ${wide ? 'max-w-5xl' : 'max-w-[44rem]'}`}>
      <header className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-white" aria-hidden>
          <Icon size={22} />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-4xl">{title}</h1>
        {meta && <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{meta}</p>}
        {intro && <div className="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-300">{intro}</div>}
        {/* Phones get a picker for the policy pages; wider screens get one row of tabs. */}
        <div className="mt-6 md:hidden">
          <StyledSelect
            label={ui('Policies and methodology')}
            isDark={isDark}
            value={PAGES.some((page) => page.to === pathname) ? pathname : ''}
            options={PAGES.map((page) => ({ value: page.to, label: zh ? page.zh : page.en }))}
            onChange={(to) => navigate(to)}
          />
        </div>
        <nav aria-label={ui('Policies and methodology')} className={`${segment.track} mt-6 max-md:hidden`}>
          {PAGES.map((page) => (
            <Link key={page.to} to={page.to} title={zh ? page.zh : page.en} aria-label={zh ? page.zh : page.en} aria-current={pathname === page.to ? 'page' : undefined} className={`whitespace-nowrap ${pathname === page.to ? segment.active : segment.item}`}>
              {zh ? page.shortZh : page.shortEn}
            </Link>
          ))}
        </nav>
        {/* Links that leave this set of pages: kept apart from the tabs and marked with an arrow. */}
        <nav aria-label={ui('Related pages')} className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 max-sm:w-full dark:text-slate-400">{ui('Related pages')}</span>
          {RELATED.map((link) => {
            const className = 'inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300';
            const label = <>{zh ? link.zh : link.en}<ArrowUpRight size={14} aria-hidden="true" /></>;
            return link.external
              ? <a key={link.to} href={link.to} className={className}>{label}</a>
              : <Link key={link.to} to={link.to} className={className}>{label}</Link>;
          })}
        </nav>
      </header>

      {/* Narrow screens: the contents list folds into a menu between the header and the text. */}
      {hasContents && !wide && (
        <details ref={menu} className="group/toc mt-4 rounded-2xl border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900 @min-[69rem]:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-[var(--brand)] dark:text-slate-200 [&::-webkit-details-marker]:hidden">
            {ui('On this page')}
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-slate-500 transition-transform group-open/toc:rotate-180" />
          </summary>
          <nav aria-label={ui('On this page')} className="border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-800">
            {contentLinks(() => { if (menu.current) menu.current.open = false; })}
          </nav>
        </details>
      )}

      <div className="relative mt-6">
        {/* Wide screens: the contents list sits in the left margin, outside the centred column. */}
        {hasContents && !wide && (
          <aside className="absolute inset-y-0 right-full mr-6 hidden w-[min(15rem,calc((100cqw-44rem)/2-1.5rem))] @min-[69rem]:block">
            <nav aria-label={ui('On this page')} className="sticky top-6 text-sm">
              <p className="mb-2 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{ui('On this page')}</p>
              {contentLinks()}
            </nav>
          </aside>
        )}
        {extra}
        <div ref={body} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-8">{children}</div>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
          <ArrowLeft size={16} />{back}
        </Link>
      </div>
      </div>
    </article>
  );
}
