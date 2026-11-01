/** Editorial marks drawn for the analytics panels; inherit the chosen theme. */
export function InsightMark({ kind }: { kind: 'sentiment' | 'categories' | 'live' | 'trending' | 'authors' }) {
  return <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--brand)]">
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'sentiment' && <><path d="M16 3a13 13 0 1 0 13 13" opacity=".3" /><path d="M19 3.4v9.5h9.5A13 13 0 0 0 19 3.4Z" fill="currentColor" fillOpacity=".18" /><path d="M8 21v-4m5 4v-8m5 8v-4m5 4v-2" /></>}
      {kind === 'categories' && <><path d="M4 4v24h24" opacity=".35" /><path d="M8 9h16M8 16h11M8 23h6" /><circle cx="24" cy="9" r="2.2" fill="currentColor" stroke="none" /><circle cx="19" cy="16" r="2.2" fill="currentColor" fillOpacity=".45" stroke="none" /><circle cx="14" cy="23" r="2.2" fill="currentColor" fillOpacity=".25" stroke="none" /></>}
      {kind === 'live' && <><path d="M5 9h17v18H5zM9 13h8M9 17h9M9 21h5" /><path d="M9 5H2v18m24-10a8 8 0 0 0-7-8m10 6A11 11 0 0 0 21 2" opacity=".5" /><circle cx="22" cy="9" r="2.5" fill="currentColor" stroke="none" /></>}
      {kind === 'trending' && <><path d="M4 26h24M7 22v-5m6 5V12m6 10v-7m6 7V5" opacity=".35" /><path d="m4 17 8-9 7 4 8-9m-6 0h6v6" /><circle cx="12" cy="8" r="2" fill="currentColor" stroke="none" /></>}
      {kind === 'authors' && <><path d="M4 25h15M4 29h24" opacity=".35" /><path d="m9 21 2-7L23 2l6 6-12 12-8 1Zm3-7 5 5M20 5l6 6" /><path d="m9 21-3 3" /></>}
    </svg>
  </span>;
}
