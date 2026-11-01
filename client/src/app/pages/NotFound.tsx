import { Link } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { useUiText } from '../i18n/uiText';
import { FeedState, feedStateButton } from '../components/feed/FeedState';

export function NotFound() {
  const { t } = useApp();
  const ui = useUiText();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <h1 className="sr-only">404</h1>
      <FeedState title={t.pageNotFound} body={ui('The link may be old, or the story was removed after 30 days.')} action={<Link to="/" className={feedStateButton}>{t.backToHome}</Link>} />
    </div>
  );
}
