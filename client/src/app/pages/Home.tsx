import { useUiText } from '../i18n/uiText';
import { NewsGrid } from '../components/NewsGrid';

export function Home() {
  const ui = useUiText();
  return (
    <div className="px-4 pb-5">
      <h1 className="sr-only">{ui("Latest news and sentiment insights")}</h1>
      <NewsGrid />
    </div>
  );
}
