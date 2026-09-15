import { useApp } from '../../contexts/AppContext';
import type { NewsArticle } from '../../types/article';
import { CATEGORY_LABELS, TOPIC_TO_CATEGORY } from '../../constants';

/** Only observed article metadata: no English keyword heuristics or invented signals. */
export function CategoryLens({ articles }: { articles: NewsArticle[] }) {
  const { selectedCategory, isDark } = useApp();
  if (selectedCategory === 'all') return null;
  const sample = articles.filter(article => TOPIC_TO_CATEGORY[article.topic] === selectedCategory);
  if (!sample.length) return null;
  const counts = new Map<string, number>();
  sample.forEach(article => {
    const name = article.source.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  const sources = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <section className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Coverage desk</p>
      <h3 className="mt-1 text-xl font-bold">{CATEGORY_LABELS[selectedCategory]}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Source mix in the latest {sample.length} articles in this category. This is a recent sample, not the full archive.
      </p>
      <div className="mt-4 space-y-3">
        {sources.map(([name, count]) => (
          <div key={name}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="font-semibold">{name}</span>
              <span className="text-slate-500 dark:text-slate-400">{count} / {sample.length}</span>
            </div>
            <div className={`h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${count / sample.length * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
