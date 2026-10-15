import { useUiText } from '../../i18n/uiText';
import { Link } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED, SOURCES } from '../../constants';
import { BrandLogo } from '../ui/BrandLogo';

interface FooterLink {
  label: string;
  to: string;
}

/** Compact footer pinned to the bottom of the sticky RightRail (X-style).
 * This is the footer users actually see on the infinite-feed pages (Home,
 * Posts), where a bottom-of-page footer can never be scrolled to. */
export function FooterCompact() {
  const { t, isDark, language } = useApp();
  const zh = language === 'zhTW' || language === 'zhCN';

  return (
    <div
      className={`text-[11px] leading-snug flex flex-col gap-1 ${
        isDark ? 'text-slate-400' : 'text-slate-600'
      }`}
    >
      <p className="flex flex-wrap items-center gap-x-2">
        <Link to="/methodology" className="hover:underline">{t.methodologyTitle}</Link>
        <span aria-hidden>·</span>
        <Link to="/terms" className="hover:underline">{t.termsOfService}</Link>
        <span aria-hidden>·</span>
        <Link to="/privacy" className="hover:underline">{t.privacyPolicy}</Link>
        <span aria-hidden>·</span>
        <Link to="/editorial-policy" className="hover:underline">{zh ? '編輯與更正' : 'Editorial & corrections'}</Link>
        <span aria-hidden>·</span>
        <Link to="/insights?view=research" className="hover:underline">{zh ? '研究與測試' : 'Research & tests'}</Link>
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
  const { t, isDark, language } = useApp();
  const zh = language === 'zhTW' || language === 'zhCN';

  const heading = `font-poppins font-semibold text-sm mb-3 ${
    isDark ? 'text-slate-200' : 'text-slate-800'
  }`;
  const link = `text-sm transition-colors ${
    isDark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'
  }`;
  const navLinks: FooterLink[] = [
    { label: t.home, to: '/' },
    { label: t.insights, to: '/insights' },
    { label: zh ? '評估結果與測試' : 'Evaluation & tests', to: '/insights?view=research' },
    { label: t.bookmarks, to: '/bookmarks' },
    ...(POSTS_ENABLED ? [{ label: t.posts, to: '/posts' }] : []),
  ];

  return (
    <footer
      className={`mt-8 border-t px-4 md:px-6 py-10 ${hiddenOnMobile ? 'hidden md:block' : ''} ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Column 1 — Brand */}
        <div>
          <Link to="/" className="flex items-center gap-2" aria-label={ui("NewsAgg home")}>
            <BrandLogo
              markClassName="w-9 h-9"
              wordmarkClassName={`text-xl ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
            />
          </Link>
          <p className="mt-3 text-sm text-slate-500">{t.footerTagline}</p>
          <p className={`mt-3 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{zh ? '閱讀原文、比較分析、查閱證據。每篇新聞保留來源連結；自動標註不保證真實性。' : 'Read the original. Compare the analysis. Inspect the evidence. Every story keeps its source link; automated labels do not certify truth.'}</p>
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
            <li><Link className={link} to="/editorial-policy">{zh ? '編輯與更正政策' : 'Editorial & corrections'}</Link></li>
            <li><Link className={link} to="/profile">{zh ? '帳號與資料控制' : 'Account & data controls'}</Link></li>
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
        className={`mt-10 pt-6 border-t text-[13px] ${
          isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'
        }`}
      >
        <p>© {new Date().getFullYear()} NewsAgg. {zh ? '學術專題 · 新聞彙整、情感分析與主題趨勢。' : 'Academic project · News aggregation, sentiment analysis and topic trends.'}</p>
        <p className="mt-2 text-xs leading-relaxed">{zh ? '原始文章、圖片及商標屬各權利人所有。更正或權利疑慮請使用文章頁的「回報問題」。' : 'Original reporting, images and trademarks belong to their respective owners. For corrections or rights concerns, use “Report an issue” on the relevant article.'}</p>
      </div>
    </footer>
  );
}
