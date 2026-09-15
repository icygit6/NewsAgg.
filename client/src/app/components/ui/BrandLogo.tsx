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
        src="/logo-mark.png?v=20260910-baseline"
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
