interface BrandLogoProps {
  showWordmark?: boolean;
  markClassName?: string;
  wordmarkClassName?: string;
}

/** Canonical NewsAgg brand lockup. Keep every visible brand placement in sync. */
export function BrandLogo({
  showWordmark = true,
  markClassName = 'w-10 h-10',
  wordmarkClassName = '',
}: BrandLogoProps) {
  return (
    <>
      <img
        // 128px copy of the 1254px master (785 KB -> 19 KB); the mark never
        // renders above 40 CSS px. The master stays for structured data.
        src="/logo-mark-128.png"
        width={128}
        height={128}
        alt={showWordmark ? '' : 'NewsAgg'}
        className={`${markClassName} shrink-0 object-contain`}
      />
      {showWordmark && (
        <span className={`font-poppins font-bold tracking-tight ${wordmarkClassName}`}>
          NewsAgg
        </span>
      )}
    </>
  );
}
