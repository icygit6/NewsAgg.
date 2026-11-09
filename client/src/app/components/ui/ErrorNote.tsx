import { useUiText } from '../../i18n/uiText';

/** Errors come in three kinds, each with one look:
 * - a field or inline message: `errorText` on the message (text-xs next to a field);
 * - a form-level message: `errorBox`, a soft red box above the form;
 * - content that failed to load: <LoadError>, or <FeedState tone="error"> for a whole page. */
export const errorText = 'text-red-600 dark:text-red-400';
export const errorBox = 'rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300';

/** "Could not load X. Try again" inside a panel or list. */
export function LoadError({ message, onRetry, className = '' }: { message: string; onRetry?: () => void; className?: string }) {
  const ui = useUiText();
  return (
    <p role="alert" className={`text-sm ${errorText} ${className}`}>
      {message}
      {onRetry && <>{' '}<button type="button" onClick={onRetry} className="font-semibold hover:opacity-80">{ui('Try again')}</button></>}
    </p>
  );
}
