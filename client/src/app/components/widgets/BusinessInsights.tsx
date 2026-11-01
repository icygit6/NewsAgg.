import { MarketsWidget } from './MarketsWidget';
import { useApp } from '../../contexts/AppContext';

/** Business-only analytics pinned to the top of the Insights area: the markets
 * snapshot (stocks / FX / crypto), above the sentiment distribution. Renders
 * nothing for other categories. */
export function BusinessInsights() {
  const { selectedCategory } = useApp();
  if (selectedCategory !== 'business') return null;
  return (
    <MarketsWidget />
  );
}
