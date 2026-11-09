import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { FeedState } from '../feed/FeedState';
import { feedStateButton } from '../feed/feedStateButton';

/** Shown on account pages when the sign-in check could not reach the server.
 * Sending the reader home would look like they had been signed out. */
export function AuthUnavailable() {
  const ui = useUiText();
  const { retryAuth } = useApp();
  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      <FeedState
        tone="error"
        title={ui('Could not check your sign-in')}
        body={ui('NewsAgg is busy or your connection dropped. Your account is fine; try again in a moment.')}
        action={<button type="button" onClick={retryAuth} className={feedStateButton}>{ui('Try again')}</button>}
      />
    </div>
  );
}
