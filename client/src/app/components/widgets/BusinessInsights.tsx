import { lazy, Suspense } from 'react';
import { useApp } from '../../contexts/AppContext';

// Lazy: both pull recharts-adjacent weight and only matter for Business, so
// keep them out of the shell/insights chunk until that category is opened.
const MarketsWidget = lazy(() =>
  import('./MarketsWidget').then((m) => ({ default: m.MarketsWidget }))
);
const BusinessTrendChart = lazy(() =>
  import('./BusinessTrendChart').then((m) => ({ default: m.BusinessTrendChart }))
);

/** Business-only analytics pinned to the top of the Insights area: the markets
 * snapshot (stocks / FX / crypto) and the 14-day business pulse, sitting above
 * the sentiment distribution. Renders nothing for other categories. The widgets
 * are returned as bare siblings so the parent's `space-y-4` flow spaces them. */
export function BusinessInsights() {
  const { selectedCategory } = useApp();
  if (selectedCategory !== 'business') return null;
  return (
    <Suspense fallback={null}>
      <MarketsWidget />
      <BusinessTrendChart />
    </Suspense>
  );
}
