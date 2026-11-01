import { BRAND_ASSET_VERSION } from '../../constants';

/** The two lockups: sm for drawers and loading shells, md for the rail, footer and auth pages. */
const SIZES = {
  sm: { mark: 'h-8 w-8', wordmark: 'text-lg' },
  md: { mark: 'h-10 w-10', wordmark: 'text-xl' },
} as const;

interface BrandLogoProps {
  showWordmark?: boolean;
  size?: keyof typeof SIZES;
  /** Layout extras; a width here (mark-only placements such as the 36px header mark) replaces the size's. */
  markClassName?: string;
  /** Visibility only (e.g. "hidden xl:inline"); size and colour come from the lockup. */
  wordmarkClassName?: string;
  /** Skip the dark-mode tile when the mark already sits on a light surface. */
  onLight?: boolean;
}

/** Canonical NewsAgg brand lockup. Keep every visible brand placement in sync. */
export function BrandLogo({
  showWordmark = true,
  size = 'md',
  markClassName = '',
  wordmarkClassName = '',
  onLight = false,
}: BrandLogoProps) {
  const markSize = /(^|\s)w-/.test(markClassName) ? '' : SIZES[size].mark;
  return (
    <>
      <span
        // The navy bubble disappears on the dark canvas, so dark mode seats it on a light tile.
        className={`${markSize} ${markClassName} inline-block shrink-0 ${onLight ? '' : 'dark:rounded-[28%] dark:bg-slate-100'}`}
      >
        <img
          // 128px copy of the 1254px master (785 KB -> 19 KB); the mark never renders above
          // 56 CSS px. Structured data uses the 512px copy.
          src={`/logo-mark-128.png?v=${BRAND_ASSET_VERSION}`}
          width={128}
          height={128}
          alt={showWordmark ? '' : 'NewsAgg'}
          // Inset with scale, not padding: percentage padding resolves against the parent's width.
          className={`block h-full w-full object-contain ${onLight ? '' : 'dark:scale-[0.82]'}`}
        />
      </span>
      {showWordmark && (
        <span className={`font-poppins font-bold tracking-tight text-[var(--brand-ink)] dark:text-slate-100 ${SIZES[size].wordmark} ${wordmarkClassName}`}>
          NewsAgg
        </span>
      )}
    </>
  );
}
