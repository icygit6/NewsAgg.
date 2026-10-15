import { GoogleLogin, GoogleOAuthProvider, type GoogleLoginProps } from '@react-oauth/google';
import { useApp } from '../../contexts/AppContext';
import { getRuntimeConfig } from '../../lib/runtimeConfig';

/**
 * Google's sign-in button in the interface language.
 *
 * Google localises the button from the `hl` of the GSI script, which
 * GoogleOAuthProvider loads once; a `locale` passed later does not change the
 * text. Keying a provider on the locale reloads the script (`?hl=zh-TW` /
 * `?hl=en`) whenever the reader switches language, so the button follows it.
 * The provider wraps only the button, so switching language never remounts
 * the rest of the app.
 */
export function LocalizedGoogleLogin(props: GoogleLoginProps) {
  const { language } = useApp();
  const { googleClientId } = getRuntimeConfig();
  if (!googleClientId) return null;
  const locale = language === 'zhTW' || language === 'zhCN' ? 'zh-TW' : 'en';
  return (
    <GoogleOAuthProvider key={locale} clientId={googleClientId} locale={locale}>
      <GoogleLogin {...props} />
    </GoogleOAuthProvider>
  );
}
