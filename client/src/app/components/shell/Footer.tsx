import type { ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { useUiPunctuation, useUiText } from '../../i18n/uiText';
import { Link } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED, SOURCES } from '../../constants';
import { BrandLogo } from '../ui/BrandLogo';
import { openFeedback } from '../../hooks/useFeedback';

interface FooterLink {
  label: string;
  to: string;
}

/** The feedback button both footers share: a small outlined pill, at the footer's own text size
 * (buttons otherwise default to 16px). It opens the same feedback dialog everywhere. */
function FeedbackButton({ className = '' }: { className?: string }) {
  const ui = useUiText();
  return <button type="button" onClick={openFeedback}
    className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-[var(--brand)] pointer-coarse:min-h-11 dark:border-slate-700 dark:text-slate-300 ${className}`}>
    <MessageSquare size={13} aria-hidden="true" />{ui('Send feedback')}
  </button>;
}

/** Compact footer pinned to the bottom of the sticky RightRail (X-style).
 * This is the footer users actually see on the infinite-feed pages (Home,
 * Posts), where a bottom-of-page footer can never be scrolled to. brief is
 * the one-line version for the account drawer, which has its own feedback row. */
export function FooterCompact({ brief = false }: { brief?: boolean }) {
  const ui = useUiText();
  const p = useUiPunctuation();
  const { t } = useApp();

  if (brief) return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs leading-snug text-slate-600 dark:text-slate-400`}>
      <Link to="/methodology" className="hover:text-slate-900 dark:hover:text-slate-100">{t.methodologyTitle}</Link>
      <span aria-hidden>·</span>
      <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-slate-100">{t.privacyPolicy}</Link>
      <span aria-hidden>·</span>
      <Link to="/terms" className="hover:text-slate-900 dark:hover:text-slate-100">{t.termsOfService}</Link>
      <span aria-hidden>·</span>
      <span>© {new Date().getFullYear()} NewsAgg</span>
    </p>
  );

  // Two short groups (about the project, then policies) instead of one long run of
  // dot-separated links: gaps rather than "·" separators, so a wrapped line never starts
  // with a stray dot. Every item is set to text-xs, buttons included (buttons default to 16px).
  const linkClass = 'rounded hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-[var(--brand)] dark:hover:text-slate-100';
  const about = [
    <Link key="how" to="/methodology" className={linkClass}>{t.methodologyTitle}</Link>,
    <Link key="sources" to="/insights?view=sources" className={linkClass}>{ui('Collection sources')}</Link>,
    <Link key="research" to="/insights?view=research" className={linkClass}>{ui('Research & tests')}</Link>,
    <a key="foundations" href="/research-foundations.html" className={linkClass}>{ui('Research foundations')}</a>,
  ];
  const policies = [
    <Link key="terms" to="/terms" className={linkClass}>{t.termsOfService}</Link>,
    <Link key="privacy" to="/privacy" className={linkClass}>{t.privacyPolicy}</Link>,
    <Link key="editorial" to="/editorial-policy" className={linkClass}>{ui('Editorial & corrections')}</Link>,
  ];
  const list = (items: ReactNode[]) => <ul className="flex flex-wrap gap-x-3 gap-y-1.5">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;

  return (
    <footer className="border-t border-slate-200 pt-4 text-xs leading-snug text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <nav aria-label={ui('Site information')} className="flex flex-col gap-1.5">
        {list(about)}
        {list(policies)}
      </nav>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p>© {new Date().getFullYear()} NewsAgg</p>
        <FeedbackButton />
      </div>
      <p className="mt-2">{t.newsSources}{p.colon}{SOURCES.map((s) => s.name).join(' · ')}</p>
    </footer>
  );
}

/** Full-width site footer rendered inside <main>, below the page content —
 * but only on routes with finite content (Article, Bookmarks, Profile,
 * Country, 404). Infinite-feed routes (Home, Posts) opt out via
 * `handle.hideFooter`; there the rail's FooterCompact takes over. Its groups,
 * feedback button and sources line match FooterCompact, laid out as columns
 * (2 → 4 on wide screens, the brand block across the top below that) above a bottom bar. */
export function Footer({ hiddenOnMobile = false }: { hiddenOnMobile?: boolean }) {
  const ui = useUiText();
  const p = useUiPunctuation();
  const { t } = useApp();

  const heading = `font-poppins font-semibold text-sm mb-3 text-slate-800 dark:text-slate-200`;
  const link = `rounded text-sm transition-colors text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-[var(--brand)] dark:text-slate-400 dark:hover:text-slate-100`;
  const columns: Array<{ title: string; links: FooterLink[] }> = [
    { title: t.navigate, links: [
      { label: t.home, to: '/' },
      { label: t.insights, to: '/insights' },
      ...(POSTS_ENABLED ? [{ label: t.posts, to: '/posts' }] : []),
      { label: t.bookmarks, to: '/bookmarks' },
    ] },
    // The same two groups as the rail footer: about the project, then policies.
    { title: ui('About NewsAgg'), links: [
      { label: t.methodologyTitle, to: '/methodology' },
      { label: ui('Collection sources'), to: '/insights?view=sources' },
      { label: ui('Research & tests'), to: '/insights?view=research' },
      { label: ui('Research foundations'), to: '/research-foundations.html' },
    ] },
    { title: t.legalInfo, links: [
      { label: t.termsOfService, to: '/terms' },
      { label: t.privacyPolicy, to: '/privacy' },
      { label: ui('Editorial & corrections'), to: '/editorial-policy' },
      { label: ui('Account & data controls'), to: '/settings?section=preferences' },
    ] },
  ];

  return (
    <footer
      className={`mt-8 border-t border-slate-200 px-4 md:px-6 pt-10 pb-8 dark:border-slate-800 ${hiddenOnMobile ? 'hidden md:block' : ''}`}
    >
      {/* Link groups sit two to a row even on phones, so the footer doesn't run on for a screen. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 xl:grid-cols-4">
        <div className="col-span-2 xl:col-span-1">
          <Link to="/" className="inline-flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-[var(--brand)]" aria-label={ui("NewsAgg home")}>
            <BrandLogo size="md" />
          </Link>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t.footerTagline}</p>
          <p className={`mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400`}>{ui('Read the original. Compare the analysis. Inspect the evidence. Every story keeps its source link; automated labels do not certify truth.')}</p>
          <FeedbackButton className="mt-4" />
        </div>

        {columns.map(({ title, links }) => (
          <nav key={title} aria-label={title}>
            <h3 className={heading}>{title}</h3>
            <ul className="flex flex-col gap-2">
              {links.map(({ label, to }) => (
                <li key={to}>
                  {/* The research foundations page is static HTML outside the app's router. */}
                  {to.endsWith('.html') ? <a className={link} href={to}>{label}</a> : <Link className={link} to={to}>{label}</Link>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Bottom bar: copyright and the publishers, as in the rail footer, then the rights note. */}
      <div className={`mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p>© {new Date().getFullYear()} NewsAgg. {ui('Academic project · News aggregation, sentiment analysis and topic trends.')}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t.newsSources}{p.colon.trim()}</span>
            {SOURCES.map(({ id, name, domain }) => (
              <a key={id} href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="rounded hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-[var(--brand)] dark:hover:text-slate-100">{name}</a>
            ))}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="leading-relaxed">{ui('Original reporting, images and trademarks belong to their respective owners. For corrections or rights concerns, use “Report an issue” on the relevant article.')}</p>
          <span className="shrink-0 rounded-full px-2.5 py-1 font-medium" style={{ color: 'var(--brand, #2563eb)', background: 'var(--brand-soft)' }}>{t.poweredByNLP}</span>
        </div>
      </div>
    </footer>
  );
}
