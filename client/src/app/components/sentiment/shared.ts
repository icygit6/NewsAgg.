// Shared styling helpers for the sentiment analytics panels.

// Opaque, one border tone, the same surface as the news cards (no glass).
export const panelBaseClass = (isDark: boolean): string =>
  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

export const chartTextColor = (isDark: boolean): string => (isDark ? '#e2e8f0' : '#374151');

export const chartMutedColor = (isDark: boolean): string => (isDark ? '#64748b' : '#9ca3af');
