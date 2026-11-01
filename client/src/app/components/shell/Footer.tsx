import { useUiText } from '../../i18n/uiText';
import { Link } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED, SOURCES } from '../../constants';
import { BrandLogo } from '../ui/BrandLogo';
import { openFeedback } from '../../hooks/useFeedback';

interface FooterLink {
  label: string;
  to: string;
}

/** Compact footer pinned to the bottom of the sticky RightRail (X-style).
 * This is the footer users actually see on the infinite-feed pages (Home,
 * Posts), where a bottom-of-page footer can never be scrolled to. brief is
 * the one-line version for the account drawer, which has its own feedback row. */
export function FooterCompact({ brief = false }: { brief?: boolean }) {
  const ui = useUiText();
  const { t } = useApp();

  if (brief) return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs leading-snug text-slate-600 dark:text-slate-400`}>
      <Link to="/methodology" className="hover:underline">{t.methodologyTitle}</Link>
      <span aria-hidden>·</span>
      <Link to="/privacy" className="hover:underline">{t.privacyPolicy}</Link>
      <span aria-hidden>·</span>
      <Link to="/terms" className="hover:underline">{t.termsOfService}</Link>
      <span aria-hidden>·</span>
      <span>© {new Date().getFullYear()} NewsAgg</span>
    </p>
  );

  return (
    <div
      className={`text-xs leading-snug flex flex-col gap-1 text-slate-600 dark:text-slate-400`}
    >
      <p className="flex flex-wrap items-center gap-x-2">
        <Link to="/insights?view=sources" className="hover:underline">{ui('Collection sources')}</Link>
        <span aria-hidden>·</span>
        <Link to="/methodology" className="hover:underline">{t.methodologyTitle}</Link>
        <span aria-hidden>·</span>
        <Link to="/terms" className="hover:underline">{t.termsOfService}</Link>
        <span aria-hidden>·</span>
        <Link to="/privacy" className="hover:underline">{t.privacyPolicy}</Link>
        <span aria-hidden>·</span>
        <Link to="/editorial-policy" className="hover:underline">{ui('Editorial & corrections')}</Link>
        <span aria-hidden>·</span>
        <Link to="/insights?view=research" className="hover:underline">{ui('Research & tests')}</Link>
        <span aria-hidden>·</span>
        <a href="/research-foundations.html" className="hover:underline">{ui('Research foundations')}</a>
        <span aria-hidden>·</span>
        <button type="button" onClick={openFeedback} className="hover:underline">{ui('Send feedback')}</button>
      </p>
      <p>
        © {new Date().getFullYear()} NewsAgg · {SOURCES.map((s) => s.name).join(' · ')}
      </p>
    </div>
  );
}

/** Full-width site footer rendered inside <main>, below the page content —
 * but only on routes with finite content (Article, Bookmarks, Profile,
 * Country, 404). Infinite-feed routes (Home, Posts) opt out via
 * `handle.hideFooter`; there the rail's FooterCompact takes over. Four-column
 * responsive grid (1 col mobile → 4 col desktop) + a bottom copyright bar. */
export function Footer({ hiddenOnMobile = false }: { hiddenOnMobile?: boolean }) {
  const ui = useUiText();
  const { t } = useApp();

  const heading = `font-poppins font-semibold text-sm mb-3 text-slate-800 dark:text-slate-200`;
  const link = `text-sm transition-colors text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100`;
  const navLinks: FooterLink[] = [
    { label: t.home, to: '/' },
    { label: t.insights, to: '/insights' },
    { label: ui('Research & tests'), to: '/insights?view=research' },
    { label: t.bookmarks, to: '/bookmarks' },
    ...(POSTS_ENABLED ? [{ label: t.posts, to: '/posts' }] : []),
  ];

  return (
    <footer
      className={`mt-8 px-4 md:px-6 py-10 ${hiddenOnMobile ? 'hidden md:block' : ''} border-slate-200 dark:border-slate-800`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
        {/* Column 1 — Brand */}
        <div>
          <Link to="/" className="flex items-center gap-2" aria-label={ui("NewsAgg home")}>
            <BrandLogo
              size="md"
            />
          </Link>
          <p className="mt-3 text-sm text-slate-500">{t.footerTagline}</p>
          <p className={`mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400`}>{ui('Read the original. Compare the analysis. Inspect the evidence. Every story keeps its source link; automated labels do not certify truth.')}</p>
        </div>

        {/* Column 2 — Navigate */}
        <div>
          <h3 className={heading}>{t.navigate}</h3>
          <ul className="flex flex-col gap-2">
            {navLinks.map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className={link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3 — Sources */}
        <div>
          <h3 className={heading}>{t.newsSources}</h3>
          <ul className="flex flex-col gap-2">
            <li><Link to="/insights?view=sources" className={link}>{ui('Collection sources')}</Link></li>
            {SOURCES.map(({ id, name, domain }) => (
              <li key={id}>
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4 — Legal & Info */}
        <div>
          <h3 className={heading}>{t.legalInfo}</h3>
          <ul className="flex flex-col gap-2">
            <li>
              <Link className={link} to="/methodology">{t.methodologyTitle}</Link>
            </li>
            <li>
              <Link className={link} to="/terms">{t.termsOfService}</Link>
            </li>
            <li>
              <Link className={link} to="/privacy">{t.privacyPolicy}</Link>
            </li>
            <li><Link className={link} to="/editorial-policy">{ui('Editorial & corrections')}</Link></li>
            <li><a className={link} href="/research-foundations.html">{ui('Research foundations')}</a></li>
            <li><Link className={link} to="/settings?section=preferences">{ui('Account & data controls')}</Link></li>
            <li><button type="button" onClick={openFeedback} className={`${link} text-left`}>{ui('Send feedback')}</button></li>
          </ul>
          <span
            className="inline-block mt-4 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ color: 'var(--brand, #2563eb)', background: 'var(--brand-soft)' }}
          >
            {t.poweredByNLP}
          </span>
        </div>
      </div>


      {/* Bottom bar */}
      <div
        className={`mt-6 pt-4 text-xs border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-500`}
      >
        <p>© {new Date().getFullYear()} NewsAgg. {ui('Academic project · News aggregation, sentiment analysis and topic trends.')}</p>
        <p className="mt-2 text-xs leading-relaxed">{ui('Original reporting, images and trademarks belong to their respective owners. For corrections or rights concerns, use “Report an issue” on the relevant article.')}</p>
      </div>
    </footer>
  );
}
