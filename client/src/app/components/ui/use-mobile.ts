import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return !!isMobile;
}
