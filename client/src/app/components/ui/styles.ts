/** One set of class recipes for the whole app, so buttons, chips, panels and fields cannot drift
 * apart again. Primary is the active colour theme's --brand (blue-600 by default). Radii: panels 2xl, controls xl,
 * pills full. Dark mode comes from the `dark:` variant (html.dark), so no isDark plumbing. */

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

export const button = {
  primary: `inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50 ${focus}`,
  secondary: `inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${focus}`,
  ghost: `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 ${focus}`,
  danger: `inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 ${focus}`,
} as const;

export const chip = {
  base: `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${focus}`,
  active: `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] ${focus}`,
  /** Small, non-interactive tag (hashtags, metadata). */
  tag: 'inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300',
} as const;

/** The surface every card and panel shares: opaque, one border tone, no glass. */
export const panel = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

export const fieldInput = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${focus}`;

/** Section label inside drawers and settings: sentence case, readable size, no letter-spacing. */
export const sectionLabel = 'text-xs font-semibold text-slate-500 dark:text-slate-400';

/** Every tab or segmented choice on the site, styled like the Posts sort control: one soft
 * white track with a firm border, plain text options, and the chosen one filled with the brand blue, like the
 * selected item in the nav rail. */
export const segment = {
  track: 'inline-flex gap-1 rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800',
  item: `rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${focus}`,
  active: `rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors ${focus}`,
} as const;

/** "Nothing here yet" inside a panel or list. A whole page or main panel uses <FeedState> instead. */
export const emptyNote = 'text-sm text-slate-500 dark:text-slate-400';
