interface BrandLogoProps {
  showWordmark?: boolean;
  markClassName?: string;
  wordmarkClassName?: string;
  /** Skip the dark-mode tile when the mark already sits on a light surface. */
  onLight?: boolean;
}

/** Canonical NewsAgg brand lockup. Keep every visible brand placement in sync. */
export function BrandLogo({
  showWordmark = true,
  markClassName = 'w-10 h-10',
  wordmarkClassName = '',
  onLight = false,
}: BrandLogoProps) {
  return (
    <>
      <span
        // The navy bubble disappears on the dark canvas, so dark mode seats it on a light tile.
        className={`${markClassName} group/logo inline-block shrink-0 ${onLight ? '' : 'dark:rounded-[28%] dark:bg-slate-100'}`}
      >
        <img
          // 128px copy of the 1254px master (785 KB -> 19 KB); the mark never
          // renders above 40 CSS px. The master stays for structured data.
          src="/logo-mark-128.png?v=brand-20261031"
          width={128}
          height={128}
          alt={showWordmark ? '' : 'NewsAgg'}
          // Inset with scale, not padding: percentage padding resolves against the parent's width.
          className={`block h-full w-full object-contain ${onLight ? '' : 'dark:scale-[0.82]'}`}
        />
      </span>
      {showWordmark && (
        <span className={`font-poppins font-bold tracking-tight text-[var(--brand-ink)] dark:text-slate-100 ${wordmarkClassName}`}>
          NewsAgg
        </span>
      )}
    </>
  );
}
